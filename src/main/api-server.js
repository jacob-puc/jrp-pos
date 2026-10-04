const express = require("express");
const crypto = require("crypto");

const nomarize = (s) =>
  (s == null ? "" : String(s))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .toLowerCase();

let server = null;
let activeTokens = {};

const startServer = async (db, port = 3456) => {
  if (server) return { success: true, port };

  const app = express();
  app.use(express.json());

  const safe = (handler, exposeDetails = false) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`API error ${req.method} ${req.originalUrl}:`, err.message);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        ...(exposeDetails ? { details: err.message } : {}),
      });
    }
  };

  app.post("/api/auth", safe((req, res) => {
    const { id, pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, error: "PIN requerido" });

    let cashier;
    if (id) {
      cashier = db.prepare("SELECT id, name, role FROM cashiers WHERE id = ? AND pin = ? AND is_active = 1").get(id, pin);
    } else {
      // fallback: probe only
      if (pin === "probe") return res.json({ success: true, cashier: null });
      cashier = db.prepare("SELECT id, name, role FROM cashiers WHERE pin = ? AND is_active = 1").get(pin);
    }
    if (!cashier) return res.status(401).json({ success: false, error: "PIN inválido" });

    const token = crypto.randomBytes(32).toString("hex");
    activeTokens[token] = { cashierId: cashier.id, createdAt: Date.now() };
    res.json({ success: true, token, cashier: { id: cashier.id, name: cashier.name, role: cashier.role } });
  }));

  app.get("/api/cashiers", safe((req, res) => {
    const cashiers = db.prepare("SELECT id, name, role, is_active FROM cashiers WHERE is_active = 1 ORDER BY name").all();
    res.json({ success: true, cashiers });
  }));

  db.exec(`CREATE TABLE IF NOT EXISTS paired_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT,
    device_type TEXT DEFAULT 'desktop_client',
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME
  )`);
  const pairedDeviceColumns = new Set(
    db.prepare("PRAGMA table_info(paired_devices)").all().map((column) => column.name),
  );
  const ensurePairedDeviceColumn = (name, definition) => {
    if (!pairedDeviceColumns.has(name)) {
      db.exec(`ALTER TABLE paired_devices ADD COLUMN ${name} ${definition}`);
      pairedDeviceColumns.add(name);
    }
  };
  ensurePairedDeviceColumn("device_name", "TEXT");
  ensurePairedDeviceColumn("device_type", "TEXT DEFAULT 'desktop_client'");
  ensurePairedDeviceColumn("token", "TEXT");
  ensurePairedDeviceColumn("created_at", "DATETIME");
  ensurePairedDeviceColumn("last_seen", "DATETIME");
  db.exec(`
    UPDATE paired_devices
    SET token = lower(hex(randomblob(32)))
    WHERE token IS NULL OR token = ''
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paired_devices_token
    ON paired_devices(token)
  `);

  app.post("/api/auth/verify", safe((req, res) => {
    const { id, pin } = req.body || {};
    if (!id || !pin) return res.status(400).json({ success: false, error: "Usuario y PIN requeridos" });
    const cashier = db
      .prepare("SELECT id, name, role FROM cashiers WHERE id = ? AND pin = ? AND is_active = 1")
      .get(id, pin);
    if (!cashier) return res.status(401).json({ success: false, error: "PIN inválido" });
    res.json({ success: true, cashier });
  }));

  app.post("/api/auth/host-info", safe((req, res) => {
    const provided = String(req.body?.activationCode || "").trim().toUpperCase();
    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'activation_code'")
      .get();
    if (!provided || !row || String(row.value).trim().toUpperCase() !== provided) {
      return res.status(401).json({ success: false, error: "Código de activación inválido" });
    }

    const settings = db
      .prepare("SELECT key, value FROM settings WHERE key IN ('store_name', 'owner_name', 'store_address')")
      .all()
      .reduce((result, setting) => ({ ...result, [setting.key]: setting.value }), {});
    const cashiers = db
      .prepare("SELECT id, name, role FROM cashiers WHERE is_active = 1 ORDER BY name")
      .all();
    res.json({
      success: true,
      storeName: settings.store_name || "",
      ownerName: settings.owner_name || "",
      address: settings.store_address || "",
      cashiers,
    });
  }));

  // Tokens persistentes de cajas cliente (desktop_client) ligadas vía
  // activation code. A diferencia de activeTokens (PIN de cajero, en memoria),
  // estos se guardan en la tabla paired_devices y sobreviven reinicios.
  const deviceTokens = {};
  try {
    for (const row of db
      .prepare("SELECT token, device_name, device_type FROM paired_devices")
      .all()) {
      deviceTokens[row.token] = {
        deviceName: row.device_name,
        deviceType: row.device_type,
      };
    }
  } catch {}

  const requireAuth = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ success: false, error: "No autorizado" });
    if (activeTokens[token]) {
      req.cashierId = activeTokens[token].cashierId;
      return next();
    }
    const device = deviceTokens[token] || db
      .prepare("SELECT device_name, device_type FROM paired_devices WHERE token = ?")
      .get(token);
    if (device) {
      deviceTokens[token] = { deviceName: device.device_name || device.deviceName, deviceType: device.device_type || device.deviceType };
      req.deviceName = device.device_name || device.deviceName;
      req.deviceType = device.device_type || device.deviceType || "desktop_client";
      try {
        db.prepare("UPDATE paired_devices SET last_seen = CURRENT_TIMESTAMP WHERE token = ?").run(token);
      } catch {}
      return next();
    }
    return res.status(401).json({ success: false, error: "No autorizado" });
  };

  // ─── Emparejamiento de cajas cliente ─────────────────────────
  app.post("/api/auth/pair-device", safe(async (req, res) => {
    const { activationCode, token, code, deviceName, deviceType } = req.body || {};
    const provided = String(activationCode || token || code || "").trim().toUpperCase();
    if (!provided) return res.status(400).json({ success: false, error: "Código de activación requerido" });

    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'activation_code'")
      .get();
    if (!row || String(row.value).trim().toUpperCase() !== provided) {
      return res.status(401).json({ success: false, error: "Código de activación inválido" });
    }

    const deviceToken = crypto.randomBytes(32).toString("hex");
    const type = deviceType || "desktop_client";
    db.prepare(
      "INSERT INTO paired_devices (device_name, device_type, token) VALUES (?, ?, ?)",
    ).run(deviceName || "Caja Cliente", type, deviceToken);
    deviceTokens[deviceToken] = { deviceName: deviceName || "Caja Cliente", deviceType: type };

    res.json({
      success: true,
      token: deviceToken,
      device: { name: deviceName || "Caja Cliente", type },
    });
  }, true));

  app.get("/api/auth/paired-devices", requireAuth, safe((req, res) => {
    const devices = db
      .prepare("SELECT id, device_name, device_type, created_at, last_seen FROM paired_devices ORDER BY created_at DESC")
      .all();
    res.json({ success: true, devices });
  }));

  // IMPORTANT: /search must come BEFORE :barcode or Express matches "search" as barcode
  app.get("/api/products/search", requireAuth, safe((req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ success: true, products: [] });

    const term = `%${nomarize(q.trim())}%`;
    const rawTerm = `%${q.trim()}%`;
    const products = db.prepare(`
      SELECT id, barcode, name, price, stock, cost_price, sale_unit, min_stock, box_qty, box_price
      FROM products
      WHERE (nomar(name) LIKE ? OR barcode LIKE ?) AND is_active = 1
      ORDER BY name LIMIT 30
    `).all(term, rawTerm);

    res.json({ success: true, products });
  }));

  app.get("/api/products/:barcode", requireAuth, safe((req, res) => {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.barcode = ? AND p.is_active = 1
    `).get(req.params.barcode);

    if (!product) return res.status(404).json({ success: false, error: "Producto no encontrado" });
    res.json({ success: true, product });
  }));

  app.post("/api/products", requireAuth, safe((req, res) => {
    const { barcode, name, cost_price, price, sale_unit, category_id, min_stock, stock, box_qty, box_price } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Nombre requerido" });

    const exists = db.prepare("SELECT id FROM products WHERE barcode = ?").get(barcode);
    if (exists) return res.status(409).json({ success: false, error: "Ya existe un producto con ese código" });

    const stockNum = parseInt(stock) || 0;
    const minStock =
      parseInt(min_stock) > 0
        ? parseInt(min_stock)
        : Math.max(1, Math.floor(stockNum * 0.4));

    const result = db.prepare(`
      INSERT INTO products (barcode, name, cost_price, price, sale_unit, stock, category_id, min_stock, is_active, box_qty, box_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      barcode || null,
      name.trim(),
      cost_price || 0,
      price || 0,
      sale_unit || "piece",
      stockNum,
      category_id || null,
      minStock,
      parseInt(box_qty) || 0,
      parseFloat(box_price) || 0
    );

    const product = db.prepare("SELECT id, barcode, name, price, stock, cost_price, sale_unit, box_qty, box_price FROM products WHERE id = ?").get(result.lastInsertRowid);
    res.json({ success: true, product, message: "Producto registrado correctamente" });
  }));

  app.patch("/api/products/:id/stock", requireAuth, safe((req, res) => {
    const { quantity, notes, cost, supplierId, registerExpense, updateCostPrice } = req.body;
    const id = parseInt(req.params.id);
    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, error: "Cantidad inválida" });

    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(id);
    if (!product) return res.status(404).json({ success: false, error: "Producto no encontrado" });

    const enteredCost = parseFloat(cost) || 0;
    const isBox =
      (product.sale_unit === "box" || product.sale_unit === "package") &&
      product.box_qty > 0;
    // The user enters the TOTAL cost of this purchase; if empty, use cost_price × quantity
    const totalCost =
      enteredCost > 0
        ? enteredCost
        : isBox
          ? ((product.cost_price || 0) / product.box_qty) * quantity
          : (product.cost_price || 0) * quantity;

    // Optional cost price update (the user confirmed the new unit/box cost)
    if (req.body.updateCostPrice !== undefined && !isNaN(parseFloat(req.body.updateCostPrice))) {
      const rounded = Math.round((parseFloat(req.body.updateCostPrice) + Number.EPSILON) * 100) / 100;
      db.prepare("UPDATE products SET cost_price = ? WHERE id = ?").run(rounded, id);
    }

    const supplier = supplierId
      ? db.prepare("SELECT id, name FROM suppliers WHERE id = ?").get(supplierId)
      : null;
    const supplierName = supplier?.name || null;

    db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?")
      .run(quantity, id);
    db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, cost, reference, notes, cashier_id, supplier_id)
      VALUES (?, 'in', ?, ?, 'App móvil', ?, ?, ?)
    `).run(id, quantity, totalCost, supplierName ? `Compra de inventario — ${supplierName}` : (notes || "Movil"), req.cashierId || null, supplier ? supplier.id : null);

    // Register cost as expense (even if no cash register is open)
    // unless the user opted to not deduct from the register (registerExpense=false).
    if (registerExpense !== false && totalCost > 0) {
      const todayMX = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const openReg = db.prepare("SELECT id FROM cash_register WHERE date = ? AND status = 'open'").get(todayMX);
      if (openReg) {
        db.prepare("UPDATE cash_register SET expenses = COALESCE(expenses, 0) + ? WHERE id = ?").run(totalCost, openReg.id);
      }
      const reason = supplierName
        ? `Compra de ${product.name} — ${supplierName}`
        : `Compra de inventario: ${product.name}`;
      db.prepare("INSERT INTO cash_register_expenses (register_id, amount, reason, product_id, quantity) VALUES (?, ?, ?, ?, ?)")
        .run(openReg ? openReg.id : null, totalCost, reason, id, quantity);
    }

    const updated = db.prepare("SELECT id, barcode, name, price, stock, cost_price, sale_unit, category_id, min_stock, box_qty, box_price FROM products WHERE id = ?").get(id);
    res.json({ success: true, product: updated, message: "Stock actualizado correctamente" });
  }));

  app.get("/api/categories", requireAuth, safe((req, res) => {
    const categories = db.prepare("SELECT id, name FROM categories ORDER BY name").all();
    res.json({ success: true, categories });
  }));

  // ─── Catálogo completo ───────────────────────────────────────
  app.get("/api/products", requireAuth, safe((req, res) => {
    const products = db
      .prepare(
        `SELECT p.*, c.name as category_name, s.name as supplier_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.is_active = 1
         ORDER BY p.name`,
      )
      .all();
    res.json({ success: true, products });
  }));

  app.get("/api/customers", requireAuth, safe((req, res) => {
    try {
      const customers = db.prepare("SELECT * FROM customers ORDER BY name").all();
      res.json({ success: true, customers });
    } catch {
      res.json({ success: true, customers: [] });
    }
  }));

  // ─── Ventas ──────────────────────────────────────────────────
  const recordSaleTx = ({ cart, total, paymentMethod, discountTotal, cashierName }) => {
    const txn = db.transaction(() => {
      const openReg = db
        .prepare("SELECT id FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC, id DESC LIMIT 1")
        .get();
      const registerId = openReg ? openReg.id : null;

      const saleInfo = db
        .prepare(
          "INSERT INTO sales (total, payment_method, discount_total, register_id, cashier_name) VALUES (?, ?, ?, ?, ?)",
        )
        .run(total, paymentMethod || "cash", discountTotal || 0, registerId, cashierName || "Usuario Principal");
      const saleId = saleInfo.lastInsertRowid;

      const itemStmt = db.prepare(
        "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price_at_sale, discount_percent, stock_deducted) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      const stockStmt = db.prepare(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
      );

      for (const item of cart) {
        const isManual = item.isManual || typeof item.id !== "number";
        const productId = isManual ? null : item.id;
        const productName = item.name || (isManual ? "Producto manual" : null);
        let stockDeducted = 0;
        if (!isManual) {
          stockDeducted = item.isBoxItem
            ? item.quantity * (item.box_qty || 1)
            : item.isPackItem
              ? item.quantity * (item.pack_qty || 1)
              : item.quantity;
        }
        itemStmt.run(saleId, productId, productName, item.quantity, item.finalPrice || item.price, item.discount_percent || 0, stockDeducted);
        if (!isManual) {
          const r = stockStmt.run(stockDeducted, item.id, stockDeducted);
          if (r.changes === 0) {
            throw new Error(`Stock insuficiente para el producto ID: ${item.id}`);
          }
        }
      }
      return saleId;
    });
    return txn();
  };

  app.post("/api/sales", requireAuth, safe((req, res) => {
    const { cart, total, paymentMethod, discountTotal, cashierName } = req.body || {};
    if (!Array.isArray(cart) || cart.length === 0)
      return res.status(400).json({ success: false, error: "Carrito vacío" });
    if (total == null || isNaN(Number(total)))
      return res.status(400).json({ success: false, error: "Total inválido" });
    try {
      const saleId = recordSaleTx({ cart, total, paymentMethod, discountTotal, cashierName });
      res.json({ success: true, saleId });
    } catch (err) {
      res.status(409).json({ success: false, error: err.message });
    }
  }));

  app.get("/api/sales", requireAuth, safe((req, res) => {
    const { from, to, limit } = req.query;
    let sql = "SELECT * FROM sales WHERE 1=1";
    const params = [];
    if (from) { sql += " AND created_at >= ?"; params.push(from); }
    if (to) { sql += " AND created_at <= ?"; params.push(to); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(parseInt(limit) || 200);
    const sales = db.prepare(sql).all(...params);
    res.json({ success: true, sales });
  }));

  // ─── Sincronización (lotes en diferido) ───────────────────────
  app.post("/api/sync/sales", requireAuth, safe((req, res) => {
    const { sales } = req.body || {};
    if (!Array.isArray(sales) || sales.length === 0)
      return res.status(400).json({ success: false, error: "Sin ventas para sincronizar" });

    const results = [];
    for (const sale of sales) {
      try {
        const saleId = recordSaleTx({
          cart: sale.cart,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          discountTotal: sale.discountTotal,
          cashierName: sale.cashierName,
        });
        results.push({ success: true, saleId, localId: sale.localId ?? null });
      } catch (err) {
        results.push({ success: false, error: err.message, localId: sale.localId ?? null });
      }
    }
    res.json({ success: true, results });
  }));

  // ─── Caja (apertura, cierre, arqueos) ────────────────────────
  app.get("/api/cash-shifts", requireAuth, safe((req, res) => {
    const shifts = db
      .prepare("SELECT * FROM cash_register ORDER BY opened_at DESC LIMIT 100")
      .all();
    res.json({ success: true, shifts });
  }));

  app.get("/api/cash-shifts/current", requireAuth, safe((req, res) => {
    const open = db
      .prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC, id DESC LIMIT 1")
      .get();
    res.json({ success: true, shift: open || null });
  }));

  app.post("/api/cash-shifts", requireAuth, safe((req, res) => {
    const { openingBalance, cashierId, cashierName } = req.body || {};
    const existing = db
      .prepare("SELECT id FROM cash_register WHERE status = 'open' LIMIT 1")
      .get();
    if (existing)
      return res.status(409).json({ success: false, error: "Ya hay una caja abierta" });
    const mxToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const info = db
      .prepare(
        "INSERT INTO cash_register (date, opening_balance, status, cashier_id, opened_by) VALUES (?, ?, 'open', ?, ?)",
      )
      .run(mxToday, parseFloat(openingBalance) || 0, cashierId || null, cashierId || null);
    const shift = db.prepare("SELECT * FROM cash_register WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, shift });
  }));

  app.patch("/api/cash-shifts/:id/close", requireAuth, safe((req, res) => {
    const id = parseInt(req.params.id);
    const { declaredClose } = req.body || {};
    const shift = db.prepare("SELECT * FROM cash_register WHERE id = ? AND status = 'open'").get(id);
    if (!shift) return res.status(404).json({ success: false, error: "Caja no encontrada o ya cerrada" });
    const sales = db
      .prepare(
        "SELECT payment_method, COALESCE(SUM(total),0) as total FROM sales WHERE register_id = ? AND (status IS NULL OR status != 'cancelado') GROUP BY payment_method",
      )
      .all(id);
    const cashSales = sales.find((s) => s.payment_method === "cash")?.total || 0;
    const expected = Number(shift.opening_balance || 0) + cashSales - Number(shift.expenses || 0);
    const declared = parseFloat(declaredClose) || 0;
    db.prepare(
      "UPDATE cash_register SET status = 'closed', closed_at = CURRENT_TIMESTAMP, expected_close = ?, declared_close = ?, difference = ? WHERE id = ?",
    ).run(expected, declared, declared - expected, id);
    const updated = db.prepare("SELECT * FROM cash_register WHERE id = ?").get(id);
    res.json({ success: true, shift: updated });
  }));

  const MAX_ATTEMPTS = 3;
  let lastError = "Error desconocido al iniciar el servidor";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await new Promise((resolve) => {
      // Sin host: bind dual-stack (IPv6 :: + IPv4 mapeado). Bindear a "0.0.0.0"
      // falla con EADDRINUSE cuando hay una conexión activa en el puerto
      // (p.ej. sockets de explorer/telemetría), aunque netstat no muestre listener.
      const srv = app.listen(port);
      let settled = false;
      let errored = false;
      const finish = (r) => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };

      srv.on("listening", () => {
        // En Windows a veces se emite 'listening' y luego 'error' (EADDRINUSE)
        // cuando el puerto ya estaba ocupado. Esperamos brevemente para que el
        // error gane y no reportar un falso éxito.
        setTimeout(() => {
          if (errored) return;
          server = srv;
          console.log(`API Server running on port ${port}`);
          finish({ success: true, port });
        }, 300);
      });

      srv.on("error", (err) => {
        errored = true;
        console.error("API Server error:", err.message);
        if (server === srv) server = null;
        finish({ success: false, error: err.message });
      });
    });

    if (result.success) return result;

    lastError = result.error;
    if (!/EADDRINUSE/i.test(lastError)) break;

    if (attempt < MAX_ATTEMPTS) {
      console.log(
        `[API] Puerto ${port} ocupado, reintentando en 1.5s (intento ${attempt + 1}/${MAX_ATTEMPTS})...`,
      );
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  try {
    const output = require("child_process")
      .execSync(`netstat -ano | findstr LISTENING | findstr ":${port} "`, {
        timeout: 3000,
        encoding: "utf8",
      })
      .toString();
    console.error(`[API] Puerto ${port} en uso por:\n${output}`);
  } catch {}

  return {
    success: false,
    error: `listen EADDRINUSE: address already in use 0.0.0.0:${port}`,
  };
};

const stopServer = () => {
  if (server) {
    server.close();
    server = null;
    activeTokens = {};
    console.log("API Server stopped");
  }
};

const getStatus = () => ({
  running: server !== null,
  port: server ? server.address().port : null,
});

module.exports = { startServer, stopServer, getStatus };
