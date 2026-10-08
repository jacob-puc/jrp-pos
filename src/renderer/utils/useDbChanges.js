import { useEffect, useRef } from "react";

// useEffect que escucha los cambios de la base de datos.
//
// El proceso principal vigila la "firma" de los datos (local en modo Host,
// la del Host por HTTP en modo Cliente) y emite "db-changed" cuando algo
// cambia: ventas de esta u otras cajas, entradas de stock, cortes de caja,
// altas de catálogos, sincronización, etc.
//
// El callback se ejecuta con un pequeño debounce para agrupar ráfagas de
// cambios (p.ej. una venta mueve products + sales + stock_movements).
//
// Uso típico (las pantallas recargan en silencio, sin skeleton):
//   useDbChanges(() => fetchData({ silent: true }));
const useDbChanges = (callback, debounceMs = 200) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let timer = null;
    const unsubscribe = window.api.on("db-changed", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), debounceMs);
    });
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [debounceMs]);
};

export default useDbChanges;
