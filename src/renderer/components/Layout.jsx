import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,   Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, IconButton,
  useTheme, Divider, Chip, Stack, Tooltip, TextField, MenuItem, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Badge, ListItemSecondaryAction,
} from "@mui/material";
import {
  PointOfSale, Inventory, Assessment, Menu, MenuOpen,
  Settings, Person, LocalShipping, Category,
  CompareArrows, AssessmentOutlined, Backup, QrCodeScanner,
  DarkMode, LightMode, Logout, AccountBalance, Scale,
  CalendarMonth, CheckCircle,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";
import StoreSettingsDialog from "./StoreSettingsDialog";
import { useThemeMode } from "../contexts/ThemeContext";
import { useCashier } from "../contexts/CashierContext";
import { formatMXTime } from "../utils/dateUtils";

const TaskDialog = React.lazy(() => import("./TaskDialog"));

const drawerWidth = 280;
const miniDrawerWidth = 80;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [storeName, setStoreName] = useState("MI TIENDA");
  const [clock, setClock] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isDark, toggleMode } = useThemeMode();
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const { cashier, logout } = useCashier();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerNotice, setRegisterNotice] = useState(null);
  const noticeShownRef = useRef(false);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scalePorts, setScalePorts] = useState([]);
  const [scalePort, setScalePort] = useState(() => localStorage.getItem("scalePort") || "");
  const [scaleBaud, setScaleBaud] = useState(() => localStorage.getItem("scaleBaud") || "115200");
  const [scaleLoading, setScaleLoading] = useState(false);
  const [scaleError, setScaleError] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [todayTasksCount, setTodayTasksCount] = useState(0);
  const [reminderDialog, setReminderDialog] = useState({ open: false, task: null });

  const isVisibleRef = useRef(true);
  useEffect(() => {
    const handle = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  const isDarkMode = theme.palette.mode === "dark";

  const checkRegisterStatus = useCallback(async () => {
    try {
      const result = await window.api.invoke("get-cash-register-status", { cashierId: cashier?.id, role: cashier?.role });
      const reg = result.success ? result.register : null;
      setRegisterOpen(!!reg && reg.status === "open");
      if (
        reg &&
        reg.status === "open" &&
        cashier?.role !== "admin" &&
        !noticeShownRef.current &&
        String(reg.opened_by) !== String(cashier?.id) &&
        String(reg.cashier_id) !== String(cashier?.id)
      ) {
        noticeShownRef.current = true;
        setRegisterNotice({ opener_name: reg.opener_name, opened_at: reg.opened_at });
      }
    } catch (e) { setRegisterOpen(false); }
  }, [cashier?.id, cashier?.role]);

  useEffect(() => {
    checkRegisterStatus();
    const interval = setInterval(() => { if (isVisibleRef.current) checkRegisterStatus(); }, 10000);
    return () => clearInterval(interval);
  }, [checkRegisterStatus]);

  useEffect(() => {
    const checkScale = async () => {
      if (!isVisibleRef.current) return;
      try {
        const status = await window.api.invoke("is-scale-connected");
        setScaleConnected(status.connected);
      } catch { setScaleConnected(false); }
    };
    checkScale();
    const interval = setInterval(checkScale, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scalePort && !scaleConnected) {
      (async () => {
        try {
          const result = await window.api.invoke("connect-scale", scalePort, parseInt(scaleBaud));
          setScaleConnected(result.success);
        } catch { setScaleConnected(false); }
      })();
    }
  }, [scalePort, scaleBaud]);

  useEffect(() => {
    const loadStoreSettings = async () => {
      try {
        const name = await window.api.invoke("get-setting", "store_name");
        if (name) setStoreName(name.toUpperCase());
      } catch (error) {
        console.error("Error loading store settings:", error);
      }
    };
    loadStoreSettings();

    const checkServer = async () => {
      try {
        const status = await window.api.invoke("get-server-status");
        setServerRunning(status.running);
      } catch (e) { setServerRunning(false); }
    };
    checkServer();

    const handleSetupCompleted = (event) => {
      const { storeName: newStoreName } = event.detail;
      if (newStoreName) setStoreName(newStoreName.toUpperCase());
    };
    window.addEventListener("setupCompleted", handleSetupCompleted);

    const handleSettingsUpdated = (event) => {
      const { storeName: newStoreName } = event.detail;
      if (newStoreName) setStoreName(newStoreName.toUpperCase());
    };
    window.addEventListener("storeSettingsUpdated", handleSettingsUpdated);

    return () => {
      window.removeEventListener("setupCompleted", handleSetupCompleted);
      window.removeEventListener("storeSettingsUpdated", handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { if (isVisibleRef.current) setClock(new Date()); }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadTodayTasks = async () => {
      if (!isVisibleRef.current) return;
      const result = await window.api.invoke("get-today-tasks");
      if (result.success) setTodayTasksCount(result.tasks.length);
    };
    loadTodayTasks();
    const interval = setInterval(loadTodayTasks, 30000);
    const unsubReminder = window.api.on("task-reminder", (task) => {
      setReminderDialog({ open: true, task });
    });
    return () => {
      clearInterval(interval);
      if (unsubReminder) unsubReminder();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ctrl-n"));
      }
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        const path = location.pathname;
        if (path === "/suppliers") {
          window.dispatchEvent(new CustomEvent("ctrl-p"));
        } else {
          navigate("/suppliers");
        }
      }
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setDrawerOpen(prev => !prev);
      }
      if (e.key === "F1") {
        e.preventDefault();
        setShortcutsDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname, navigate]);

  const isAdmin = cashier?.role === "admin";

  const navSections = [
    {
      title: "Punto de Venta",
      items: [
        { text: "Terminal de Venta", icon: <PointOfSale />, path: "/" },
        { text: "Caja", icon: <AccountBalance />, path: "/end-of-day" },
      ],
    },
    {
      title: "Inventario",
      items: [
        { text: "Productos", icon: <Inventory />, path: "/inventory" },
        { text: "Categorías", icon: <Category />, path: "/categories" },
        { text: "Proveedores", icon: <LocalShipping />, path: "/suppliers" },
        ...(isAdmin ? [{ text: "Movimientos", icon: <CompareArrows />, path: "/stock-movements" }] : []),
      ],
    },
    ...(isAdmin ? [{
      title: "Reportes",
      items: [
        { text: "Reportes", icon: <AssessmentOutlined />, path: "/reports" },
      ],
    }] : []),
    ...(isAdmin ? [{
      title: "Sistema",
      items: [
        { text: "Cajeros", icon: <Person />, path: "/cashiers" },
        { text: "Respaldo", icon: <Backup />, path: "/backup" },
      ],
    }] : []),
  ];

  const getPageTitle = () => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.path === location.pathname) return item.text;
      }
    }
    return "Sistema de Ventas";
  };

  const handleOpenScaleDialog = async () => {
    setScaleDialogOpen(true);
    setScaleError("");
    setScaleLoading(true);
    try {
      const ports = await window.api.invoke("list-serial-ports");
      setScalePorts(ports);
    } catch { setScalePorts([]); setScaleError("Error al buscar puertos"); }
    setScaleLoading(false);
  };

  const handleRefreshPorts = async () => {
    setScaleLoading(true);
    setScaleError("");
    try {
      const ports = await window.api.invoke("list-serial-ports");
      setScalePorts(ports);
    } catch { setScalePorts([]); setScaleError("Error al buscar puertos"); }
    setScaleLoading(false);
  };

  const handleConnectScale = async (portPath) => {
    setScaleLoading(true);
    setScaleError("");
    localStorage.setItem("scalePort", portPath);
    localStorage.setItem("scaleBaud", scaleBaud);
    try {
      const result = await window.api.invoke("connect-scale", portPath, parseInt(scaleBaud));
      if (result.success) {
        setScaleConnected(true);
        setScalePort(portPath);
        setScaleDialogOpen(false);
      } else {
        setScaleError(`No se pudo conectar: ${result.error}`);
      }
    } catch (e) { setScaleError("Error de conexion"); setScaleConnected(false); }
    setScaleLoading(false);
  };

  const handleDisconnectScale = async () => {
    try {
      await window.api.invoke("disconnect-scale");
      setScaleConnected(false);
      setScalePort("");
      localStorage.removeItem("scalePort");
    } catch {}
  };

  const refreshTodayTasks = async () => {
    const today = await window.api.invoke("get-today-tasks");
    if (today.success) setTodayTasksCount(today.tasks.length);
  };

  const drawer = (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ flex: 1, overflow: "auto", px: drawerOpen ? 1.5 : 0.5, py: 1.5 }}>
          {navSections.map((section, sectionIdx) => (
            <Box key={section.title} sx={{ mb: 1.5 }}>
              {drawerOpen && (
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    py: 0.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: "0.65rem",
                    letterSpacing: "1px",
                    color: isDarkMode ? "rgba(148, 163, 184, 0.6)" : "rgba(35, 78, 140, 0.7)",
                    display: "block",
                  }}
                >
                  {section.title}
                </Typography>
              )}
              <List sx={{ px: 0, py: 0 }}>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItem key={item.text} disablePadding sx={{ mb: 0.3 }}>
                      <Tooltip title={!drawerOpen ? item.text : ""} placement="right">
                        <ListItemButton
                          component={RouterLink}
                          to={item.path}
                          sx={{
                            borderRadius: isActive && drawerOpen ? "0 10px 10px 0" : "10px",
                            mx: 0.5,
                            py: 1.2,
                            minHeight: 44,
                            background: isActive
                              ? isDarkMode
                                ? "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)"
                                : "linear-gradient(135deg, rgba(35, 78, 140, 0.12) 0%, rgba(35, 78, 140, 0.06) 100%)"
                              : "transparent",
                            border: isActive
                              ? isDarkMode
                                ? "1px solid rgba(37, 99, 235, 0.25)"
                                : "1px solid rgba(35, 78, 140, 0.2)"
                              : "1px solid transparent",
                            borderLeft: isActive && drawerOpen
                              ? isDarkMode
                                ? "3px solid #3b82f6"
                                : "3px solid #234e8c"
                              : "3px solid transparent",
                            color: isActive ? (isDarkMode ? "#f1f5f9" : "#0f172a") : (isDarkMode ? "#94a3b8" : "#64748b"),
                            "&:hover": {
                              background: isActive
                                ? isDarkMode
                                  ? "linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0.15) 100%)"
                                  : "linear-gradient(135deg, rgba(35, 78, 140, 0.18) 0%, rgba(35, 78, 140, 0.1) 100%)"
                                : isDarkMode
                                  ? "rgba(37, 99, 235, 0.08)"
                                  : "rgba(35, 78, 140, 0.06)",
                              transform: "translateX(3px)",
                            },
                            transition: "all 0.2s ease",
                            justifyContent: drawerOpen ? "flex-start" : "center",
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              color: isActive
                                ? isDarkMode
                                  ? "#60a5fa"
                                  : "#234e8c"
                                : (isDarkMode ? "#64748b" : "#94a3b8"),
                              minWidth: drawerOpen ? 38 : "auto",
                              justifyContent: "center",
                              fontSize: "1.3rem",
                            }}
                          >
                            {item.icon}
                          </ListItemIcon>
                          {drawerOpen && (
                            <ListItemText
                              primary={
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: isActive ? 600 : 500, fontSize: "0.9rem" }}
                                >
                                  {item.text}
                                </Typography>
                              }
                            />
                          )}
                        </ListItemButton>
                      </Tooltip>
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>
        <Divider sx={{ borderColor: isDarkMode ? "rgba(148,163,184,0.15)" : "rgba(28,48,72,0.15)" }} />
        <Box sx={{ px: drawerOpen ? 1.5 : 0.5, py: 0.8 }}>
          <Tooltip title={!drawerOpen ? "Configuración de tienda" : ""} placement="right">
            <ListItemButton
              onClick={() => setSettingsOpen(true)}
              sx={{
                borderRadius: "10px",
                mx: 0.5,
                py: 1.2,
                minHeight: 44,
                justifyContent: drawerOpen ? "flex-start" : "center",
                color: isDarkMode ? "#94a3b8" : "#64748b",
                "&:hover": {
                  background: isDarkMode ? "rgba(37, 99, 235, 0.08)" : "rgba(35, 78, 140, 0.06)",
                  transform: "translateX(3px)",
                },
                transition: "all 0.2s ease",
              }}
            >
              <ListItemIcon
                sx={{
                  color: isDarkMode ? "#64748b" : "#94a3b8",
                  minWidth: drawerOpen ? 38 : "auto",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                }}
              >
                <Settings sx={{ fontSize: "1.3rem" }} />
              </ListItemIcon>
              {drawerOpen && (
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.9rem" }}>
                      Configuración
                    </Typography>
                  }
                />
              )}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderRadius: 0,
          background: "#1E293B",
          borderBottom: "1px solid rgba(100, 116, 139, 0.25)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
        }}
      >
        <Toolbar sx={{ display: "flex", alignItems: "center", minHeight: "52px !important", px: { xs: 1, sm: 2 }, width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
            <IconButton
              sx={{ color: "#94a3b8", "&:hover": { color: "#f1f5f9", background: "rgba(255,255,255,0.1)" } }}
              aria-label="toggle drawer"
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              {drawerOpen ? <MenuOpen /> : <Menu />}
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9", letterSpacing: "0.5px" }}>
              {storeName}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title={isDark ? "Modo Claro" : "Modo Oscuro"}>
                <IconButton
                  size="small"
                  onClick={toggleMode}
                  sx={{
                    color: "#64748b",
                    "&:hover": {
                      color: "#fbbf24",
                      background: "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  {isDark ? <LightMode sx={{ fontSize: 18 }} /> : <DarkMode sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={serverRunning ? "Servidor activo" : "Servidor desconectado"}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
                  <Box sx={{
                    width: 7, height: 7, borderRadius: "50%",
                    bgcolor: serverRunning ? "#10b981" : "#ef4444",
                    boxShadow: serverRunning ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                  }} />
                </Box>
              </Tooltip>
              <Tooltip title={scaleConnected ? "Bascula conectada - Click para gestionar" : "Sin bascula - Click para conectar"}>
                <Box
                  onClick={handleOpenScaleDialog}
                  sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5, cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                >
                  <Box sx={{
                    width: 7, height: 7, borderRadius: "50%",
                    bgcolor: scaleConnected ? "#10b981" : "#64748b",
                    boxShadow: scaleConnected ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                  }} />
                  <Typography variant="caption" sx={{
                    color: scaleConnected ? "#10b981" : "#64748b",
                    fontSize: "0.6rem", fontWeight: 600, lineHeight: 1,
                  }}>
                    BASCULA
                  </Typography>
                </Box>
              </Tooltip>
              {registerOpen && (
                <Tooltip title="Caja abierta">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: "50%",
                      bgcolor: "#f59e0b",
                      boxShadow: "0 0 8px rgba(245,158,11,0.8)",
                      animation: "pulse 1.5s ease-in-out infinite",
                      "@keyframes pulse": {
                        "0%, 100%": { opacity: 1, transform: "scale(1)" },
                        "50%": { opacity: 0.5, transform: "scale(1.3)" },
                      },
                    }} />
                    <Typography variant="caption" sx={{ color: "#f59e0b", fontSize: "0.6rem", fontWeight: 600, lineHeight: 1 }}>
                      CAJA
                    </Typography>
                  </Box>
                </Tooltip>
              )}
              <Tooltip title="Tareas del día">
                <IconButton size="small" onClick={() => setTaskDialogOpen(true)} sx={{ color: "#94a3b8", "&:hover": { color: "#3b82f6" } }}>
                  <Badge badgeContent={todayTasksCount} color="error" overlap="circular" sx={{ "& .MuiBadge-badge": { fontSize: "0.55rem", minWidth: 16, height: 16 } }}>
                    <CalendarMonth sx={{ fontSize: 18 }} />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Box sx={{ textAlign: "center", minWidth: 75 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 500, lineHeight: 1.2, display: "block" }}>
                  {clock.toLocaleDateString("es-MX", {
                    day: "numeric", month: "short", timeZone: "America/Mexico_City",
                  })}
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.6rem", lineHeight: 1.2, display: "block" }}>
                  {clock.toLocaleTimeString("es-MX", {
                    hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City",
                  })}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(148,163,184,0.2)", mx: 0.5 }} />
              <Box sx={{ textAlign: "right", px: 1, py: 0.3 }}>
                <Typography variant="caption" sx={{ color: "#cbd5e1", fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.2, display: "block" }}>
                  {(cashier?.name || "Usuario").toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.6rem", lineHeight: 1.2, display: "block" }}>
                  {cashier?.role === "admin" ? "Propietario" : "Cajero"}
                </Typography>
              </Box>
              <Tooltip title="Cerrar sesión">
                <IconButton
                  size="small"
                  onClick={logout}
                  sx={{
                    color: "#64748b",
                    "&:hover": { color: "#ef4444", background: "rgba(239,68,68,0.1)" },
                  }}
                >
                  <Logout sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerOpen ? drawerWidth : miniDrawerWidth,
          flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "& .MuiDrawer-paper": {
            width: drawerOpen ? drawerWidth : miniDrawerWidth,
            boxSizing: "border-box",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowX: "hidden",
            background: isDarkMode ? "rgba(11, 17, 33, 0.98)" : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            borderRight: "1px solid rgba(100, 116, 139, 0.25)",
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-thumb": {
              background: isDarkMode ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.3)",
              borderRadius: "3px",
            },
          },
        }}
      >
        <Toolbar sx={{ minHeight: "64px !important" }} />
        {drawer}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            background: isDarkMode ? "rgba(11, 17, 33, 0.98)" : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
          },
        }}
      >
        <Toolbar />
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            xs: "100%",
            md: `calc(100% - ${drawerOpen ? drawerWidth : miniDrawerWidth}px)`,
          },
          minHeight: "100vh",
          background: isDarkMode ? "#0b1121" : "#f8f9ff",
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
          "&::before": {
            content: '""',
            position: "fixed",
            top: 0, right: 0, bottom: 0, left: 0,
            background: isDarkMode
              ? "radial-gradient(ellipse at top right, rgba(37, 99, 235, 0.03) 0%, transparent 60%)"
              : "radial-gradient(ellipse at top right, rgba(37, 99, 235, 0.04) 0%, transparent 60%)",
            pointerEvents: "none",
            zIndex: 0,
          },
        }}
      >
        <Toolbar sx={{ minHeight: "64px !important" }} />
        <Box sx={{ p: { xs: 2, md: 3 }, position: "relative", zIndex: 1 }}>
          <Outlet />
        </Box>
      </Box>

      <Dialog open={shortcutsDialogOpen} onClose={() => setShortcutsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QrCodeScanner sx={{ color: "#3b82f6" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Atajos de Teclado</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            {[
              { key: "F1", desc: "Mostrar esta ayuda" },
              { key: "F2", desc: "Agregar producto sin código (terminal)" },
              { key: "F3", desc: "Disminuir cantidad (terminal)" },
              { key: "F4", desc: "Aumentar cantidad (terminal)" },
              { key: "F8", desc: "Finalizar venta (terminal)" },
              { key: "Ctrl + Q", desc: "Enfocar búsqueda (terminal)" },
              { key: "Ctrl + B", desc: "Colapsar menú lateral" },
              { key: "Ctrl + N", desc: "Nuevo producto en inventario" },
              { key: "Ctrl + P", desc: "Ir a proveedores / Nuevo proveedor" },
              { key: "↑ ↓", desc: "Navegar resultados de búsqueda" },
              { key: "Enter", desc: "Confirmar en diálogos" },
              { key: "Esc", desc: "Cerrar sugerencias / diálogos" },
            ].map(({ key, desc }) => (
              <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Chip label={key} size="small" sx={{ minWidth: 72, fontWeight: 600, bgcolor: "rgba(59,130,246,0.1)", color: "primary.main" }} />
                <Typography variant="body2" color="textSecondary">{desc}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setShortcutsDialogOpen(false)} fullWidth>Cerrar</CancelButton>
        </DialogActions>
      </Dialog>

      {/* ─── AVISO DE CAJA ABIERTA ───────────────────── */}
      <Dialog
        open={!!registerNotice}
        onClose={() => setRegisterNotice(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setRegisterNotice(null);
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}
      >
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          <Stack spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(16, 185, 129, 0.12)",
              }}
            >
              <AccountBalance sx={{ fontSize: 28, color: "#059669" }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Caja Abierta
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="body1" color="textSecondary">
            {registerNotice
              ? `Caja abierta por ${registerNotice.opener_name || "otro usuario"}${
                  registerNotice.opened_at
                    ? ` a las ${formatMXTime(registerNotice.opened_at)}`
                    : ""
                }`
              : ""}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setRegisterNotice(null)}
            sx={{
              border: "1px solid",
              borderColor: "success.main",
              color: "success.main",
              backgroundColor: "rgba(16,185,129,0.06)",
              "&:hover": {
                backgroundColor: "rgba(16,185,129,0.12)",
                borderColor: "success.main",
              },
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <StoreSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Dialog open={scaleDialogOpen} onClose={() => setScaleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Scale sx={{ color: scaleConnected ? "#10b981" : "#64748b" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Bascula</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: scaleConnected ? "#10b981" : "#ef4444", boxShadow: scaleConnected ? "0 0 8px rgba(16,185,129,0.6)" : "none" }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: scaleConnected ? "#10b981" : "#ef4444" }}>
                {scaleConnected ? "Conectada" : "Desconectada"}
              </Typography>
            </Box>
            {scaleConnected ? (
              <Typography variant="body2" color="textSecondary">
                Puerto: <strong>{scalePort}</strong>
              </Typography>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body2" color="textSecondary">
                    Selecciona el puerto COM:
                  </Typography>
                  <Button size="small" onClick={handleRefreshPorts} disabled={scaleLoading} sx={{ textTransform: "none", minWidth: 0 }}>
                    Refrescar
                  </Button>
                </Box>
                {scaleError && <Alert severity="error" sx={{ py: 0 }}>{scaleError}</Alert>}
                {scaleLoading && <Typography variant="body2" color="textSecondary">Buscando puertos...</Typography>}
                {!scaleLoading && scalePorts.length === 0 && (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: "italic" }}>
                    No se detectaron puertos. Verifica la conexion USB.
                  </Typography>
                )}
                {!scaleLoading && scalePorts.length > 0 && (
                  <Stack spacing={0.5}>
                    {scalePorts.map((p) => (
                      <Button key={p.path} variant={scalePort === p.path ? "contained" : "outlined"} fullWidth
                        onClick={() => handleConnectScale(p.path)}
                        disabled={scaleLoading}
                        sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600 }}>
                        {p.path}{p.manufacturer ? ` - ${p.manufacturer}` : ""}
                      </Button>
                    ))}
                  </Stack>
                )}
                <TextField select label="Baud Rate" value={scaleBaud} size="small"
                  onChange={(e) => setScaleBaud(e.target.value)}>
                  <MenuItem value="9600">9600</MenuItem>
                  <MenuItem value="19200">19200</MenuItem>
                  <MenuItem value="38400">38400</MenuItem>
                  <MenuItem value="57600">57600</MenuItem>
                  <MenuItem value="115200">115200</MenuItem>
                </TextField>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {scaleConnected && (
            <Button onClick={handleDisconnectScale} color="error" sx={{ mr: "auto" }}>Desconectar</Button>
          )}
          <CancelButton onClick={() => setScaleDialogOpen(false)}>Cerrar</CancelButton>
        </DialogActions>
      </Dialog>

      {/* ─── TAREAS (lazy) ─────────────────────────────── */}
      <Suspense fallback={null}>
        <TaskDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} onTasksChange={refreshTodayTasks} />
      </Suspense>

      {/* ─── RECORDATORIO DE TAREA ───────────────────── */}
      <Dialog open={reminderDialog.open} onClose={() => setReminderDialog({ open: false, task: null })} maxWidth="xs" fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setReminderDialog({ open: false, task: null });
          }
        }}
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ textAlign: "center" }}>
          <Stack spacing={1} alignItems="center">
            <CalendarMonth sx={{ fontSize: 40, color: "#f59e0b" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Recordatorio</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: "1.1rem", mb: 0.5 }}>
            {reminderDialog.task?.title}
          </Typography>
          {reminderDialog.task?.task_time && (
            <Typography variant="body2" color="textSecondary">
              Hora: {reminderDialog.task.task_time}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button variant="contained" onClick={() => setReminderDialog({ open: false, task: null })}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout;
