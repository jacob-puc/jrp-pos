import React, { useState, useEffect, useMemo, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Box, Typography, CircularProgress } from "@mui/material";
import SetupModal from "./components/SetupModal";
import AddProductModal from "./components/AddProductModal";
import LoginScreen from "./components/LoginScreen";
import PageSkeleton from "./components/PageSkeleton";

const Layout = React.lazy(() => import("./components/Layout"));
const SalesTerminal = React.lazy(() => import("./components/SalesTerminal"));
const Inventory = React.lazy(() => import("./components/Inventory"));
const EndOfDay = React.lazy(() => import("./components/EndOfDay"));
const Suppliers = React.lazy(() => import("./components/Suppliers"));
const StockMovements = React.lazy(() => import("./components/StockMovements"));
const Reports = React.lazy(() => import("./components/Reports"));
const BackupRestore = React.lazy(() => import("./components/BackupRestore"));
const Cashiers = React.lazy(() => import("./components/Cashiers"));
const Categories = React.lazy(() => import("./components/Categories"));
import { CashierProvider, useCashier } from "./contexts/CashierContext";
import { ThemeModeContext } from "./contexts/ThemeContext";

const createModernTheme = (mode) => {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#3b82f6",
        light: "#60a5fa",
        dark: "#2563eb",
      },
      secondary: {
        main: isDark ? "#06b6d4" : "#0891b2",
        light: isDark ? "#22d3ee" : "#06b6d4",
        dark: isDark ? "#0891b2" : "#0e7490",
      },
      success: {
        main: "#10b981",
        light: "#34d399",
        dark: "#059669",
      },
      warning: {
        main: "#f59e0b",
        light: "#fbbf24",
        dark: "#d97706",
      },
      error: {
        main: "#ef4444",
        light: "#f87171",
        dark: "#dc2626",
      },
      info: {
        main: "#0ea5e9",
        light: "#38bdf8",
        dark: "#0284c7",
      },
      background: {
        default: isDark ? "#0a0e1a" : "#f8f9ff",
        paper: isDark ? "#111827" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f8fafc" : "#0b1c30",
        secondary: isDark ? "#94a3b8" : "#45474c",
      },
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
      h1: { fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em" },
      h2: { fontWeight: 700, fontSize: "1.6rem", letterSpacing: "-0.02em", color: isDark ? "#f1f5f9" : "#0f172a" },
      h3: { fontWeight: 700, fontSize: "1.35rem", letterSpacing: "-0.01em", color: isDark ? "#f1f5f9" : "#0f172a" },
      h4: { fontWeight: 700, fontSize: "1.15rem", color: isDark ? "#f1f5f9" : "#0f172a" },
      h5: { fontWeight: 600, fontSize: "1rem", color: isDark ? "#f1f5f9" : "#0f172a" },
      h6: { fontWeight: 600, fontSize: "0.9rem", color: isDark ? "#f1f5f9" : "#0f172a" },
      button: { fontWeight: 600, textTransform: "none" },
      body1: { fontWeight: 400, fontSize: "0.95rem", letterSpacing: "0.01em" },
      body2: { fontWeight: 400, fontSize: "0.85rem", letterSpacing: "0.01em" },
      caption: { fontWeight: 500, fontSize: "0.75rem", letterSpacing: "0.02em" },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark ? "#0a0e1a" : "#f0f7ff",
            minHeight: "100vh",
            '& ::-webkit-scrollbar': { width: '6px', height: '6px' },
            '& ::-webkit-scrollbar-track': {
              background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(226, 232, 240, 0.8)',
            },
            '& ::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(180deg, #2563eb, #3b82f6)',
              borderRadius: '3px',
            },
            '& ::-webkit-scrollbar-thumb:hover': {
              background: 'linear-gradient(180deg, #1d4ed8, #2563eb)',
            },
            '& ::selection': {
              background: 'rgba(59, 130, 246, 0.3)',
              color: '#ffffff',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.12)"}`,
            borderRadius: "16px",
            backdropFilter: "blur(16px)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            padding: "10px 22px",
            boxShadow: "none",
            "&:hover": {
              transform: "translateY(-1px)",
            },
          },
          containedPrimary: {
            background: "#1E293B",
            "&:hover": {
              background: "#334155",
              boxShadow: isDark ? "0 8px 25px rgba(30, 41, 59, 0.35)" : "0 8px 25px rgba(30, 41, 59, 0.3)",
            },
          },
          containedSuccess: {
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            "&:hover": {
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              boxShadow: isDark ? "0 8px 25px rgba(16, 185, 129, 0.35)" : "0 8px 25px rgba(16, 185, 129, 0.3)",
            },
          },
          containedError: {
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            "&:hover": {
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              boxShadow: isDark ? "0 8px 25px rgba(239, 68, 68, 0.35)" : "0 8px 25px rgba(239, 68, 68, 0.3)",
            },
          },
          outlined: {
            borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(30, 41, 59, 0.25)",
            color: isDark ? "#94a3b8" : "#475569",
            "&:hover": {
              borderColor: isDark ? "#94a3b8" : "#1E293B",
              backgroundColor: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(30, 41, 59, 0.06)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(248, 250, 252, 0.85)",
              transition: "all 0.2s ease",
              "& fieldset": {
                borderColor: isDark ? "rgba(71, 85, 105, 0.5)" : "rgba(148, 163, 184, 0.5)",
                transition: "border-color 0.2s ease",
              },
              "&:hover fieldset": {
                borderColor: isDark ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.5)",
              },
              "&.Mui-focused": {
                boxShadow: isDark
                  ? "0 0 0 3px rgba(148, 163, 184, 0.15)"
                  : "0 0 0 3px rgba(100, 116, 139, 0.12)",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#64748B",
                borderWidth: "2px",
              },
              "& input": {
                padding: "12px 14px",
              },
            },
            "& .MuiInputLabel-root": {
              fontWeight: 500,
              color: isDark ? "#94a3b8" : "#64748b",
              "&.Mui-focused": {
                color: "#64748B",
                fontWeight: 600,
              },
            },
            "& .MuiFormHelperText-root": {
              fontSize: "0.75rem",
              fontWeight: 500,
              marginTop: "4px",
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: "16px",
            background: isDark ? "rgba(17, 24, 39, 0.7)" : "rgba(255, 255, 255, 0.8)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.1)"}`,
            backdropFilter: "blur(12px)",
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-head": {
              backgroundColor: isDark ? "#1c3048" : "#1E293B",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:nth-of-type(even)": { backgroundColor: isDark ? "rgba(30, 41, 59, 0.3)" : "rgba(241, 245, 249, 0.6)" },
            "&:hover": {
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.06)" : "rgba(37, 99, 235, 0.04)",
              transition: "background-color 0.2s",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: "8px" },
          outlined: {
            borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(30, 41, 59, 0.2)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: "20px",
            background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
            boxShadow: isDark ? "0 25px 60px rgba(0, 0, 0, 0.5)" : "0 25px 60px rgba(0, 0, 0, 0.12)",
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: "12px" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(15, 23, 42, 0.95)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(37, 99, 235, 0.15)"}`,
            borderRadius: "8px",
            fontSize: "0.8rem",
          },
        },
      },
    },
  });
};

const AppInner = () => {
  const { cashier, setCashier } = useCashier();
  const [loggedIn, setLoggedIn] = useState(() => {
    try { return !!localStorage.getItem("currentCashier"); } catch { return false; }
  });

  useEffect(() => {
    if (!cashier) setLoggedIn(false);
  }, [cashier]);
  const [mode, setMode] = useState("light");

  const [isFirstTime, setIsFirstTime] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const colorMode = useMemo(() => ({
    toggleMode: () => {
      setMode((prev) => {
        const next = prev === "dark" ? "light" : "dark";
        try { localStorage.setItem("themeMode", next); } catch {}
        return next;
      });
    },
  }), []);

  const theme = useMemo(() => createModernTheme(mode), [mode]);
  const isDark = mode === "dark";

  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const firstTime = await window.api.invoke("is-first-time");
        setIsFirstTime(firstTime);
        if (firstTime) setShowSetup(true);
      } catch (error) {
        console.error("Error checking first time:", error);
        setIsFirstTime(false);
      }
    };
    checkFirstTime();
    const handleOpenSettings = () => setShowSetup(true);
    const handleCtrlN = () => setShowAddProduct(true);
    window.addEventListener("openSettings", handleOpenSettings);
    window.addEventListener("ctrl-n", handleCtrlN);
    return () => {
      window.removeEventListener("openSettings", handleOpenSettings);
      window.removeEventListener("ctrl-n", handleCtrlN);
    };
  }, []);

  const handleSetupComplete = async (setupData) => {
    setShowSetup(false);
    setIsFirstTime(false);
    window.dispatchEvent(new CustomEvent("setupCompleted", { detail: setupData }));
    // Auto-login as the admin created during setup
    try {
      const list = await window.api.invoke("get-cashiers");
      const admin = list.find((c) => c.role === "admin");
      if (admin) {
        setCashier({ id: admin.id, name: admin.name, role: admin.role });
        setLoggedIn(true);
      }
    } catch {}
  };

  const handleSetupClose = () => {
    setShowSetup(false);
  };

  const handleLogin = (cashier) => {
    setLoggedIn(true);
    setCashier(cashier);
  };

  const loadingScreen = (
    <Box sx={{
      display: "flex", justifyContent: "center", alignItems: "center",
      height: "100vh",
      bgcolor: "background.default",
    }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress size={40} sx={{ color: "#3b82f6", mb: 2 }} />
        <Typography variant="body1" color="textSecondary">Cargando...</Typography>
      </Box>
    </Box>
  );

  if (isFirstTime === null) {
    return (
      <ThemeModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {loadingScreen}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    );
  }

  if (!loggedIn) {
    return (
      <ThemeModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SetupModal open={showSetup} onComplete={handleSetupComplete} onClose={handleSetupClose} />
          {!showSetup && <LoginScreen onLogin={handleLogin} />}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    );
  }

  return (
    <ThemeModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SetupModal open={showSetup} onComplete={handleSetupComplete} onClose={handleSetupClose} />
        <AddProductModal open={showAddProduct} onClose={() => setShowAddProduct(false)} onProductAdded={() => setShowAddProduct(false)} />
        <Suspense fallback={<PageSkeleton />}>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<SalesTerminal />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="categories" element={<Categories />} />
                <Route path="stock-movements" element={<StockMovements />} />
                <Route path="end-of-day" element={<EndOfDay />} />
                <Route path="reports" element={<Reports />} />
                <Route path="backup" element={<BackupRestore />} />
                <Route path="cashiers" element={<Cashiers />} />
              </Route>
            </Routes>
          </HashRouter>
        </Suspense>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

const App = () => (
  <CashierProvider>
    <AppInner />
  </CashierProvider>
);

export default App;
