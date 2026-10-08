// Bus de cambios de datos (tiempo real).
//
// Instrumenta la conexión SQLite para detectar CUALQUIER escritura sobre las
// tablas de negocio (ventas, stock, productos, caja...), venga de la UI del
// Host, del API HTTP (cajas cliente / app móvil) o del RPC. Al detectarla
// avisa a los suscriptores casi al instante (debounce de 40 ms), que son:
//   - el renderer del Host (evento "db-changed")
//   - las cajas cliente conectadas por SSE (/api/events)
//
// Se ignoran a propósito tablas de infraestructura (settings, paired_devices,
// pending_sync_sales): se escriben en cada petición y causarían bucles de
// recarga.

const DATA_TABLES =
  /\b(products|product_prices|sales|sale_items|stock_movements|cash_register|cash_register_expenses|categories|suppliers|cashiers|customers|tasks)\b/i;
const WRITE_STATEMENT = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
const DEBOUNCE_MS = 40;

const listeners = new Set();
let timer = null;
let seq = 0;

const flush = () => {
  timer = null;
  seq += 1;
  for (const cb of [...listeners]) {
    try {
      cb({ seq, ts: Date.now() });
    } catch (err) {
      console.error("[ChangeBus] listener error:", err.message);
    }
  }
};

// Marca que hubo un cambio; agrupa ráfagas (una venta toca varias tablas).
const markDirty = () => {
  if (timer) return;
  timer = setTimeout(flush, DEBOUNCE_MS);
};

const onChange = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSeq = () => seq;

// Envuelve db.prepare para que las sentencias de escritura sobre tablas de
// negocio llamen a markDirty() tras ejecutarse. Como better-sqlite3 es
// síncrono, el aviso sale (setTimeout) cuando la transacción ya terminó.
const instrumentDb = (db) => {
  if (!db || db.__changeBusInstrumented) return db;
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = originalPrepare(sql);
    const text = String(sql);
    if (WRITE_STATEMENT.test(text) && DATA_TABLES.test(text)) {
      const originalRun = stmt.run.bind(stmt);
      stmt.run = (...args) => {
        const result = originalRun(...args);
        markDirty();
        return result;
      };
    }
    return stmt;
  };
  db.__changeBusInstrumented = true;
  return db;
};

module.exports = { instrumentDb, markDirty, onChange, getSeq };
