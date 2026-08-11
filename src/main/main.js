const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dbDir = path.join(app.getPath("userData"), "db");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "pos-system.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const ensureColumn = (table, column, definition) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const createTables = () => {
  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER REFERENCES categories(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    expiry_date TEXT,
    image_path TEXT,
    cost_price REAL DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    discount_percent REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    has_discount INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    discount_total REAL DEFAULT 0,
    cashier_name TEXT DEFAULT 'Usuario Principal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL,
    discount_percent REAL DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('in','out','adjust')),
    quantity INTEGER NOT NULL,
    reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS cash_register (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    opening_balance REAL DEFAULT 0,
    cash_sales REAL DEFAULT 0,
    card_sales REAL DEFAULT 0,
    transfer_sales REAL DEFAULT 0,
    expenses REAL DEFAULT 0,
    expected_close REAL DEFAULT 0,
    declared_close REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    task_date TEXT NOT NULL,
    task_time TEXT,
    reminder_minutes INTEGER DEFAULT 30,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migration: add register_id to sales
  const sCols2 = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols2.find((c) => c.name === "register_id")) {
    ensureColumn(
      "sales",
      "register_id",
      "INTEGER REFERENCES cash_register(id)",
    );
  }

  // Migrations for existing dbs
  const pCols = db.prepare("PRAGMA table_info(products)").all();
  if (!pCols.find((c) => c.name === "category_id")) {
    ensureColumn(
      "products",
      "category_id",
      "INTEGER REFERENCES categories(id)",
    );
    ensureColumn("products", "supplier_id", "INTEGER REFERENCES suppliers(id)");
    ensureColumn("products", "expiry_date", "TEXT");
    ensureColumn("products", "image_path", "TEXT");
    ensureColumn("products", "cost_price", "REAL DEFAULT 0");
    ensureColumn("products", "min_stock", "INTEGER DEFAULT 5");
    ensureColumn("products", "discount_percent", "REAL DEFAULT 0");
    ensureColumn("products", "is_active", "INTEGER DEFAULT 1");
  }
  const sCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols.find((c) => c.name === "payment_method")) {
    ensureColumn("sales", "payment_method", "TEXT DEFAULT 'cash'");
    ensureColumn("sales", "discount_total", "REAL DEFAULT 0");
    ensureColumn("sales", "cashier_name", "TEXT DEFAULT 'Usuario Principal'");
  }
  const siCols = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siCols.find((c) => c.name === "discount_percent")) {
    ensureColumn("sale_items", "discount_percent", "REAL DEFAULT 0");
  }

  // Ensure product_name column exists
  if (!siCols.find((c) => c.name === "product_name")) {
    ensureColumn("sale_items", "product_name", "TEXT");
  }

  // Cancellation support
  if (!sCols2.find((c) => c.name === "status")) {
    ensureColumn("sales", "status", "TEXT DEFAULT 'completado'");
  }
  ensureColumn("sales", "cancelled_at", "DATETIME");
  ensureColumn("sales", "cancelled_by", "TEXT");
  const siCancelledCols = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siCancelledCols.find((c) => c.name === "stock_deducted")) {
    ensureColumn("sale_items", "stock_deducted", "REAL DEFAULT 0");
  }

  // Make product_id nullable (recreate table) using a fresh PRAGMA check
  const siColsFresh = db.prepare("PRAGMA table_info(sale_items)").all();
  const pcol = siColsFresh.find((c) => c.name === "product_id");
  if (pcol && pcol.notnull === 1) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE sale_items_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        product_id INTEGER REFERENCES products(id),
        product_name TEXT,
        quantity INTEGER NOT NULL,
        price_at_sale REAL NOT NULL,
        discount_percent REAL DEFAULT 0
      )
    `);
    db.exec(
      `INSERT INTO sale_items_v2 (id, sale_id, product_id, product_name, quantity, price_at_sale, discount_percent) SELECT id, sale_id, product_id, product_name, quantity, price_at_sale, discount_percent FROM sale_items`,
    );
    db.exec(`DROP TABLE sale_items`);
    db.exec(`ALTER TABLE sale_items_v2 RENAME TO sale_items`);
    db.pragma("foreign_keys = ON");
  }
};

createTables();

// ─── ÍNDICES ──────────────────────────────────────────────────
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_register_id ON sales(register_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_register_date_status ON cash_register(date, status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_date_completed ON tasks(task_date, completed)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at)`);

// Migration: make register_id nullable in cash_register_expenses (gastos sin caja)
{
  const expCols = db.prepare("PRAGMA table_info(cash_register_expenses)").all();
  const expRegCol = expCols.find((c) => c.name === "register_id");
  if (expRegCol && expRegCol.notnull === 1) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE cash_register_expenses_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_id INTEGER REFERENCES cash_register(id),
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(
      `INSERT INTO cash_register_expenses_v2 (id, register_id, amount, reason, created_at)
       SELECT id, register_id, amount, reason, created_at FROM cash_register_expenses`,
    );
    db.exec(`DROP TABLE cash_register_expenses`);
    db.exec(`ALTER TABLE cash_register_expenses_v2 RENAME TO cash_register_expenses`);
    db.pragma("foreign_keys = ON");
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_register_expenses_register ON cash_register_expenses(register_id)`);
  }
}

// Migration: add name to cash_register
ensureColumn("cash_register", "name", "TEXT");

// Migration: add sale_unit to products
ensureColumn("products", "sale_unit", "TEXT DEFAULT 'piece'");

// Migration: add cost to stock_movements
ensureColumn("stock_movements", "cost", "REAL DEFAULT 0");

// Migration: add box fields to products
ensureColumn("products", "box_qty", "INTEGER DEFAULT 0");
ensureColumn("products", "box_price", "REAL DEFAULT 0");

// Migration: add has_discount to products
ensureColumn("products", "has_discount", "INTEGER DEFAULT 0");

// Migration: add cashier_id to cash_register
ensureColumn("cash_register", "cashier_id", "INTEGER");
// Migration: add opened_by and closed_by to cash_register
ensureColumn("cash_register", "opened_by", "INTEGER");
ensureColumn("cash_register", "closed_by", "INTEGER");

db.exec(`
  CREATE TABLE IF NOT EXISTS cash_register_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    register_id INTEGER NOT NULL REFERENCES cash_register(id),
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_cash_register_expenses_register ON cash_register_expenses(register_id)`);

// ─── CASHIERS TABLE ──────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS cashiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'cashier',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Migration: add role column to cashiers (for existing DBs)
ensureColumn("cashiers", "role", "TEXT DEFAULT 'cashier'");

// Remove old default admin cashier if it still exists
const oldAdmin = db
  .prepare("SELECT id FROM cashiers WHERE name = 'Admin' AND pin = '0000'")
  .get();
if (oldAdmin) {
  const otherCount = db
    .prepare("SELECT COUNT(*) as count FROM cashiers WHERE name != 'Admin'")
    .get();
  if (otherCount.count > 0) {
    db.prepare("DELETE FROM cashiers WHERE id = ?").run(oldAdmin.id);
  }
}

// Migration: add role column to cashiers
ensureColumn("cashiers", "role", "TEXT DEFAULT 'cashier'");

if (require("electron-squirrel-startup")) {
  app.quit();
}

const apiServer = require("./api-server");
const discovery = require("./discovery");

let mainWin = null;

app.on("ready", () => {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "Sistema Ventas - POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const devURL =
      typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined"
        ? MAIN_WINDOW_VITE_DEV_SERVER_URL
        : null;
    if (devURL) {
      mainWin.loadURL(devURL);
    } else {
      mainWin.loadFile(
        path.join(__dirname, `../renderer/main_window/index.html`),
      );
    }
  } catch (err) {
    console.error("Error loading window:", err.message);
  }

  // Start local API server for mobile app
  (async () => {
    const result = await apiServer.startServer(db, 3456);
    if (result.success) {
      await discovery.startDiscovery(3456);
      console.log(`Mobile API ready on port ${3456}`);
    } else {
      console.error("Failed to start mobile API:", result.error);
    }
  })();

  // Task reminder checker every 30 seconds
  setInterval(() => {
    if (!mainWin || mainWin.isDestroyed()) return;
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const tasks = db.prepare("SELECT * FROM tasks WHERE task_date = ? AND completed = 0 AND task_time IS NOT NULL").all(today);
      for (const task of tasks) {
        if (notifiedTasks.has(task.id)) continue;
        const [h, m] = task.task_time.split(":").map(Number);
        const taskMinutes = h * 60 + m;
        const reminderMinutes = task.reminder_minutes || 30;
        if (currentMinutes >= taskMinutes - reminderMinutes && currentMinutes <= taskMinutes + 1) {
          notifiedTasks.add(task.id);
          mainWin.webContents.send("task-reminder", { id: task.id, title: task.title, description: task.description, task_time: task.task_time });
        }
      }
    } catch (e) {
      console.error("[TASKS REMINDER ERROR]", e.message);
    }
  }, 30000);
});

app.on("before-quit", () => {
  apiServer.stopServer();
  discovery.stopDiscovery();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWin || BrowserWindow.getAllWindows().length === 0) {
    mainWin = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 1024,
      minHeight: 700,
      title: "Sistema Ventas - POS",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      const devURL =
        typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined"
          ? MAIN_WINDOW_VITE_DEV_SERVER_URL
          : null;
      if (devURL) mainWin.loadURL(devURL);
      else
        mainWin.loadFile(
          path.join(__dirname, `../renderer/main_window/index.html`),
        );
    } catch (e) {}
  }
});

// ─── PRODUCTS ───────────────────────────────────────────────

ipcMain.handle("get-products", async (event, params) => {
  const {
    search,
    category_id,
    supplier_id,
    sortField,
    sortDir,
    page,
    rowsPerPage,
  } = params || {};
  const conditions = [];
  const queryParams = [];
  if (search && search.length >= 2) {
    conditions.push("(p.name LIKE ? OR p.brand LIKE ? OR p.barcode LIKE ?)");
    const s = `%${search}%`;
    queryParams.push(s, s, s);
  }
  if (category_id) {
    conditions.push("p.category_id = ?");
    queryParams.push(parseInt(category_id));
  }
  if (supplier_id) {
    conditions.push("p.supplier_id = ?");
    queryParams.push(parseInt(supplier_id));
  }
  const where =
    conditions.length > 0
      ? "WHERE " + conditions.join(" AND ") + " AND p.is_active = 1"
      : "WHERE p.is_active = 1";
  const allowedSort = { name: "p.name", price: "p.price", stock: "p.stock" };
  const col = allowedSort[sortField] || "p.name";
  const dir = sortDir === "desc" ? "DESC" : "ASC";

  const total = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM products p ${where}
  `,
    )
    .get(...queryParams).count;

  const limit = Math.min(Math.max(parseInt(rowsPerPage) || 10, 1), 100);
  const offset = Math.max(parseInt(page) || 0, 0) * limit;

  const products = db
    .prepare(
      `
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ${where}
    ORDER BY ${col} ${dir}
    LIMIT ? OFFSET ?
  `,
    )
    .all(...queryParams, limit, offset);

  const statsConditions =
    conditions.length > 0
      ? conditions.join(" AND ") + " AND p.is_active = 1"
      : "p.is_active = 1";
  const statsParams = conditions.length > 0 ? [...queryParams] : [];

  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as totalCount,
      COALESCE(SUM(p.price * p.stock), 0) as totalValue,
      SUM(CASE WHEN p.stock <= COALESCE(p.min_stock, 5) THEN 1 ELSE 0 END) as lowStockCount,
      SUM(CASE WHEN p.discount_percent > 0 THEN 1 ELSE 0 END) as discountedCount
    FROM products p WHERE ${statsConditions}
  `,
    )
    .get(...statsParams);

  return { products, total, stats };
});

ipcMain.handle("get-all-products", async () => {
  const products = db
    .prepare(
      `
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.name ASC
  `,
    )
    .all();

  return { products };
});

ipcMain.handle("get-next-barcode", async () => {
  const { m } = db
    .prepare(
      `SELECT MAX(CAST(barcode AS INTEGER)) AS m FROM products WHERE barcode GLOB '2[0-9]*'`,
    )
    .get();
  return String(Math.max(m || 0, 1999999999) + 1);
});

ipcMain.handle("check-barcode-exists", async (event, barcode) => {
  if (!barcode) return { exists: false };
  const row = db
    .prepare("SELECT id, name, is_active FROM products WHERE barcode = ?")
    .get(String(barcode).trim());
  if (!row) return { exists: false };
  return {
    exists: true,
    active: row.is_active === 1,
    name: row.name,
    id: row.id,
  };
});

ipcMain.handle("add-product", async (event, product) => {
  const {
    barcode,
    name,
    brand,
    price,
    stock,
    category_id,
    supplier_id,
    expiry_date,
    image_path,
    cost_price,
    min_stock,
    discount_percent,
    has_discount,
    sale_unit,
    box_qty,
    box_price,
  } = product;
  try {
    const existing = db
      .prepare("SELECT id, is_active FROM products WHERE barcode = ?")
      .get(barcode);
    if (existing && existing.is_active)
      return {
        success: false,
        error: "Ya existe un producto con este código de barras",
      };

    if (existing) {
      const stmt = db.prepare(`UPDATE products SET
        name=?, brand=?, price=?, stock=?, category_id=?, supplier_id=?,
        expiry_date=?, image_path=?, cost_price=?, min_stock=?, discount_percent=?, has_discount=?, is_active=1, sale_unit=?, box_qty=?, box_price=?
        WHERE id=?`);
      stmt.run(
        name,
        brand,
        price,
        stock || 0,
        category_id || null,
        supplier_id || null,
        expiry_date || null,
        image_path || null,
        cost_price || 0,
        min_stock || 5,
        discount_percent || 0,
        has_discount ? 1 : 0,
        sale_unit || "piece",
        box_qty || 0,
        box_price || 0,
        existing.id,
      );
      return { success: true, id: existing.id, overwritten: true };
    }

    const stmt = db.prepare(`INSERT INTO products
      (barcode, name, brand, price, stock, category_id, supplier_id, expiry_date, image_path, cost_price, min_stock, discount_percent, has_discount, sale_unit, box_qty, box_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      barcode,
      name,
      brand,
      price,
      stock || 0,
      category_id || null,
      supplier_id || null,
      expiry_date || null,
      image_path || null,
      cost_price || 0,
      min_stock || 5,
      discount_percent || 0,
      has_discount ? 1 : 0,
      sale_unit || "piece",
      box_qty || 0,
      box_price || 0,
    );
    return { success: true, id: info.lastInsertRowid };
  } catch (error) {
    let msg = error.message;
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      msg = "Ya existe un producto con este código de barras";
    return { success: false, error: msg };
  }
});

ipcMain.handle("update-product", async (event, id, product) => {
  try {
    if (!product || !id) return { success: false, error: "Datos inválidos" };
    const {
      barcode,
      name,
      brand,
      price,
      stock,
      category_id,
      supplier_id,
      expiry_date,
      image_path,
      cost_price,
      min_stock,
      discount_percent,
      has_discount,
      is_active,
      sale_unit,
      box_qty,
      box_price,
    } = product;

    const dup = db
      .prepare("SELECT id FROM products WHERE barcode = ? AND id != ?")
      .get(barcode, id);
    if (dup)
      return {
        success: false,
        error: "Ya existe otro producto con este código de barras",
      };

    const stmt = db.prepare(`UPDATE products SET
      barcode=?, name=?, brand=?, price=?, stock=?, category_id=?, supplier_id=?,
      expiry_date=?, image_path=?, cost_price=?, min_stock=?, discount_percent=?, has_discount=?, is_active=?, sale_unit=?, box_qty=?, box_price=?
      WHERE id=?`);
    const info = stmt.run(
      barcode || "",
      name,
      brand,
      price,
      stock,
      category_id || null,
      supplier_id || null,
      expiry_date || null,
      image_path || null,
      cost_price || 0,
      min_stock || 5,
      discount_percent || 0,
      has_discount ? 1 : 0,
      is_active !== undefined ? is_active : 1,
      sale_unit || "piece",
      box_qty || 0,
      box_price || 0,
      id,
    );
    return info.changes > 0
      ? { success: true }
      : { success: false, error: "Producto no encontrado" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-product", async (event, productId) => {
  try {
    const info = db
      .prepare("UPDATE products SET is_active = 0 WHERE id = ?")
      .run(productId);
    return { success: true, changes: info.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-product-by-barcode", async (event, barcode) => {
  try {
    const product = db
      .prepare("SELECT * FROM products WHERE barcode = ? AND is_active = 1")
      .get(barcode);
    return { success: !!product, product };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("search-products", async (event, query) => {
  try {
    return db
      .prepare(
        `
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.name LIKE ? OR p.barcode LIKE ?) AND p.is_active = 1
      ORDER BY p.name LIMIT 10
    `,
      )
      .all(`%${query}%`, `%${query}%`);
  } catch (error) {
    return [];
  }
});

ipcMain.handle("get-top-products", async () => {
  try {
    return db
      .prepare(
        `
      SELECT p.*, c.name as category_name, COALESCE(SUM(si.quantity),0) as total_sold
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND (s.status IS NULL OR s.status != 'cancelado')
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 20
    `,
      )
      .all();
  } catch (error) {
    return [];
  }
});

// ─── CATEGORIES ─────────────────────────────────────────────

ipcMain.handle("get-categories", async () => {
  return db
    .prepare(
      `
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `,
    )
    .all();
});

ipcMain.handle("add-category", async (event, data) => {
  try {
    const info = db
      .prepare("INSERT INTO categories (name, description) VALUES (?, ?)")
      .run(data.name, data.description || "");
    return { success: true, id: info.lastInsertRowid };
  } catch (error) {
    return {
      success: false,
      error:
        error.code === "SQLITE_CONSTRAINT_UNIQUE"
          ? "Ya existe una categoría con ese nombre"
          : error.message,
    };
  }
});

ipcMain.handle("update-category", async (event, id, data) => {
  try {
    db.prepare("UPDATE categories SET name=?, description=? WHERE id=?").run(
      data.name,
      data.description || "",
      id,
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-category", async (event, id) => {
  try {
    const linked = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE category_id = ?")
      .get(id);
    if (linked.count > 0)
      return {
        success: false,
        error: `No se puede eliminar: ${linked.count} producto(s) usan esta categoría`,
      };
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── SUPPLIERS ──────────────────────────────────────────────

ipcMain.handle("get-suppliers", async () => {
  return db
    .prepare(
      `
    SELECT s.*, COUNT(p.id) as product_count
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.supplier_id
    GROUP BY s.id
    ORDER BY s.name
  `,
    )
    .all();
});

ipcMain.handle("add-supplier", async (event, data) => {
  try {
    const info = db
      .prepare(
        "INSERT INTO suppliers (name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        data.name,
        data.contact || "",
        data.phone || "",
        data.email || "",
        data.address || "",
      );
    return { success: true, id: info.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-supplier", async (event, id, data) => {
  try {
    db.prepare(
      "UPDATE suppliers SET name=?, contact=?, phone=?, email=?, address=? WHERE id=?",
    ).run(
      data.name,
      data.contact || "",
      data.phone || "",
      data.email || "",
      data.address || "",
      id,
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-supplier", async (event, id) => {
  try {
    const linked = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE supplier_id = ?")
      .get(id);
    if (linked.count > 0)
      return {
        success: false,
        error: `No se puede eliminar: ${linked.count} producto(s) usan este proveedor`,
      };
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── STOCK MOVEMENTS ────────────────────────────────────────

ipcMain.handle("add-stock", async (event, { productId, quantity, cost }) => {
  const txn = db.transaction(() => {
    const product = db
      .prepare("SELECT name, cost_price FROM products WHERE id = ?")
      .get(productId);
    if (!product) throw new Error("Producto no encontrado");

    const effectiveCost = (cost && parseFloat(cost) > 0)
      ? parseFloat(cost)
      : (product.cost_price || 0) * quantity;

    db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(
      quantity,
      productId,
    );
    db.prepare(
      "INSERT INTO stock_movements (product_id, type, quantity, cost, notes) VALUES (?, 'in', ?, ?, ?)",
    ).run(productId, quantity, effectiveCost, "Compra de inventario");

    // Register the cost as an expense (even if no cash register is open)
    const todayMX = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Mexico_City",
    });
    const openReg = db
      .prepare(
        "SELECT id FROM cash_register WHERE date = ? AND status = 'open'",
      )
      .get(todayMX);
    if (effectiveCost > 0) {
      if (openReg) {
        db.prepare(
          "UPDATE cash_register SET expenses = COALESCE(expenses, 0) + ? WHERE id = ?",
        ).run(effectiveCost, openReg.id);
      }
      db.prepare(
        "INSERT INTO cash_register_expenses (register_id, amount, reason) VALUES (?, ?, ?)",
      ).run(openReg ? openReg.id : null, effectiveCost, `Compra de inventario: ${product.name}`);
    }

    return { productName: product.name };
  });
  try {
    const result = txn();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "adjust-stock",
  async (event, { productId, quantity, notes }) => {
    const txn = db.transaction(() => {
      const product = db
        .prepare("SELECT name FROM products WHERE id = ?")
        .get(productId);
      if (!product) throw new Error("Producto no encontrado");
      db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(
        quantity,
        productId,
      );
      const oldStock = db
        .prepare("SELECT stock FROM products WHERE id = ?")
        .get(productId);
      const diff = quantity - oldStock.stock;
      const type = diff >= 0 ? "in" : "out";
      db.prepare(
        "INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES (?, ?, ?, ?)",
      ).run(productId, type, Math.abs(diff), notes || "Ajuste manual");
    });
    try {
      txn();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "get-stock-movements",
  async (event, { productId, type, startDate, endDate } = {}) => {
    try {
      let sql = `SELECT sm.*, p.name as product_name, p.barcode
               FROM stock_movements sm
               JOIN products p ON sm.product_id = p.id
               WHERE 1=1`;
      const params = [];
      if (productId) {
        sql += " AND sm.product_id = ?";
        params.push(productId);
      }
      if (type) {
        sql += " AND sm.type = ?";
        params.push(type);
      }
      if (startDate) {
        sql += " AND sm.created_at >= ?";
        params.push(startDate);
      }
      if (endDate) {
        sql += " AND sm.created_at <= ?";
        params.push(endDate);
      }
      sql += " ORDER BY sm.created_at DESC LIMIT 500";
      return db.prepare(sql).all(...params);
    } catch (error) {
      return [];
    }
  },
);

// ─── SALES ──────────────────────────────────────────────────

ipcMain.handle(
  "record-sale",
  async (event, { cart, total, paymentMethod, discountTotal, cashierName }) => {
    const recordSale = db.transaction(() => {
      // Link to open register if exists (use MX date for lookup)
      const todayMX = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Mexico_City",
      });
      const openReg = db
        .prepare(
          "SELECT id FROM cash_register WHERE date = ? AND status = 'open'",
        )
        .get(todayMX);
      const registerId = openReg ? openReg.id : null;

      const saleStmt = db.prepare(
        "INSERT INTO sales (total, payment_method, discount_total, register_id, cashier_name) VALUES (?, ?, ?, ?, ?)",
      );
      const saleInfo = saleStmt.run(
        total,
        paymentMethod || "cash",
        discountTotal || 0,
        registerId,
        cashierName || "Usuario Principal",
      );
      const saleId = saleInfo.lastInsertRowid;

      const itemStmt = db.prepare(
        "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price_at_sale, discount_percent, stock_deducted) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      const stockStmt = db.prepare(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
      );

      for (const item of cart) {
        // Manual items: null product_id, skip stock update
        // Normal items: use numeric id, update stock
        const isManual = item.isManual || typeof item.id !== "number";
        const productId = isManual ? null : item.id;
        const productName = item.name || (isManual ? "Producto manual" : null);
        let stockDeducted = 0;
        if (!isManual) {
          stockDeducted = item.isBoxItem
            ? item.quantity * (item.box_qty || 1)
            : item.quantity;
        }
        itemStmt.run(
          saleId,
          productId,
          productName,
          item.quantity,
          item.finalPrice || item.price,
          item.discount_percent || 0,
          stockDeducted,
        );
        if (!isManual) {
          stockStmt.run(stockDeducted, item.id);
        }
      }
      return { success: true, saleId };
    });

    try {
      return recordSale();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "cancel-sale",
  async (event, { saleId, cashierName, reason }) => {
    try {
      if (!saleId) return { success: false, error: "Venta inválida" };
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
      if (!sale) return { success: false, error: "Venta no encontrada" };
      if (sale.status === "cancelado")
        return { success: false, error: "Esta venta ya fue cancelada" };

      const today = new Date().toISOString().slice(0, 10);
      const reg = db
        .prepare("SELECT date, status FROM cash_register WHERE id = ?")
        .get(sale.register_id);
      if (!reg || reg.status !== "open" || reg.date !== today)
        return {
          success: false,
          error: "Solo puedes cancelar ventas de la caja abierta de hoy",
        };

      const doCancel = db.transaction(() => {
        db.prepare(
          "UPDATE sales SET status='cancelado', cancelled_at=CURRENT_TIMESTAMP, cancelled_by=? WHERE id=?",
        ).run(cashierName || null, saleId);
        const items = db
          .prepare(
            "SELECT product_id, stock_deducted FROM sale_items WHERE sale_id = ?",
          )
          .all(saleId);
        const restoreStmt = db.prepare(
          "UPDATE products SET stock = stock + ? WHERE id = ?",
        );
        const movStmt = db.prepare(
          "INSERT INTO stock_movements (product_id, type, quantity, reference, notes) VALUES (?, 'in', ?, ?, ?)",
        );
        for (const it of items) {
          if (it.product_id && (it.stock_deducted || 0) > 0) {
            restoreStmt.run(it.stock_deducted, it.product_id);
            movStmt.run(
              it.product_id,
              it.stock_deducted,
              `Cancelación venta #${saleId}`,
              reason || "",
            );
          }
        }
      });
      doCancel();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

const MX_UTC_OFFSET = 6;

function toUTCDateRange(mxDateStr) {
  const start = `${mxDateStr} ${String(MX_UTC_OFFSET).padStart(2, "0")}:00:00`;
  const [y, m, d] = mxDateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const end = `${nextStr} ${String(MX_UTC_OFFSET).padStart(2, "0")}:00:00`;
  return { start, end };
}

ipcMain.handle(
  "get-sales-for-today",
  async (event, { date, registerId } = {}) => {
    try {
      const today = date || new Date().toISOString().slice(0, 10);
      const { start, end } = toUTCDateRange(today);
      let sales;
      if (registerId) {
        sales = db
          .prepare(
            "SELECT * FROM sales WHERE created_at >= ? AND created_at < ? AND register_id = ? ORDER BY created_at DESC",
          )
          .all(start, end, registerId);
      } else {
        sales = db
          .prepare(
            "SELECT * FROM sales WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC",
          )
          .all(start, end);
      }
      return { success: true, sales };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("get-sales-by-range", async (event, { startDate, endDate }) => {
  try {
    const { start } = toUTCDateRange(startDate);
    const { end } = toUTCDateRange(endDate);
    const sales = db
      .prepare(
        "SELECT * FROM sales WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC",
      )
      .all(start, end);
    const total = db
      .prepare(
        "SELECT COALESCE(SUM(total),0) as total FROM sales WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado')",
      )
      .get(start, end).total;
    const count = sales.filter(
      (s) => s.status !== "cancelado",
    ).length;
    const byMethod = db
      .prepare(
        "SELECT payment_method, COUNT(*) as count, SUM(total) as total FROM sales WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado') GROUP BY payment_method",
      )
      .all(start, end);
    return { success: true, sales, total, count, byMethod };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-sale-details", async (event, saleId) => {
  try {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    const items = db
      .prepare(
        `
      SELECT si.*, COALESCE(p.name, si.product_name) AS name, p.barcode FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
      )
      .all(saleId);
    return { success: true, sale, items };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-sales-by-date", async (event, { date }) => {
  try {
    const { start, end } = toUTCDateRange(date);
    const sales = db
      .prepare(
        "SELECT * FROM sales WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC",
      )
      .all(start, end);
    const total = db
      .prepare(
        "SELECT COALESCE(SUM(total),0) as total FROM sales WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado')",
      )
      .get(start, end).total;
    const count = sales.filter(
      (s) => s.status !== "cancelado",
    ).length;
    const byMethod = db
      .prepare(
        "SELECT payment_method, COUNT(*) as count, SUM(total) as total FROM sales WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado') GROUP BY payment_method",
      )
      .all(start, end);
    return { success: true, sales, total, count, byMethod };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "get-expenses-by-range",
  async (event, { startDate, endDate }) => {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const expenses = db
        .prepare(
          `
      SELECT e.*, cr.name as register_name
      FROM cash_register_expenses e
      LEFT JOIN cash_register cr ON e.register_id = cr.id
      WHERE e.created_at >= ? AND e.created_at <= ?
      ORDER BY e.created_at DESC
    `,
        )
        .all(start.toISOString(), end.toISOString());
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      return { success: true, expenses, totalExpenses, count: expenses.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("get-expenses-by-date", async (event, { date }) => {
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const expenses = db
      .prepare(
        `
      SELECT e.*, cr.name as register_name
      FROM cash_register_expenses e
      LEFT JOIN cash_register cr ON e.register_id = cr.id
      WHERE e.created_at >= ? AND e.created_at <= ?
      ORDER BY e.created_at DESC
    `,
      )
      .all(start.toISOString(), end.toISOString());
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    return { success: true, expenses, totalExpenses, count: expenses.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── SETTINGS ───────────────────────────────────────────────

ipcMain.handle("get-setting", async (event, key) => {
  try {
    const setting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key);
    return setting ? setting.value : null;
  } catch (error) {
    return null;
  }
});

ipcMain.handle("save-setting", async (event, key, value) => {
  try {
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ).run(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-all-settings", async () => {
  try {
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  } catch (error) {
    return {};
  }
});

ipcMain.handle("get-server-status", () => {
  const api = apiServer.getStatus();
  return {
    running: api.running,
    port: api.port || 3456,
  };
});

// ─── CASHIERS ────────────────────────────────────────────────

ipcMain.handle("get-cashiers", async () => {
  try {
    return db
      .prepare("SELECT id, name, role, is_active FROM cashiers ORDER BY name")
      .all();
  } catch (error) {
    return [];
  }
});

ipcMain.handle("add-cashier", async (event, cashier) => {
  try {
    const info = db
      .prepare(
        "INSERT INTO cashiers (name, pin, role, is_active) VALUES (?, ?, ?, ?)",
      )
      .run(cashier.name, cashier.pin || "0000", cashier.role || "cashier", 1);
    return { success: true, id: info.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-cashier", async (event, id, cashier) => {
  try {
    db.prepare(
      "UPDATE cashiers SET name=?, pin=?, role=?, is_active=? WHERE id=?",
    ).run(
      cashier.name,
      cashier.pin,
      cashier.role || "cashier",
      cashier.is_active,
      id,
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("verify-cashier-pin", async (event, id, pin) => {
  try {
    const cashier = db
      .prepare(
        "SELECT id, name, pin, role FROM cashiers WHERE id = ? AND is_active = 1",
      )
      .get(id);
    if (!cashier) return { success: false, error: "Cajero no encontrado" };
    if (cashier.pin !== pin) return { success: false, error: "PIN incorrecto" };
    return {
      success: true,
      cashier: { id: cashier.id, name: cashier.name, role: cashier.role },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-cashier", async (event, id) => {
  try {
    db.prepare("DELETE FROM cashiers WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("is-first-time", async () => {
  try {
    const setting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("store_name");
    return !setting;
  } catch (error) {
    return true;
  }
});

// ─── CASH REGISTER ──────────────────────────────────────────

ipcMain.handle(
  "register-cash-expense",
  async (event, { amount, reason, cashierId, role }) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let register;
      if (role === "admin") {
        register = db
          .prepare(
            "SELECT id, expenses FROM cash_register WHERE date = ? AND status = 'open'",
          )
          .get(today);
      } else if (cashierId) {
        register = db
          .prepare(
            "SELECT id, expenses FROM cash_register WHERE date = ? AND status = 'open' AND cashier_id = ?",
          )
          .get(today, cashierId);
      }
      if (!register)
        return { success: false, error: "No hay caja abierta para ti hoy" };

      const newExpenses = (register.expenses || 0) + amount;
      db.prepare("UPDATE cash_register SET expenses = ? WHERE id = ?").run(
        newExpenses,
        register.id,
      );
      db.prepare(
        "INSERT INTO cash_register_expenses (register_id, amount, reason) VALUES (?, ?, ?)",
      ).run(register.id, amount, reason);
      return { success: true, expenses: newExpenses };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "get-cash-register-status",
  async (event, { cashierId, role } = {}) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let register;
      if (role === "admin") {
        register = db
          .prepare(
            "SELECT * FROM cash_register WHERE date = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
          )
          .get(today);
      } else if (cashierId) {
        register = db
          .prepare(
            "SELECT * FROM cash_register WHERE date = ? AND status = 'open' AND cashier_id = ? ORDER BY id DESC LIMIT 1",
          )
          .get(today, cashierId);
      }
      if (!register) {
        register = db
          .prepare(
            "SELECT * FROM cash_register WHERE date = ? ORDER BY id DESC LIMIT 1",
          )
          .get(today);
      }
      if (register) {
        const opener = db
          .prepare("SELECT name, role FROM cashiers WHERE id = ?")
          .get(register.opened_by);
        register.opener_name = opener?.name || null;
        register.opener_role = opener?.role || null;
      }
      return { success: true, register };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "open-cash-register",
  async (event, { openingBalance, cashierId, role }) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (role === "admin") {
        const existing = db
          .prepare(
            "SELECT id FROM cash_register WHERE date = ? AND status = 'open'",
          )
          .get(today);
        if (existing)
          return { success: false, error: "Ya hay una caja abierta hoy" };
      } else if (cashierId) {
        const existing = db
          .prepare(
            "SELECT id FROM cash_register WHERE date = ? AND status = 'open' AND cashier_id = ?",
          )
          .get(today, cashierId);
        if (existing)
          return { success: false, error: "Ya tienes una caja abierta" };
      }

      db.prepare(
        "INSERT INTO cash_register (date, opening_balance, cashier_id, opened_by) VALUES (?, ?, ?, ?)",
      ).run(today, openingBalance || 0, cashierId || null, cashierId || null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "close-cash-register",
  async (event, { declaredClose, expenses, name, cashierId, role }) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const register = db
        .prepare(
          `SELECT cr.*, c.role AS opener_role
           FROM cash_register cr
           LEFT JOIN cashiers c ON cr.opened_by = c.id
           WHERE cr.date = ? AND cr.status = 'open'`,
        )
        .get(today);
      if (!register)
        return { success: false, error: "No hay caja abierta hoy" };

      const openerIsAdmin = register.opener_role === "admin";
      const isOwnRegister =
        String(register.opened_by) === String(cashierId) ||
        String(register.cashier_id) === String(cashierId);
      if (role !== "admin" && !openerIsAdmin && !isOwnRegister) {
        return {
          success: false,
          error: "No hay caja abierta que puedas cerrar hoy",
        };
      }

      // Get today's sales by payment method (only for this register)
      const sales = db
        .prepare(
          "SELECT payment_method, SUM(total) as total FROM sales WHERE date(created_at) = ? AND register_id = ? AND (status IS NULL OR status != 'cancelado') GROUP BY payment_method",
        )
        .all(today, register.id);
      const cashSales =
        sales.find((s) => s.payment_method === "cash")?.total || 0;
      const cardSales =
        sales.find((s) => s.payment_method === "card")?.total || 0;
      const transferSales =
        sales.find((s) => s.payment_method === "transfer")?.total || 0;
      const totalExpenses = (register.expenses || 0) + (expenses || 0);
      const expectedClose =
        register.opening_balance + cashSales - totalExpenses;
      const difference = (declaredClose || 0) - expectedClose;

      db.prepare(
        `UPDATE cash_register SET
      cash_sales=?, card_sales=?, transfer_sales=?, expenses=?,
      expected_close=?, declared_close=?, difference=?, name=?, status='closed', closed_at=CURRENT_TIMESTAMP, closed_by=?
      WHERE id=?`,
      ).run(
        cashSales,
        cardSales,
        transferSales,
        totalExpenses,
        expectedClose,
        declaredClose || 0,
        difference,
        name || null,
        cashierId || null,
        register.id,
      );

      return { success: true, expectedClose, difference };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "get-closed-registers",
  async (event, { cashierId, role } = {}) => {
    try {
      let query = `
      SELECT cr.*,
        opener.name AS opener_name,
        closer.name AS closer_name,
        (SELECT COUNT(*) FROM sales WHERE register_id = cr.id AND (status IS NULL OR status != 'cancelado')) as sale_count,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.register_id = cr.id AND (s.status IS NULL OR s.status != 'cancelado')) as total_items,
        (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.register_id = cr.id AND (s.status IS NULL OR s.status != 'cancelado')) as total_sales
      FROM cash_register cr
      LEFT JOIN cashiers opener ON cr.opened_by = opener.id
      LEFT JOIN cashiers closer ON cr.closed_by = closer.id
      WHERE cr.status = 'closed'
    `;
      const params = [];

      if (role !== "admin" && cashierId) {
        query += ` AND cr.closed_by = ? AND cr.closed_at >= datetime('now', '-7 days')`;
        params.push(cashierId);
      }

      query += ` ORDER BY cr.closed_at DESC`;

      const registers = db.prepare(query).all(...params);
      return { success: true, registers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle(
  "get-cash-register-expenses",
  async (event, { cashierId, role } = {}) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let register;
      if (role === "admin") {
        register = db
          .prepare(
            "SELECT id FROM cash_register WHERE date = ? AND status = 'open'",
          )
          .get(today);
      } else if (cashierId) {
        register = db
          .prepare(
            "SELECT id FROM cash_register WHERE date = ? AND status = 'open' AND cashier_id = ?",
          )
          .get(today, cashierId);
      }
      if (!register) return { success: true, expenses: [] };
      const expenses = db
        .prepare(
          "SELECT * FROM cash_register_expenses WHERE register_id = ? ORDER BY created_at DESC",
        )
        .all(register.id);
      return { success: true, expenses };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("get-register-sales-detail", async (event, registerId) => {
  try {
    const register = db
      .prepare(
        `
      SELECT cr.*, opener.name AS opener_name, closer.name AS closer_name
      FROM cash_register cr
      LEFT JOIN cashiers opener ON cr.opened_by = opener.id
      LEFT JOIN cashiers closer ON cr.closed_by = closer.id
      WHERE cr.id = ?
    `,
      )
      .get(registerId);
    if (!register) return { success: false, error: "Caja no encontrada" };

    const sales = db
      .prepare(
        "SELECT * FROM sales WHERE register_id = ? ORDER BY created_at DESC",
      )
      .all(registerId);

    const items = db
      .prepare(
        `
      SELECT si.*, s.status, COALESCE(p.name, si.product_name) AS product_name, p.barcode, s.created_at as sale_created_at
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE s.register_id = ?
      ORDER BY s.created_at DESC
    `,
      )
      .all(registerId);

    const expenses = db
      .prepare(
        "SELECT * FROM cash_register_expenses WHERE register_id = ? ORDER BY created_at DESC",
      )
      .all(registerId);

    const activeSales = sales.filter((s) => s.status !== "cancelado");
    const activeItems = items.filter((i) => i.status !== "cancelado");
    const totalSales = activeSales.reduce((sum, s) => sum + s.total, 0);
    const totalItems = activeItems.reduce((sum, i) => sum + i.quantity, 0);
    const saleCount = activeSales.length;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      success: true,
      register,
      sales,
      items,
      expenses,
      totalSales,
      totalItems,
      saleCount,
      totalExpenses,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── VENTAS SEMANALES ────────────────────────────────────────
ipcMain.handle("get-weekly-sales", async (event, { weeks = 12 }) => {
  try {
    const weeksAgo = new Date();
    weeksAgo.setDate(weeksAgo.getDate() - weeks * 7);
    const start = weeksAgo.toISOString().slice(0, 10);

    const rows = db
      .prepare(
        `SELECT strftime('%Y-%W', created_at) as week_key,
                strftime('%Y-%m-%d', MIN(created_at)) as week_start,
                SUM(total) as total,
                COUNT(*) as count
         FROM sales
         WHERE created_at >= ? AND (status IS NULL OR status != 'cancelado')
         GROUP BY week_key
         ORDER BY week_key ASC`,
      )
      .all(start);

    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── VENTAS DIARIAS POR SEMANA ──────────────────────────────
ipcMain.handle("get-daily-sales-week", async (event, { startDate, endDate }) => {
  try {
    const rows = db
      .prepare(
        `SELECT DATE(created_at) as date,
                SUM(total) as total,
                COUNT(*) as count
         FROM sales
         WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado')
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
      )
      .all(startDate, endDate);
    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── VENTAS SEMANALES POR MES ───────────────────────────────
ipcMain.handle("get-weekly-sales-range", async (event, { startDate, endDate }) => {
  try {
    const rows = db
      .prepare(
        `SELECT strftime('%Y-%W', created_at) as week_key,
                strftime('%Y-%m-%d', MIN(created_at)) as week_start,
                SUM(total) as total,
                COUNT(*) as count
         FROM sales
         WHERE created_at >= ? AND created_at < ? AND (status IS NULL OR status != 'cancelado')
         GROUP BY week_key
         ORDER BY week_key ASC`,
      )
      .all(startDate, endDate);
    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── BACKUP ──────────────────────────────────────────────────

ipcMain.handle("create-backup", async () => {
  try {
    const backupDir = path.join(dbDir, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `pos-backup-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    const stats = fs.statSync(backupPath);
    return {
      success: true,
      path: backupPath,
      size: stats.size,
      name: path.basename(backupPath),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-backups", async () => {
  try {
    const backupDir = path.join(dbDir, "backups");
    if (!fs.existsSync(backupDir)) return [];
    return fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const fp = path.join(backupDir, f);
        const stats = fs.statSync(fp);
        return { name: f, path: fp, size: stats.size, date: stats.mtime };
      })
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    return [];
  }
});

ipcMain.handle("restore-backup", async (event, backupPath) => {
  try {
    if (!fs.existsSync(backupPath))
      return { success: false, error: "Archivo de respaldo no encontrado" };
    // Close all statements
    db.close();
    fs.copyFileSync(backupPath, dbPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── TAREAS (TASKS) ─────────────────────────────────────────
const notifiedTasks = new Set();

ipcMain.handle("add-task", async (event, { title, description, taskDate, taskTime, reminderMinutes }) => {
  try {
    const stmt = db.prepare("INSERT INTO tasks (title, description, task_date, task_time, reminder_minutes) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(title, description || "", taskDate, taskTime || null, reminderMinutes || 30);
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-task", async (event, { id, title, description, taskDate, taskTime, reminderMinutes }) => {
  try {
    db.prepare("UPDATE tasks SET title = ?, description = ?, task_date = ?, task_time = ?, reminder_minutes = ? WHERE id = ?")
      .run(title, description || "", taskDate, taskTime || null, reminderMinutes || 30, id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-task", async (event, id) => {
  try {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-tasks-by-date", async (event, date) => {
  try {
    const tasks = db.prepare("SELECT * FROM tasks WHERE task_date = ? ORDER BY task_time ASC").all(date);
    return { success: true, tasks };
  } catch (error) {
    return { success: false, error: error.message, tasks: [] };
  }
});

ipcMain.handle("get-today-tasks", async () => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const tasks = db.prepare("SELECT * FROM tasks WHERE task_date = ? AND completed = 0 ORDER BY task_time ASC").all(today);
    return { success: true, tasks };
  } catch (error) {
    return { success: false, error: error.message, tasks: [] };
  }
});

ipcMain.handle("complete-task", async (event, id) => {
  try {
    db.prepare("UPDATE tasks SET completed = 1 WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── BASCULA (SCALE) ────────────────────────────────────────

const { execSync, spawn } = require("child_process");

let scaleConnected = false;
let scalePortPath = "";
let scaleProcess = null;

const psReadWeight = (port, baud) => {
  const script = `
    $port = New-Object System.IO.Ports.SerialPort "${port}", ${baud}, None, 8, One
    $port.ReadTimeout = 100
    $port.Open()
    Start-Sleep -Milliseconds 200
    $port.DiscardInBuffer()
    $port.Write("P")
    $data = ""
    $deadline = (Get-Date).AddSeconds(3)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 50
      while ($port.BytesToRead -gt 0) {
        $data += [char]$port.ReadByte()
      }
      if ($data -match "\\r" -or $data -match "\\n") { break }
    }
    $port.Close()
    Write-Output $data
  `;
  const tmpFile = path.join(app.getPath("userData"), "scale-read.ps1");
  fs.writeFileSync(tmpFile, script, "utf-8");
  try {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      {
        encoding: "utf-8",
        timeout: 8000,
      },
    ).trim();
    return result;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
};

const psContinuousScript = (port, baud) => `
  $port = New-Object System.IO.Ports.SerialPort "${port}", ${baud}, None, 8, One
  $port.ReadTimeout = -1
  $port.Open()
  Start-Sleep -Milliseconds 200
  $port.DiscardInBuffer()
  while ($true) {
    if ($port.BytesToRead -eq 0) {
      try { $port.Write("P") } catch { break }
    }
    $data = ""
    while ($port.BytesToRead -gt 0) {
      try {
        $bytes = $port.ReadByte()
        if ($bytes -eq 13 -or $bytes -eq 10) {
          if ($data.Length -gt 0) {
            Write-Output $data
            $data = ""
          }
        } else {
          $data += [char]$bytes
        }
      } catch { break }
    }
    if ($data.Length -gt 0) {
      Write-Output $data
    }
    Start-Sleep -Milliseconds 50
  }
`;

ipcMain.handle("list-serial-ports", async () => {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames() | ForEach-Object { \\"\\"" + $_ + \\"\\"" }"`,
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    if (!result) return [];
    const names = result.split(/\r?\n/).filter(Boolean);
    return names.map((p) => ({
      path: p.trim(),
      manufacturer: "",
      friendlyName: p.trim(),
    }));
  } catch (error) {
    return [];
  }
});

ipcMain.handle("connect-scale", async (event, portPath, baudRate = 115200) => {
  try {
    psReadWeight(portPath, parseInt(baudRate));
    scaleConnected = true;
    scalePortPath = portPath;
    return { success: true };
  } catch (error) {
    scaleConnected = false;
    scalePortPath = "";
    return { success: false, error: error.message || "No se pudo conectar" };
  }
});

ipcMain.handle("read-weight", async () => {
  if (!scaleConnected || !scalePortPath) {
    return { success: false, error: "Bascula no conectada" };
  }
  try {
    const raw = psReadWeight(scalePortPath, 115200);
    const match = raw.match(/(-?\d+\.?\d*)/);
    if (match) {
      return { success: true, weight: parseFloat(match[1]), raw };
    }
    return { success: false, error: "No se pudo leer el peso", raw };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("disconnect-scale", async () => {
  if (scaleProcess) {
    scaleProcess.kill();
    scaleProcess = null;
  }
  scaleConnected = false;
  scalePortPath = "";
  return { success: true };
});

ipcMain.handle(
  "start-weight-stream",
  async (event, portPath, baudRate = 115200) => {
    try {
      if (scaleProcess) {
        scaleProcess.kill();
        scaleProcess = null;
      }
      const script = psContinuousScript(portPath, parseInt(baudRate));
      const tmpFile = path.join(app.getPath("userData"), "scale-stream.ps1");
      fs.writeFileSync(tmpFile, script, "utf-8");
      scaleProcess = spawn("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        tmpFile,
      ]);
      scaleConnected = true;
      scalePortPath = portPath;
      scaleProcess.stderr.on("data", (data) => {
        console.error("[SCALE STDERR]", String(data).trim());
      });
      scaleProcess.on("error", (err) => {
        console.error("[SCALE ERROR]", err.message);
        scaleConnected = false;
        scaleProcess = null;
      });
      scaleProcess.on("close", (code) => {
        console.log("[SCALE CLOSED] code:", code);
        scaleConnected = false;
        scaleProcess = null;
      });
      const win = BrowserWindow.getAllWindows()[0];
      scaleProcess.stdout.on("data", (data) => {
        const lines = String(data).split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const match = line.match(/(-?\d+\.?\d*)/);
          if (match && win && !win.isDestroyed()) {
            win.webContents.send("weight-update", {
              weight: parseFloat(match[1]),
              raw: line.trim(),
            });
          }
        }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("stop-weight-stream", async () => {
  if (scaleProcess) {
    scaleProcess.kill();
    scaleProcess = null;
  }
  return { success: true };
});

ipcMain.handle("is-scale-connected", async () => {
  return { connected: scaleConnected };
});

// ─── IMPRESION DE TICKETS (WINDOWS SPOOLER + POS58 DRIVER) ───────
const { BrowserWindow: BW } = require("electron");

ipcMain.handle("print-receipt", async (event, htmlContent) => {
  let printWin = null;
  try {
    // Verifica el nombre EXACTO de la impresora antes de imprimir
    const printers =
      (await BW.getFocusedWindow()?.webContents.getPrintersAsync?.()) ?? [];
    console.log(
      "[PRINT] Impresoras detectadas:",
      printers.map((p) => p.name),
    );

    printWin = new BW({
      show: false,
      width: 220,
      height: 700,
      backgroundColor: "#ffffff",
    });

    await printWin.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    const printPromise = new Promise((resolve, reject) => {
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: "GHIA-GTP582",
          margins: { marginType: "none" },
          pageSize: { width: 58000, height: 200000 },
        },
        (success, errorType) => {
          if (success) resolve(true);
          else
            reject(
              new Error(
                errorType || "No se pudo enviar el trabajo de impresión",
              ),
            );
        },
      );
    });

    // Timeout de seguridad: si el callback nunca regresa, no te quedes colgado
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error("TIMEOUT: el callback de print nunca respondió")),
        8000,
      ),
    );

    const printed = await Promise.race([printPromise, timeoutPromise]);

    if (!printed) {
      throw new Error("La impresión no fue aceptada por el spooler");
    }

    console.log("[PRINT] Completado OK");
    return { success: true };
  } catch (error) {
    console.error("[PRINT ERROR]", error.message);
    return { success: false, error: error.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) {
      printWin.destroy();
    }
  }
});

// ─── APERTURA DE CAJON (CASH DRAWER) ─────────────────────
ipcMain.handle("open-cash-drawer", async () => {
  try {
    const { execSync } = require("child_process");
    const tmpFile = path.join(app.getPath("temp"), `drawer-${Date.now()}.ps1`);
    const psCode = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Drawer {
    [DllImport("winspool.drv")]
    public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv")]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv")]
    public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFO d);
    [DllImport("winspool.drv")]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv")]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv")]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv")]
    public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
    public struct DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
    public static void Open(string printerName) {
        IntPtr hPrinter;
        if(!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) throw new Exception("No se pudo abrir impresora");
        var di = new DOCINFO { pDocName = "Drawer", pDataType = "RAW" };
        StartDocPrinter(hPrinter, 1, ref di);
        StartPagePrinter(hPrinter);
        byte[] b = new byte[] {0x1B,0x70,0x00,0x32,0x00};
        IntPtr p = Marshal.AllocHGlobal(b.Length);
        Marshal.Copy(b, 0, p, b.Length);
        int written;
        WritePrinter(hPrinter, p, b.Length, out written);
        Marshal.FreeHGlobal(p);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
    }
}
"@
[Drawer]::Open("GHIA-GTP582")
`;
    fs.writeFileSync(tmpFile, psCode, "utf8");
    console.log("[DRAWER] Ejecutando script...");
    const output = execSync(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 20000, stdio: "pipe" },
    );
    console.log("[DRAWER] OK");
    try { fs.unlinkSync(tmpFile); } catch {}
    return { success: true };
  } catch (error) {
    console.error("[DRAWER ERROR]", error.message);
    return { success: false, error: error.message };
  }
});
