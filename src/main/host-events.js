// Suscripción en tiempo real al Host (lado CLIENTE).
//
// Mantiene abierta una conexión SSE (GET /api/events). Cada vez que el Host
// registra un cambio de datos (venta de cualquier caja, entrada de stock,
// edición de productos, corte...), envía un evento y se llama a onChange casi
// al instante, sin esperar a ningún sondeo.
//
// - Reconexión automática con espera creciente (0.5 s -> 5 s).
// - Vigilante de inactividad: el Host manda un latido cada 15 s; si pasan
//   35 s sin recibir nada (cable desconectado, Host congelado) se reconecta.
// - Si la URL del Host cambia (redescubrimiento por DHCP) se reconecta sola.
// - Al (re)conectar se llama a onConnected para ponerse al día de inmediato
//   (refrescar espejo, subir ventas pendientes, recargar pantallas).

const IDLE_TIMEOUT_MS = 35000;
const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 5000;

let running = false;
let controller = null;
let watchdog = null;
let connected = false;
let lastEventAt = 0;
let generation = 0;

const isConnected = () => connected;
const getLastEventAt = () => lastEventAt;

// opts: { getUrl, getToken, onChange, onConnected, onDisconnected }
const start = (opts) => {
  stop();
  running = true;
  const gen = ++generation;

  const run = async () => {
    let backoff = MIN_BACKOFF_MS;
    while (running && gen === generation) {
      const url = opts.getUrl();
      const token = opts.getToken();
      const ctrl = new AbortController();
      controller = ctrl;
      let lastActivity = Date.now();

      const wd = setInterval(() => {
        const urlChanged = opts.getUrl() !== url;
        if (urlChanged || Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
          ctrl.abort();
        }
      }, 3000);
      if (wd.unref) wd.unref();
      watchdog = wd;

      try {
        if (!token) throw new Error("sin token");
        const res = await fetch(`${url}/api/events`, {
          headers: { Authorization: token, Accept: "text/event-stream" },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        connected = true;
        backoff = MIN_BACKOFF_MS;
        lastActivity = Date.now();
        try {
          opts.onConnected && opts.onConnected();
        } catch (e) {
          console.error("[HostEvents] onConnected:", e.message);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (running && gen === generation) {
          const { value, done } = await reader.read();
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = block
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue; // latido (": ping")
            try {
              const payload = JSON.parse(dataLine.slice(5).trim());
              if (payload.type === "change") {
                lastEventAt = Date.now();
                opts.onChange && opts.onChange(payload);
              }
            } catch {
              // evento malformado: se ignora
            }
          }
        }
      } catch {
        // abortado, sin red o Host caído: se reintenta abajo
      } finally {
        clearInterval(wd);
        if (watchdog === wd) watchdog = null;
        if (connected && gen === generation) {
          connected = false;
          try {
            opts.onDisconnected && opts.onDisconnected();
          } catch {}
        }
      }

      if (!running || gen !== generation) break;
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  };

  run().catch((e) => console.error("[HostEvents] fatal:", e.message));
};

const stop = () => {
  running = false;
  if (watchdog) {
    clearInterval(watchdog);
    watchdog = null;
  }
  if (controller) {
    try {
      controller.abort();
    } catch {}
    controller = null;
  }
  connected = false;
};

module.exports = { start, stop, isConnected, getLastEventAt };
