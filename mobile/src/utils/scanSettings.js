import * as SecureStore from "expo-secure-store";

const SCAN_MODE_KEY = "pos_scan_mode"; // 'auto' | 'manual'

export const getScanMode = async () => {
  try {
    const mode = await SecureStore.getItemAsync(SCAN_MODE_KEY);
    return mode === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
};

export const setScanMode = async (mode) => {
  try {
    await SecureStore.setItemAsync(SCAN_MODE_KEY, mode);
  } catch {}
};
