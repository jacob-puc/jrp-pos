import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

const SCAN_MODE_KEY = "jrp_scan_mode";

export const SCAN_MODES = {
  AUTO: "auto",
  MANUAL: "manual",
};

async function loadScanMode() {
  try {
    const value = await SecureStore.getItemAsync(SCAN_MODE_KEY);
    if (value === SCAN_MODES.AUTO) return SCAN_MODES.AUTO;
  } catch {}
  return SCAN_MODES.MANUAL;
}

async function saveScanMode(mode) {
  try {
    if (mode === SCAN_MODES.AUTO) {
      await SecureStore.setItemAsync(SCAN_MODE_KEY, mode);
    } else {
      await SecureStore.deleteItemAsync(SCAN_MODE_KEY);
    }
  } catch {}
}

export const SettingsContext = createContext({
  scanMode: SCAN_MODES.MANUAL,
  setScanMode: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [scanMode, setScanModeState] = useState(SCAN_MODES.MANUAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadScanMode().then((mode) => {
      if (!mounted) return;
      setScanModeState(mode);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setScanMode = (mode) => {
    setScanModeState(mode);
    saveScanMode(mode);
  };

  return (
    <SettingsContext.Provider value={{ scanMode, setScanMode, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}