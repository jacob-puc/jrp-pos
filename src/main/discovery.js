const dgram = require("dgram");
const os = require("os");

const DISCOVERY_PORT = Number(process.env.POS_DISCOVERY_PORT) || 3457;
// Solo para pruebas: permite que Host y Cliente corran en el MISMO equipo.
const ALLOW_SELF = process.env.POS_ALLOW_SELF === "1";
const DISCOVERY_MSG = "POS_DISCOVERY";
const RESPONSE_MSG = "POS_SERVER";

let socket = null;

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
};

// Todas las direcciones IPv4 de ESTE equipo (incluye loopback). Sirve para
// que una caja nunca se ofrezca a sí misma como "caja principal" y para
// impedir emparejarse consigo misma.
const getLocalAddresses = () => {
  const set = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4") set.add(iface.address);
    }
  }
  return set;
};

// ¿La URL/host apunta a este mismo equipo?
const isLocalHost = (hostOrUrl) => {
  try {
    let value = String(hostOrUrl || "").trim();
    if (!value) return false;
    if (!/^[a-z]+:\/\//i.test(value)) value = `http://${value}`;
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (ALLOW_SELF) return false;
    return getLocalAddresses().has(hostname) || hostname === os.hostname().toLowerCase();
  } catch {
    return false;
  }
};

// Direcciones de broadcast de cada interfaz activa (p.ej. 192.168.1.255).
// 255.255.255.255 a veces es filtrada por el router o sale por la interfaz
// equivocada en equipos con varias NICs; la del segmento es más confiable.
const getBroadcastAddresses = () => {
  const list = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const ip = String(iface.address || "").split(".").map(Number);
      const mask = String(iface.netmask || "").split(".").map(Number);
      if (ip.length !== 4 || mask.length !== 4) continue;
      if (ip.some(isNaN) || mask.some(isNaN)) continue;
      list.push(ip.map((octet, i) => (octet | (255 - mask[i])) & 255).join("."));
    }
  }
  return list;
};

// Lado CLIENTE: busca cajas Host en la red local. Envía POS_DISCOVERY por
// broadcast UDP y colecciona las respuestas POS_SERVER:<ip>:<port> durante
// `timeoutMs`. Devuelve [{ ip, port, url }] únicos (puede venir vacío).
const discoverServers = (timeoutMs = 3500) =>
  new Promise((resolve) => {
    const found = new Map();
    let sock = null;
    let settled = false;
    const timers = [];

    const finish = () => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      try {
        if (sock) sock.close();
      } catch {}
      // Se descarta este mismo equipo: solo cuentan las OTRAS cajas.
      const own = ALLOW_SELF ? new Set() : getLocalAddresses();
      resolve([...found.values()].filter((server) => !own.has(server.ip)));
    };

    try {
      sock = dgram.createSocket("udp4");
    } catch {
      return finish();
    }

    sock.on("error", () => finish());

    sock.on("message", (msg) => {
      // Formato: POS_SERVER:<ip>:<port>[:<nombreTiendaCodificado>]
      const match = msg.toString().trim().match(/^POS_SERVER:([\d.]+):(\d+)(?::(.*))?$/);
      if (!match) return;
      const key = `${match[1]}:${match[2]}`;
      let storeName = "";
      if (match[3]) {
        try {
          storeName = decodeURIComponent(match[3]).trim();
        } catch {
          storeName = "";
        }
      }
      if (!found.has(key)) {
        found.set(key, {
          ip: match[1],
          port: parseInt(match[2], 10),
          url: `http://${key}`,
          storeName,
        });
      } else if (storeName && !found.get(key).storeName) {
        found.get(key).storeName = storeName;
      }
    });

    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
      } catch {}
      const targets = new Set(["255.255.255.255", ...getBroadcastAddresses()]);
      const sendAll = () => {
        for (const addr of targets) {
          try {
            sock.send(DISCOVERY_MSG, DISCOVERY_PORT, addr, () => {});
          } catch {}
        }
      };
      sendAll();
      // Reintentos: UDP no garantiza entrega y el primer paquete puede
      // perderse si el firewall o el switch lo descarta.
      timers.push(setTimeout(sendAll, 900));
      timers.push(setTimeout(sendAll, 1800));
      timers.push(setTimeout(finish, timeoutMs));
    });
  });

// `getStoreName` es opcional: función que devuelve el nombre de la tienda
// del Host para anunciarlo junto con la IP (así el cliente muestra el nombre).
const startDiscovery = (apiPort, getStoreName) => {
  if (socket) stopDiscovery();

  socket = dgram.createSocket("udp4");

  socket.on("message", (msg, rinfo) => {
    const text = msg.toString().trim();
    if (text === DISCOVERY_MSG) {
      const ip = getLocalIP();
      let name = "";
      try {
        name = String((typeof getStoreName === "function" && getStoreName()) || "").trim();
      } catch {
        name = "";
      }
      const response = `${RESPONSE_MSG}:${ip}:${apiPort}${name ? `:${encodeURIComponent(name)}` : ""}`;
      socket.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) console.error("Discovery send error:", err.message);
      });
    }
  });

  socket.on("error", (err) => {
    console.error("Discovery socket error:", err.message);
  });

  return new Promise((resolve) => {
    socket.bind(DISCOVERY_PORT, "0.0.0.0", () => {
      socket.setBroadcast(true);
      console.log(`Discovery listening on port ${DISCOVERY_PORT}`);
      resolve({ success: true });
    });

    socket.on("error", (err) => {
      socket = null;
      resolve({ success: false, error: err.message });
    });
  });
};

const stopDiscovery = () => {
  if (socket) {
    socket.close();
    socket = null;
    console.log("Discovery stopped");
  }
};

const getStatus = () => ({
  running: socket !== null,
  port: DISCOVERY_PORT,
});

module.exports = {
  startDiscovery,
  stopDiscovery,
  getStatus,
  getLocalIP,
  getBroadcastAddresses,
  getLocalAddresses,
  isLocalHost,
  discoverServers,
};
