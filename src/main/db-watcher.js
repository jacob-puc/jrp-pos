// Vigilante de cambios de datos.
//
// Calcula periódicamente una "firma" del estado de la información (conteos,
// máximos y sumas de las tablas clave). Cuando la firma cambia, ejecuta
// onChange: el proceso principal avisa al renderer por IPC ("db-changed")
// y las pantallas se recargan solas (ver utils/useDbChanges.js).
//
// - Modo Host: la firma sale de la BD local. Como las ventas de las demás
//   cajas y del móvil entran por el API y escriben en la misma BD, un solo
//   punto de observación cubre TODOS los cambios.
// - Modo Cliente: la firma se pide al Host por HTTP (/api/db-version) en
//   cada ciclo. Si el Host no responde (offline), se vigila la BD espejo.

const DEFAULT_INTERVAL_MS = 2500;

let timer = null;
let lastSignature = null;
let ticking = false;

// Una sola consulta con agregados baratos: suficiente para detectar altas y
// bajas de productos, cambios de precio/stock, ventas nuevas, cancelaciones,
// movimientos de inventario, aperturas/cierres de caja y altas de catálogos.
const computeLocalSignature = (db) => {
  try {
    const row = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM products WHERE is_active = 1) AS productCount,
          (SELECT COALESCE(SUM(stock), 0) FROM products) AS stockSum,
          (SELECT COALESCE(SUM(price), 0) FROM products) AS priceSum,
          (SELECT COUNT(*) FROM sales) AS saleCount,
          (SELECT COALESCE(MAX(id), 0) FROM sales) AS lastSaleId,
          (SELECT COUNT(*) FROM sales WHERE status = 'cancelado') AS cancelledCount,
          (SELECT COALESCE(MAX(id), 0) FROM stock_movements) AS lastMovementId,
          (SELECT COUNT(*) FROM cash_register) AS registerCount,
          (SELECT COUNT(*) FROM cash_register WHERE status = 'open') AS openRegisters,
          (SELECT COUNT(*) FROM categories) AS categoryCount,
          (SELECT COUNT(*) FROM suppliers) AS supplierCount,
          (SELECT COUNT(*) FROM cashiers WHERE is_active = 1) AS cashierCount`,
      )
      .get();
    return JSON.stringify(row);
  } catch {
    return null;
  }
};

// getSignature: async () => string | null
// onChange:     async (signature) => void  (se espera antes del próximo ciclo)
const startWatcher = ({
  getSignature,
  onChange,
  intervalMs = DEFAULT_INTERVAL_MS,
}) => {
  stopWatcher();
  timer = setInterval(async () => {
    if (ticking) return; // no solapar cuando la red tarda más que el intervalo
    ticking = true;
    try {
      const signature = await getSignature();
      if (signature) {
        // La primera lectura solo inicializa la firma: evita una ráfaga
        // de recargas en todas las pantallas apenas abre la app.
        if (lastSignature !== null && signature !== lastSignature) {
          await onChange(signature);
        }
        lastSignature = signature;
      }
    } catch {
      // Error transitorio (red/BD): se reintenta en el próximo ciclo.
    } finally {
      ticking = false;
    }
  }, intervalMs);
  if (timer.unref) timer.unref();
};

const stopWatcher = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  lastSignature = null;
  ticking = false;
};

module.exports = { startWatcher, stopWatcher, computeLocalSignature };
