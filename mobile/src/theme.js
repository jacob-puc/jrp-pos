import { MD3DarkTheme, MD3LightTheme, configureFonts } from "react-native-paper";

const fontConfig = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
};

const shared = {
  colors: {
    primary: "#234e8c",
    primaryContainer: "#2d5fa8",
    secondary: "#64748b",
    tertiary: "#3b82f6",
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 12,
};

export const DarkTheme = {
  ...MD3DarkTheme,
  ...shared,
  colors: {
    ...MD3DarkTheme.colors,
    ...shared.colors,
    background: "#0a0e1a",
    surface: "#111827",
    surfaceVariant: "#1e293b",
    onSurface: "#f1f5f9",
    onSurfaceVariant: "#94a3b8",
    outline: "rgba(100, 116, 139, 0.3)",
    error: "#ef4444",
    errorContainer: "rgba(239,68,68,0.15)",
    onError: "#ffffff",
    primaryContainer: "rgba(35, 78, 140, 0.2)",
    onPrimaryContainer: "#f1f5f9",
    secondaryContainer: "rgba(100, 116, 139, 0.15)",
  },
};

export const LightTheme = {
  ...MD3LightTheme,
  ...shared,
  colors: {
    ...MD3LightTheme.colors,
    ...shared.colors,
    background: "#f8f9ff",
    surface: "#ffffff",
    surfaceVariant: "#f1f5f9",
    onSurface: "#0f172a",
    onSurfaceVariant: "#64748b",
    outline: "rgba(148, 163, 184, 0.5)",
    error: "#dc2626",
    errorContainer: "rgba(220,38,38,0.1)",
    onError: "#ffffff",
    primaryContainer: "rgba(35, 78, 140, 0.1)",
    onPrimaryContainer: "#0f172a",
    secondaryContainer: "rgba(100, 116, 139, 0.1)",
  },
};
