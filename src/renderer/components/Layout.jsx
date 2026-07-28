import React, { useState, useEffect, useCallback } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,   Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, IconButton,
  useTheme, Divider, Chip, Stack, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import {
  PointOfSale, Inventory, Assessment, Menu, MenuOpen,
  Settings, Person, LocalShipping, Category,
  CompareArrows, AssessmentOutlined, Backup, QrCodeScanner,
  DarkMode, LightMode, Logout, AccountBalance,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";
import StoreSettingsDialog from "./StoreSettingsDialog";
import { useThemeMode } from "../contexts/ThemeContext";
import { useCashier } from "../contexts/CashierContext";

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

  const isDarkMode = theme.palette.mode === "dark";

  const checkRegisterStatus = useCallback(async () => {
    try {
      const result = await window.api.invoke("get-cash-register-status", { cashierId: cashier?.id, role: cashier?.role });
      setRegisterOpen(result.success && result.register?.status === "open");
    } catch (e) { setRegisterOpen(false); }
  }, [cashier?.id, cashier?.role]);

  useEffect(() => {
    checkRegisterStatus();
    const interval = setInterval(checkRegisterStatus, 10000);
    return () => clearInterval(interval);
  }, [checkRegisterStatus]);

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
    const timer = setInterval(() => setClock(new Date()), 10000);
    return () => clearInterval(timer);
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
              { key: "F8", desc: "Finalizar venta (terminal)" },
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

      <StoreSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
};

export default Layout;
