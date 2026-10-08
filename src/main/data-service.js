const fs = require("fs");
const path = require("path");

// Adaptador de servicio de datos (Host vs Cliente).
// - Host: opera directamente sobre la base de datos SQLite local.
// - Cliente: traduce cada operación a peticiones HTTP contra el API del Host.
//
// La configuración se lee de la tabla settings (claves: app_mode, host_url,
// host_token) con respaldo en archivo ANTES de que db esté listo.

let dbRef = null;
let fileConfigPath = null;

const readFileConfig = () => {
  try {
    if (fileConfigPath && fs.existsSync(fileConfigPath)) {
      return JSON.parse(fs.readFileSync(fileConfigPath, "utf8"));
    }
  } catch {}
  return {};
};

const getSetting = (key) => {
  const fileCfg = readFileConfig();
  if (fileCfg[key] !== undefined) return fileCfg[key];
  if (dbRef) {
    try {
      const row = dbRef
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key);
      return row ? row.value : null;
    } catch {}
  }
  return null;
};

const setSetting = (key, value) => {
  const fileCfg = readFileConfig();
  fileCfg[key] = value;
  try {
    if (fileConfigPath) fs.writeFileSync(fileConfigPath, JSON.stringify(fileCfg));
  } catch {}
  if (dbRef) {
    try {
      dbRef
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .run(key, String(value));
    } catch {}
  }
};

const getMode = () => (getSetting("app_mode") === "client" ? "client" : "host");
const getHostUrl = () =>
  (getSetting("host_url") || process.env.POS_HOST_URL || "http://127.0.0.1:3456").replace(/\/$/, "");
const getHostToken = () => getSetting("host_token") || process.env.POS_HOST_TOKEN || null;

// Estado offline en memoria: cuando una petición al Host falla por red,
// se marca offline y el catálogo/ventas pasan a la BD local (espejo).
let offline = false;
let syncTimer = null;
const SYNC_INTERVAL_MS = 15000;

const isNetworkError = (err) =>
  /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|aborted|timeout/i.test(
    String(err && err.message ? err.message : err),
  );

const markOffline = () => {
  if (!offline) console.log("[Sync] Host no disponible: entrando en MODO OFFLINE");
  offline = true;
};
const markOnline = () => {
  if (offline) console.log("[Sync] Conexión con el Host restablecida");
  offline = false;
};
const isOffline = () => offline;

const init = (db, userDataDir) => {
  dbRef = db;
  if (userDataDir) fileConfigPath = path.join(userDataDir, "pos-client-config.json");
  startSyncWorker();
};

// ─── Cliente HTTP ──────────────────────────────────────────────
const clientFetch = async (pathname, options = {}) => {
  const token = getHostToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = token;
  const res = await fetch(`${getHostUrl()}${pathname}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(8000),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
};

// ─── Caché local del catálogo (espejo) ────────────────────────
const cacheProductsLocally = (products) => {
  if (!dbRef || !Array.isArray(products)) return;
  try {
    const txn = dbRef.transaction(() => {
      const upsert = dbRef.prepare(
        `INSERT INTO products (id, barcode, name, price, stock, cost_price, sale_unit, min_stock, category_id, supplier_id, box_qty, box_price, is_active)
         VALUES (@id, @barcode, @name, @price, @stock, @cost_price, @sale_unit, @min_stock, @category_id, @supplier_id, @box_qty, @box_price, 1)
         ON CONFLICT(id) DO UPDATE SET
           barcode=excluded.barcode, name=excluded.name, price=excluded.price,
           stock=excluded.stock, cost_price=excluded.cost_price, sale_unit=excluded.sale_unit,
           min_stock=excluded.min_stock, category_id=excluded.category_id,
           supplier_id=excluded.supplier_id, box_qty=excluded.box_qty, box_price=excluded.box_price`,
      );
      for (const p of products) {
        upsert.run({
          id: p.id,
          barcode: p.barcode || null,
          name: p.name,
          price: p.price || 0,
          stock: p.stock || 0,
          cost_price: p.cost_price || 0,
          sale_unit: p.sale_unit || "piece",
          min_stock: p.min_stock ?? 5,
          category_id: p.category_id ?? null,
          supplier_id: p.supplier_id ?? null,
          box_qty: p.box_qty || 0,
          box_price: p.box_price || 0,
        });
      }
    });
    txn();
  } catch (e) {
    console.error("[Sync] Error cacheando productos:", e.message);
  }
};

// Descarga el catálogo completo del Host y lo guarda en la BD espejo local.
// Se usa en el sync periódico y también cuando el vigilante detecta que la
// firma del Host cambió, para que la UI lea datos frescos al recargarse.
const refreshCatalogCache = async () => {
  if (!dbRef) return { success: false, error: "BD no inicializada" };
  try {
    const products = await clientFetch("/api/products").then((d) => d.products);
    markOnline();
    cacheProductsLocally(products);
    return { success: true, count: products.length };
  } catch (err) {
    if (isNetworkError(err)) markOffline();
    return { success: false, error: err.message };
  }
};

const queuePendingSale = (sale, errorMsg) => {
  if (!dbRef) return null;
  const localId = String(Date.now()) + "-" + Math.floor(Math.random() * 1e6);
  dbRef
    .prepare(
      "INSERT INTO pending_sync_sales (local_id, payload, status, error) VALUES (?, ?, 'pending', ?)",
    )
    .run(localId, JSON.stringify(sale), errorMsg || null);

  // Descuenta el stock en la copia local para que el cobro offline no
  // sobrevendas la misma mercancía dos veces en la caja cliente.
  const txn = dbRef.transaction(() => {
    const stockStmt = dbRef.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
    );
    for (const item of sale.cart || []) {
      if (item.isManual || typeof item.id !== "number") continue;
      const deducted = item.isBoxItem
        ? item.quantity * (item.box_qty || 1)
        : item.isPackItem
          ? item.quantity * (item.pack_qty || 1)
          : item.quantity;
      stockStmt.run(deducted, item.id, deducted);
    }
  });
  try {
    txn();
  } catch {}
  return localId;
};

const client = {
  getProducts: async () => {
    try {
      const products = await clientFetch("/api/products").then((d) => d.products);
      markOnline();
      cacheProductsLocally(products);
      return products;
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return dbRef
          ? dbRef.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY name").all()
          : [];
      }
      throw err;
    }
  },
  getCategories: async () => {
    try {
      const categories = await clientFetch("/api/categories").then((d) => d.categories);
      markOnline();
      return categories;
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return dbRef ? dbRef.prepare("SELECT id, name FROM categories ORDER BY name").all() : [];
      }
      throw err;
    }
  },
  getCustomers: async () => {
    try {
      return await clientFetch("/api/customers").then((d) => d.customers);
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        try {
          return dbRef.prepare("SELECT * FROM customers ORDER BY name").all();
        } catch {
          return [];
        }
      }
      throw err;
    }
  },
  searchProducts: async (q) => {
    try {
      return await clientFetch(`/api/products/search?q=${encodeURIComponent(q)}`).then((d) => d.products);
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return dbRef
          ? dbRef
              .prepare(
                `SELECT id, barcode, name, price, stock, cost_price, sale_unit, min_stock, box_qty, box_price
                 FROM products WHERE is_active = 1 AND (name LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 30`,
              )
              .all(`%${q}%`, `%${q}%`)
          : [];
      }
      throw err;
    }
  },
  getProductByBarcode: async (barcode) => {
    try {
      return await clientFetch(`/api/products/${encodeURIComponent(barcode)}`).then((d) => d.product);
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return dbRef
          ? dbRef.prepare("SELECT * FROM products WHERE barcode = ? AND is_active = 1").get(barcode)
          : null;
      }
      throw err;
    }
  },
  recordSale: async (sale) => {
    try {
      const result = await clientFetch("/api/sales", { method: "POST", body: JSON.stringify(sale) });
      markOnline();
      return result;
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        const localId = queuePendingSale(sale, err.message);
        return { success: true, offline: true, localId };
      }
      throw err;
    }
  },
  getSales: async (params = {}) => {
    try {
      const qs = new URLSearchParams(params).toString();
      return await clientFetch(`/api/sales${qs ? `?${qs}` : ""}`).then((d) => d.sales);
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return host.getSales(params);
      }
      throw err;
    }
  },
  addStock: async (productId, body) => {
    try {
      return await clientFetch(`/api/products/${productId}/stock`, { method: "PATCH", body: JSON.stringify(body) });
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return host.addStock(productId, body);
      }
      throw err;
    }
  },
  getCurrentShift: async () => {
    try {
      return await clientFetch("/api/cash-shifts/current").then((d) => d.shift);
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return host.getCurrentShift();
      }
      throw err;
    }
  },
  openShift: async (openingBalance, cashierId) => {
    try {
      return await clientFetch("/api/cash-shifts", { method: "POST", body: JSON.stringify({ openingBalance, cashierId }) });
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return host.openShift(openingBalance, cashierId);
      }
      throw err;
    }
  },
  closeShift: async (id, declaredClose) => {
    try {
      return await clientFetch(`/api/cash-shifts/${id}/close`, { method: "PATCH", body: JSON.stringify({ declaredClose }) });
    } catch (err) {
      if (isNetworkError(err)) {
        markOffline();
        return host.closeShift(id, declaredClose);
      }
      throw err;
    }
  },
  syncSales: async (sales) =>
    clientFetch("/api/sync/sales", { method: "POST", body: JSON.stringify({ sales }) }),
};

// ─── RPC al Host ───────────────────────────────────────────────
// En modo Cliente, las operaciones de datos (ventas, stock, productos,
// caja...) NO se ejecutan en la BD local: se reenvían al Host, que es la
// única fuente de verdad. Así el stock se descuenta una sola vez, de forma
// atómica, sin importar cuántas cajas vendan al mismo tiempo.
class HostRpcError extends Error {}

// Fallo de conexión "limpio": la petición nunca llegó al Host. Solo en ese
// caso es seguro encolar una venta para subirla luego (si fuera un timeout,
// el Host pudo haberla registrado ya y se duplicaría).
const CONNECTION_REFUSED = /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/i;

// opts: { readOnly: bool, runLocal: () => Promise<any> }
const forwardRpc = async (channel, args, opts = {}) => {
  try {
    const data = await clientFetch("/api/rpc", {
      method: "POST",
      body: JSON.stringify({ channel, args }),
      signal: AbortSignal.timeout(20000),
    });
    markOnline();
    if (data && data.ok === false) throw new HostRpcError(data.error || "Error en el Host");
    return data ? data.result : null;
  } catch (err) {
    if (err instanceof HostRpcError) throw err;
    if (!isNetworkError(err)) throw err;
    markOffline();

    if (channel === "record-sale") {
      if (CONNECTION_REFUSED.test(String(err.message))) {
        // Sin conexión: la venta queda en cola y se sube sola al volver el Host.
        const localId = queuePendingSale(args[0] || {}, err.message);
        return { success: true, offline: true, saleId: null, localId };
      }
      return {
        success: false,
        error:
          "No se pudo confirmar la venta con la caja principal. Revisa el historial antes de volver a cobrar.",
      };
    }
    if (opts.readOnly && typeof opts.runLocal === "function") {
      // Lectura sin conexión: se responde con la copia local (espejo).
      return opts.runLocal();
    }
    return {
      success: false,
      error: "Sin conexión con la caja principal. Intenta de nuevo cuando se restablezca.",
    };
  }
};

// ─── Worker de sincronización ────────────────────────────────
const syncPendingSales = async () => {
  if (!dbRef || getMode() !== "client") return { success: true, synced: 0 };
  const pending = dbRef
    .prepare("SELECT * FROM pending_sync_sales WHERE status = 'pending' ORDER BY id ASC")
    .all();
  if (pending.length === 0) {
    // Aprovecha el ciclo para refrescar el catálogo local con datos del Host.
    await refreshCatalogCache();
    return { success: true, synced: 0 };
  }

  const batch = pending.map((p) => ({ ...JSON.parse(p.payload), localId: p.local_id }));
  try {
    const resp = await clientFetch("/api/sync/sales", {
      method: "POST",
      body: JSON.stringify({ sales: batch }),
    });
    markOnline();
    const results = resp.results || [];
    const byLocalId = new Map(results.map((r) => [r.localId, r]));
    const txn = dbRef.transaction(() => {
      for (const p of pending) {
        const r = byLocalId.get(p.local_id);
        if (r && r.success) {
          dbRef
            .prepare("UPDATE pending_sync_sales SET status = 'synced', synced_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ?")
            .run(p.id);
        } else if (r) {
          dbRef
            .prepare("UPDATE pending_sync_sales SET error = ? WHERE id = ?")
            .run(r.error || "Error desconocido", p.id);
        }
      }
    });
    txn();
    // Refresca el catálogo local con el estado oficial del Host.
    await refreshCatalogCache();
    const synced = results.filter((r) => r.success).length;
    return { success: true, synced };
  } catch (err) {
    if (isNetworkError(err)) markOffline();
    return { success: false, error: err.message };
  }
};

const startSyncWorker = () => {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    if (getMode() !== "client") return;
    syncPendingSales().catch((e) => console.error("[SyncWorker]", e.message));
  }, SYNC_INTERVAL_MS);
  if (syncTimer.unref) syncTimer.unref();
};

const stopSyncWorker = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

const getPendingCount = () => {
  try {
    return dbRef
      ? dbRef
          .prepare("SELECT COUNT(*) as c FROM pending_sync_sales WHERE status = 'pending'")
          .get().c
      : 0;
  } catch {
    return 0;
  }
};

// ─── Modo Host (BD directa) ────────────────────────────────────
const host = {
  getProducts: () =>
    dbRef
      .prepare(
        `SELECT p.*, c.name as category_name, s.name as supplier_name
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.is_active = 1 ORDER BY p.name`,
      )
      .all(),
  getCategories: () =>
    dbRef.prepare("SELECT id, name FROM categories ORDER BY name").all(),
  getCustomers: () => {
    try {
      return dbRef.prepare("SELECT * FROM customers ORDER BY name").all();
    } catch {
      return [];
    }
  },
  searchProducts: (q) =>
    dbRef
      .prepare(
        `SELECT id, barcode, name, price, stock, cost_price, sale_unit, min_stock, box_qty, box_price
         FROM products WHERE is_active = 1 AND (name LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 30`,
      )
      .all(`%${q}%`, `%${q}%`),
  getProductByBarcode: (barcode) =>
    dbRef.prepare("SELECT * FROM products WHERE barcode = ? AND is_active = 1").get(barcode),
  recordSale: (sale) => {
    // El descuento de stock ocurre de forma atómica dentro de una transacción
    // (misma lógica que IPC record-sale; la guarda `stock >= ?` evita
    // sobreventa cuando varias cajas descuentan a la vez).
    const txn = dbRef.transaction(() => {
      const openReg = dbRef
        .prepare("SELECT id FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC, id DESC LIMIT 1")
        .get();
      const info = dbRef
        .prepare(
          "INSERT INTO sales (total, payment_method, discount_total, register_id, cashier_name) VALUES (?, ?, ?, ?, ?)",
        )
        .run(sale.total, sale.paymentMethod || "cash", sale.discountTotal || 0, openReg?.id || null, sale.cashierName || "Usuario Principal");
      const saleId = info.lastInsertRowid;
      const itemStmt = dbRef.prepare(
        "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price_at_sale, discount_percent, stock_deducted) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      const stockStmt = dbRef.prepare(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
      );
      for (const item of sale.cart || []) {
        const isManual = item.isManual || typeof item.id !== "number";
        const deducted = isManual
          ? 0
          : item.isBoxItem
            ? item.quantity * (item.box_qty || 1)
            : item.isPackItem
              ? item.quantity * (item.pack_qty || 1)
              : item.quantity;
        itemStmt.run(saleId, isManual ? null : item.id, item.name || null, item.quantity, item.finalPrice || item.price, item.discount_percent || 0, deducted);
        if (!isManual) {
          const r = stockStmt.run(deducted, item.id, deducted);
          if (r.changes === 0)
            throw new Error(`Stock insuficiente para el producto ID: ${item.id}`);
        }
      }
      return saleId;
    });
    const saleId = txn();
    return { success: true, saleId };
  },
  getSales: (params = {}) => {
    let sql = "SELECT * FROM sales WHERE 1=1";
    const args = [];
    if (params.from) { sql += " AND created_at >= ?"; args.push(params.from); }
    if (params.to) { sql += " AND created_at <= ?"; args.push(params.to); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    args.push(parseInt(params.limit) || 200);
    return dbRef.prepare(sql).all(...args);
  },
  addStock: (productId, body) => {
    dbRef
      .prepare("UPDATE products SET stock = stock + ? WHERE id = ?")
      .run(body.quantity, productId);
    dbRef
      .prepare(
        "INSERT INTO stock_movements (product_id, type, quantity, cost, notes) VALUES (?, 'in', ?, ?, ?)",
      )
      .run(productId, body.quantity, body.cost || 0, body.notes || "Entrada de stock");
    return { success: true };
  },
  getCurrentShift: () =>
    dbRef
      .prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC, id DESC LIMIT 1")
      .get() || null,
  openShift: (openingBalance, cashierId) => {
    const mxToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const info = dbRef
      .prepare("INSERT INTO cash_register (date, opening_balance, status, cashier_id, opened_by) VALUES (?, ?, 'open', ?, ?)")
      .run(mxToday, parseFloat(openingBalance) || 0, cashierId || null, cashierId || null);
    return { success: true, shift: dbRef.prepare("SELECT * FROM cash_register WHERE id = ?").get(info.lastInsertRowid) };
  },
  closeShift: (id, declaredClose) => {
    const shift = dbRef.prepare("SELECT * FROM cash_register WHERE id = ? AND status = 'open'").get(id);
    if (!shift) return { success: false, error: "Caja no encontrada o ya cerrada" };
    const cashSales =
      dbRef
        .prepare("SELECT COALESCE(SUM(total),0) as t FROM sales WHERE register_id = ? AND payment_method = 'cash' AND (status IS NULL OR status != 'cancelado')")
        .get(id).t || 0;
    const expected = Number(shift.opening_balance || 0) + cashSales - Number(shift.expenses || 0);
    const declared = parseFloat(declaredClose) || 0;
    dbRef
      .prepare("UPDATE cash_register SET status = 'closed', closed_at = CURRENT_TIMESTAMP, expected_close = ?, declared_close = ?, difference = ? WHERE id = ?")
      .run(expected, declared, declared - expected, id);
    return { success: true, shift: dbRef.prepare("SELECT * FROM cash_register WHERE id = ?").get(id) };
  },
  syncSales: (sales) => {
    const results = [];
    for (const s of sales) {
      try {
        const r = host.recordSale(s);
        results.push({ success: true, saleId: r.saleId, localId: s.localId ?? null });
      } catch (err) {
        results.push({ success: false, error: err.message, localId: s.localId ?? null });
      }
    }
    return { success: true, results };
  },
};

// Fachada: delega según el modo configurado. Los métodos del modo host son
// síncronos; los del cliente son async. Los consumidores deben usar await.
const DataService = new Proxy(
  {},
  {
    get(_, prop) {
      return (...args) => {
        const impl = getMode() === "client" ? client : host;
        const fn = impl[prop];
        if (!fn) throw new Error(`Método no soportado: ${String(prop)}`);
        return fn(...args);
      };
    },
  },
);

module.exports = {
  init,
  getMode,
  getHostUrl,
  DataService,
  isOffline,
  getPendingCount,
  syncPendingSales,
  stopSyncWorker,
  refreshCatalogCache,
  forwardRpc,
  getHostToken,
  // URL del Host guardada explícitamente (null si la caja no está emparejada).
  getSavedHostUrl: () => {
    const url = getSetting("host_url");
    return url ? String(url).replace(/\/$/, "") : null;
  },
  setMode: (mode) => setSetting("app_mode", mode === "client" ? "client" : "host"),
  setHost: (url, token) => {
    setSetting("host_url", url);
    if (token) setSetting("host_token", token);
  },
};
