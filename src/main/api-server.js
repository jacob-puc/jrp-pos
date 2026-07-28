const express = require("express");
const crypto = require("crypto");

let server = null;
let activeTokens = {};

const startServer = (db, port = 3456) => {
  if (server) return { success: true, port };

  const app = express();
  app.use(express.json());

  const safe = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("API error:", err.message);
      res.status(500).json({ success: false, error: "Error interno del servidor" });
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
    const cashiers = db.prepare("SELECT id, name, role FROM cashiers WHERE is_active = 1 ORDER BY name").all();
    res.json({ success: true, cashiers });
  }));

  const requireAuth = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token || !activeTokens[token]) return res.status(401).json({ success: false, error: "No autorizado" });
    req.cashierId = activeTokens[token].cashierId;
    next();
  };

  // IMPORTANT: /search must come BEFORE :barcode or Express matches "search" as barcode
  app.get("/api/products/search", requireAuth, safe((req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ success: true, products: [] });

    const term = `%${q.trim()}%`;
    const products = db.prepare(`
      SELECT id, barcode, name, price, stock, cost_price, sale_unit, min_stock, box_qty, box_price
      FROM products
      WHERE (name LIKE ? OR barcode LIKE ?) AND is_active = 1
      ORDER BY name LIMIT 30
    `).all(term, term);

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

    const result = db.prepare(`
      INSERT INTO products (barcode, name, cost_price, price, sale_unit, stock, category_id, min_stock, is_active, box_qty, box_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      barcode || null,
      name.trim(),
      cost_price || 0,
      price || 0,
      sale_unit || "piece",
      parseInt(stock) || 0,
      category_id || null,
      min_stock || 5,
      parseInt(box_qty) || 0,
      parseFloat(box_price) || 0
    );

    const product = db.prepare("SELECT id, barcode, name, price, stock, cost_price, sale_unit, box_qty, box_price FROM products WHERE id = ?").get(result.lastInsertRowid);
    res.json({ success: true, product, message: "Producto registrado correctamente" });
  }));

  app.patch("/api/products/:id/stock", requireAuth, safe((req, res) => {
    const { quantity, notes, cost } = req.body;
    const id = parseInt(req.params.id);
    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, error: "Cantidad inválida" });

    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(id);
    if (!product) return res.status(404).json({ success: false, error: "Producto no encontrado" });

    const costValue = parseFloat(cost) || 0;

    db.prepare("UPDATE products SET stock = stock + ?, cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END WHERE id = ?")
      .run(quantity, costValue, costValue, id);
    db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, cost, reference, notes)
      VALUES (?, 'in', ?, ?, 'App móvil', ?)
    `).run(id, quantity, costValue, notes || "Movil");

    // Register cost as expense in open cash register
    if (costValue > 0) {
      const todayMX = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const openReg = db.prepare("SELECT id FROM cash_register WHERE date = ? AND status = 'open'").get(todayMX);
      if (openReg) {
        db.prepare("UPDATE cash_register SET expenses = COALESCE(expenses, 0) + ? WHERE id = ?").run(costValue, openReg.id);
        db.prepare("INSERT INTO cash_register_expenses (register_id, amount, reason) VALUES (?, ?, ?)").run(openReg.id, costValue, `Compra de inventario: ${product.name}`);
      }
    }

    const updated = db.prepare("SELECT id, barcode, name, price, stock, cost_price, sale_unit, category_id, min_stock, box_qty, box_price FROM products WHERE id = ?").get(id);
    res.json({ success: true, product: updated, message: "Stock actualizado correctamente" });
  }));

  app.get("/api/categories", requireAuth, safe((req, res) => {
    const categories = db.prepare("SELECT id, name FROM categories ORDER BY name").all();
    res.json({ success: true, categories });
  }));

  return new Promise((resolve) => {
    server = app.listen(port, "0.0.0.0", () => {
      console.log(`API Server running on port ${port}`);
      resolve({ success: true, port });
    });

    server.on("error", (err) => {
      console.error("API Server error:", err.message);
      server = null;
      resolve({ success: false, error: err.message });
    });
  });
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
