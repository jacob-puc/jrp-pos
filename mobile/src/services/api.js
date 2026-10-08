import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";

let baseURL = null;
let authToken = null;

const API_PORT = 3456;
const TOKEN_KEY = "pos_auth_token";
const HOST_KEY = "pos_host";
const DEVICE_TOKEN_KEY = "pos_device_token";

const buildUrl = (host) => {
  const h = String(host || "").trim();
  if (!h) return null;
  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h);
      return `${u.origin}`;
    } catch {}
  }
  return `http://${h}:${API_PORT}`;
};

const probeIP = async (ip, timeout = 1500) => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`http://${ip}:${API_PORT}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "probe" }),
      signal: controller.signal,
    });
    clearTimeout(id);
    return true;
  } catch {
    return false;
  }
};

const getSubnetIPs = (ip) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return [];
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
  const ips = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${prefix}${i}`);
  }
  return ips;
};

const discover = async () => {
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== "0.0.0.0") {
      const ips = getSubnetIPs(ip);
      // Probe in parallel batches of 10
      for (let i = 0; i < ips.length; i += 10) {
        const batch = ips.slice(i, i + 10);
        const results = await Promise.all(batch.map((ip) => probeIP(ip, 1000)));
        const found = batch.find((_, idx) => results[idx]);
        if (found) return found;
      }
    }
  } catch {}
  return null;
};

const loadSavedHost = async () => {
  try {
    const host = await SecureStore.getItemAsync(HOST_KEY);
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
    if (host) baseURL = buildUrl(host);
    if (deviceToken) authToken = deviceToken;
    else if (token) authToken = token;
    return { host, token: authToken };
  } catch {
    return { host: null, token: null };
  }
};

export const setHost = async (host) => {
  const url = buildUrl(host);
  if (!url) throw new Error("Host inválido");
  baseURL = url;
  await SecureStore.setItemAsync(HOST_KEY, host.replace(/^https?:\/\//i, "").replace(`:${API_PORT}`, ""));
};

export const pairWithHost = async (activationCode, deviceName = "Caja Móvil") => {
  if (!baseURL) throw new Error("No hay servidor configurado");
  const res = await fetch(`${baseURL}/api/auth/pair-device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activationCode, deviceName, deviceType: "mobile" }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Error al emparejar");
  authToken = data.token;
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return { success: true, token: data.token };
};

export const initialize = async (manualHost = null) => {
  if (manualHost) {
    try {
      await setHost(manualHost);
    } catch {}
  }

  const saved = await loadSavedHost();
  if (saved.host || manualHost) {
    if (!baseURL) baseURL = buildUrl(saved.host || manualHost);
    // Test connection - probar con auth actual o sin auth en endpoint que responda
    try {
      const test = await fetch(`${baseURL}/api/db-version`, {
        headers: authToken ? { Authorization: authToken } : {},
        signal: AbortSignal.timeout(3000),
      });
      if (test.ok) return { connected: true };
    } catch {}
    try {
      const test = await fetch(`${baseURL}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "test" }),
        signal: AbortSignal.timeout(3000),
      });
      if (test.ok || test.status === 401) return { connected: true };
    } catch {}
  }

  const serverIP = await discover();
  if (serverIP) {
    baseURL = buildUrl(serverIP);
    await SecureStore.setItemAsync(HOST_KEY, serverIP);
    return { connected: true, discovered: true };
  }

  return { connected: false };
};

export const authenticate = async (id, pin) => {
  const res = await fetch(`${baseURL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, pin }),
  });
  const data = await res.json();
  if (data.success) {
    authToken = data.token;
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    return { success: true, cashier: data.cashier };
  }
  return { success: false, error: data.error };
};

export const getCashiers = () => apiFetch("/api/cashiers");

const apiFetch = async (path, options = {}) => {
  if (!baseURL) throw new Error("No conectado al servidor");

  const headers = { ...options.headers };
  if (authToken) headers["Authorization"] = authToken;

  const res = await fetch(`${baseURL}${path}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    try {
      const deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
      authToken = deviceToken || null;
    } catch {
      authToken = null;
    }
    throw new Error("Sesión expirada");
  }

  if (!data.success) throw new Error(data.error || "Error del servidor");
  return data;
};

export const searchProducts = (query) =>
  apiFetch(`/api/products/search?q=${encodeURIComponent(query)}`);

export const getProductByBarcode = (barcode) =>
  apiFetch(`/api/products/${encodeURIComponent(barcode)}`);

export const createProduct = (product) =>
  apiFetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });

export const addStock = (productId, quantity, cost = "", notes = "", registerExpense = true, updateCostPrice = null) => {
  const body = { quantity, cost: parseFloat(cost) || 0, notes, registerExpense };
  if (typeof updateCostPrice === "number") body.updateCostPrice = updateCostPrice;
  return apiFetch(`/api/products/${productId}/stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

export const getCategories = () => apiFetch("/api/categories");

export const logout = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  try {
    const deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
    authToken = deviceToken || null;
  } catch {
    authToken = null;
  }
};

export const resetConnection = async () => {
  baseURL = null;
  authToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(HOST_KEY);
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
};

export const getConnectionInfo = async () => {
  try {
    const host = await SecureStore.getItemAsync(HOST_KEY);
    const hasToken = !!(await SecureStore.getItemAsync(DEVICE_TOKEN_KEY));
    return { host: host || null, paired: hasToken, baseURL };
  } catch {
    return { host: null, paired: false, baseURL };
  }
};
