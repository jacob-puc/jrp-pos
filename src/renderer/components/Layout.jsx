import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
  Divider,
  Chip,
  Stack,
  Tooltip,
  TextField,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Badge,
  ListItemSecondaryAction,
  CircularProgress,
} from "@mui/material";
import {
  Package,
  Shapes,
  Truck,
  MonitorSmartphone,
  Landmark,
  History,
  ArrowLeftRight,
  BarChart3,
  User,
  DatabaseBackup,
  Settings,
  Menu,
  PanelLeftClose,
  Moon,
  Sun,
  LogOut,
  Scale,
  RefreshCw,
  CalendarDays,
  TriangleAlert,
  ArrowRight,
  ScanLine,
  Server,
} from "lucide-react";
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
  const [storeLogo, setStoreLogo] = useState("");
  const [clock, setClock] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isDark, toggleMode } = useThemeMode();
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverAddress, setServerAddress] = useState("");
  const { cashier, logout } = useCashier();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [handover, setHandover] = useState(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const noticeShownRef = useRef(false);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scalePorts, setScalePorts] = useState([]);
  const [scalePort, setScalePort] = useState(
    () => localStorage.getItem("scalePort") || "",
  );
  const [scaleBaud, setScaleBaud] = useState(
    () => localStorage.getItem("scaleBaud") || "115200",
  );
  const [scaleLoading, setScaleLoading] = useState(false);
  const [scaleError, setScaleError] = useState("");
  const [scaleReading, setScaleReading] = useState("");
  const [scaleLastWeight, setScaleLastWeight] = useState(null);
  const [scaleNote, setScaleNote] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [todayTasksCount, setTodayTasksCount] = useState(0);
  const [reminderDialog, setReminderDialog] = useState({
    open: false,
    task: null,
  });

  const isVisibleRef = useRef(true);
  useEffect(() => {
    const handle = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  const isDarkMode = theme.palette.mode === "dark";

  const checkRegisterStatus = useCallback(async () => {
    try {
      const result = await window.api.invoke("get-cash-register-status", {
        cashierId: cashier?.id,
        role: cashier?.role,
      });
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
        setHandover({
          registerId: reg.id,
          opener_name: reg.opener_name,
          opened_at: reg.opened_at,
          currentCash: reg.currentCash,
        });
      }
    } catch (e) {
      setRegisterOpen(false);
    }
  }, [cashier?.id, cashier?.role]);

  const handleHandoverConfirm = useCallback(async () => {
    if (!handover) return;
    setHandoverLoading(true);
    try {
      const declared = handover.currentCash || 0;
      const closeResult = await window.api.invoke("close-cash-register", {
        declaredClose: declared,
        expenses: 0,
        name: handover.opener_name || "Cambio de turno",
        cashierId: cashier?.id,
        role: cashier?.role,
        registerId: handover.registerId,
        force: true,
      });
      if (!closeResult.success) {
        setHandoverLoading(false);
        return;
      }
      await window.api.invoke("open-cash-register", {
        openingBalance: declared,
        cashierId: cashier?.id,
        role: cashier?.role,
      });
      setHandover(null);
      checkRegisterStatus();
    } catch (e) {
      /* noop */
    }
    setHandoverLoading(false);
  }, [handover, cashier?.id, cashier?.role, checkRegisterStatus]);

  useEffect(() => {
    checkRegisterStatus();
    const interval = setInterval(() => {
      if (isVisibleRef.current) checkRegisterStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkRegisterStatus]);

  useEffect(() => {
    const checkScale = async () => {
      if (!isVisibleRef.current) return false;
      try {
        const status = await window.api.invoke("is-scale-connected");
        setScaleConnected(status.connected);
        return status.connected;
      } catch {
        setScaleConnected(false);
        return false;
      }
    };
    let cancelled = false;
    const connectingRef = { current: false };
    const autoConnect = async () => {
      if (!scalePort) return;
      if (connectingRef.current) return;
      const alreadyConnected = await checkScale();
      if (cancelled) return;
      if (alreadyConnected) return;
      connectingRef.current = true;
      try {
        const result = await window.api.invoke(
          "connect-scale",
          scalePort,
          parseInt(scaleBaud),
        );
        if (!cancelled) {
          setScaleConnected(result.success);
          if (result.success) {
            setScaleReading(result.raw || "");
            setScaleLastWeight(result.weight ?? null);
            setScaleNote(result.error || "");
          }
        }
      } catch {
        if (!cancelled) setScaleConnected(false);
      } finally {
        connectingRef.current = false;
      }
    };
    autoConnect();
    const interval = setInterval(() => {
      if (cancelled) return;
      autoConnect();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scalePort, scaleBaud]);

  useEffect(() => {
    const unsub = window.api.on("scale-error", (msg) => {
      setScaleError(String(msg));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadStoreSettings = async () => {
      try {
        const name = await window.api.invoke("get-setting", "store_name");
        const logo = await window.api.invoke("get-setting", "store_logo");
        if (name) setStoreName(name.toUpperCase());
        if (logo) setStoreLogo(logo);
      } catch (error) {
        console.error("Error loading store settings:", error);
      }
    };
    loadStoreSettings();

    const checkServer = async () => {
      try {
        const status = await window.api.invoke("get-server-status");
        setServerRunning(status.running);
        setServerAddress(status.running && status.ip ? `${status.ip}:${status.port}` : "");
      } catch (e) {
        setServerRunning(false);
        setServerAddress("");
      }
    };
    checkServer();
    const serverTimer = setInterval(checkServer, 5000);

    const handleSetupCompleted = (event) => {
      const { storeName: newStoreName } = event.detail;
      if (newStoreName) setStoreName(newStoreName.toUpperCase());
    };
    window.addEventListener("setupCompleted", handleSetupCompleted);

    const handleSettingsUpdated = (event) => {
      const { storeName: newStoreName, storeLogo: newStoreLogo } = event.detail;
      if (newStoreName) setStoreName(newStoreName.toUpperCase());
      if (typeof newStoreLogo === "string") setStoreLogo(newStoreLogo);
    };
    window.addEventListener("storeSettingsUpdated", handleSettingsUpdated);

    return () => {
      clearInterval(serverTimer);
      window.removeEventListener("setupCompleted", handleSetupCompleted);
      window.removeEventListener("storeSettingsUpdated", handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isVisibleRef.current) setClock(new Date());
    }, 10000);
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
        setDrawerOpen((prev) => !prev);
      }
      if (e.key === "F1") {
        e.preventDefault();
        setShortcutsDialogOpen(true);
      }
      if (e.key === "F5") {
        e.preventDefault();
        navigate("/");
      }
      if (e.key === "F12") {
        e.preventDefault();
        logout();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname, navigate, logout]);

  const isAdmin = cashier?.role === "admin";

  const navSections = [
    {
      title: "Punto de Venta",
      items: [
        { text: "Terminal de Venta", icon: <MonitorSmartphone />, path: "/" },
        { text: "Caja", icon: <Landmark />, path: "/end-of-day" },
        ...(isAdmin
          ? [
              {
                text: "Historial de Caja",
                icon: <History />,
                path: "/register-history",
              },
            ]
          : []),
      ],
    },
    {
      title: "Inventario",
      items: [
        { text: "Productos", icon: <Package />, path: "/inventory" },
        { text: "Categorías", icon: <Shapes />, path: "/categories" },
        { text: "Proveedores", icon: <Truck />, path: "/suppliers" },
        {
          text: "Movimientos",
          icon: <ArrowLeftRight />,
          path: "/stock-movements",
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Reportes",
            items: [
              { text: "Reportes", icon: <BarChart3 />, path: "/reports" },
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
            {
              title: "Sistema",
              items: [
                { text: "Cajeros", icon: <User />, path: "/cashiers" },
                { text: "Respaldo", icon: <DatabaseBackup />, path: "/backup" },
              ],
            },
        ]
      : []),
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
    } catch {
      setScalePorts([]);
      setScaleError("Error al buscar puertos");
    }
    setScaleLoading(false);
  };

  const handleRefreshPorts = async () => {
    setScaleLoading(true);
    setScaleError("");
    try {
      const ports = await window.api.invoke("list-serial-ports");
      setScalePorts(ports);
    } catch {
      setScalePorts([]);
      setScaleError("Error al buscar puertos");
    }
    setScaleLoading(false);
  };

  const handleConnectScale = async (portPath, closeOnSuccess = true) => {
    setScaleLoading(true);
    setScaleError("");
    localStorage.setItem("scalePort", portPath);
    localStorage.setItem("scaleBaud", scaleBaud);
    try {
      const result = await window.api.invoke(
        "connect-scale",
        portPath,
        parseInt(scaleBaud),
      );
      setScaleReading(result.raw || "");
      setScaleLastWeight(result.weight ?? null);
      if (result.success) {
        setScaleConnected(true);
        setScalePort(portPath);
        setScaleNote(result.error || "");
        if (closeOnSuccess && !result.error) setScaleDialogOpen(false);
      } else {
        setScaleConnected(false);
        setScaleNote("");
        setScaleError(`No se pudo conectar: ${result.error}`);
      }
    } catch (e) {
      setScaleError("Error de conexion");
      setScaleConnected(false);
    }
    setScaleLoading(false);
  };

  const handleProbeScale = async () => {
    if (!scalePort) return;
    setScaleLoading(true);
    setScaleError("");
    try {
      const result = await window.api.invoke(
        "connect-scale",
        scalePort,
        parseInt(scaleBaud),
      );
      setScaleReading(result.raw || "");
      setScaleLastWeight(result.weight ?? null);
      if (result.success) {
        setScaleConnected(true);
        setScaleNote(result.error || "");
        if (result.error) setScaleError("");
      } else {
        setScaleError(`No se pudo conectar: ${result.error}`);
      }
    } catch (e) {
      setScaleError("Error de conexion");
    }
    setScaleLoading(false);
  };

  const handleDisconnectScale = async () => {
    try {
      await window.api.invoke("disconnect-scale");
      setScaleConnected(false);
      setScalePort("");
      setScaleReading("");
      setScaleLastWeight(null);
      setScaleNote("");
      setScaleError("");
      localStorage.removeItem("scalePort");
    } catch {}
  };

  const refreshTodayTasks = async () => {
    const today = await window.api.invoke("get-today-tasks");
    if (today.success) setTodayTasksCount(today.tasks.length);
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{ flex: 1, overflow: "auto", px: drawerOpen ? 1.5 : 0.5, py: 1.5 }}
      >
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
                  color: isDarkMode
                    ? "rgba(148, 163, 184, 0.6)"
                    : "rgba(35, 78, 140, 0.7)",
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
                    <Tooltip
                      title={!drawerOpen ? item.text : ""}
                      placement="right"
                    >
                      <ListItemButton
                        component={RouterLink}
                        to={item.path}
                        sx={{
                          borderRadius:
                            isActive && drawerOpen ? "0 6px 6px 0" : "6px",
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
                          borderLeft:
                            isActive && drawerOpen
                              ? isDarkMode
                                ? "3px solid #3b82f6"
                                : "3px solid #234e8c"
                              : "3px solid transparent",
                          color: isActive
                            ? isDarkMode
                              ? "#f1f5f9"
                              : "#0f172a"
                            : isDarkMode
                              ? "#94a3b8"
                              : "#64748b",
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
                              : isDarkMode
                                ? "#64748b"
                                : "#94a3b8",
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
                                sx={{
                                  fontWeight: isActive ? 600 : 500,
                                  fontSize: "0.9rem",
                                }}
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
      <Divider
        sx={{
          borderColor: isDarkMode
            ? "rgba(148,163,184,0.15)"
            : "rgba(28,48,72,0.15)",
        }}
      />
      <Box sx={{ px: drawerOpen ? 1.5 : 0.5, py: 0.8 }}>
        <Tooltip
          title={!drawerOpen ? "Configuración de tienda" : ""}
          placement="right"
        >
          <ListItemButton
            onClick={() => setSettingsOpen(true)}
            sx={{
              borderRadius: "4px",
              mx: 0.5,
              py: 1.2,
              minHeight: 44,
              justifyContent: drawerOpen ? "flex-start" : "center",
              color: isDarkMode ? "#94a3b8" : "#64748b",
              "&:hover": {
                background: isDarkMode
                  ? "rgba(37, 99, 235, 0.08)"
                  : "rgba(35, 78, 140, 0.06)",
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
              <Settings size={21} />
            </ListItemIcon>
            {drawerOpen && (
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, fontSize: "0.9rem" }}
                  >
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
        <Toolbar
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: "52px !important",
            px: { xs: 1, sm: 2 },
            width: "100%",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
            <IconButton
              sx={{
                color: "#94a3b8",
                "&:hover": {
                  color: "#f1f5f9",
                  background: "rgba(255,255,255,0.1)",
                },
              }}
              aria-label="toggle drawer"
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              {drawerOpen ? <PanelLeftClose /> : <Menu />}
            </IconButton>
          </Box>

          <Box
            sx={{
              flex: 1,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              minWidth: 0,
            }}
          >
            {storeLogo && (
              <Box
                component="img"
                src={storeLogo}
                alt="Logo"
                sx={{
                  height: 36,
                  maxWidth: 56,
                  borderRadius: 1,
                  objectFit: "contain",
                }}
              />
            )}
            <Typography
              variant="body1"
              sx={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "#f1f5f9",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
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
                  {isDark ? (
                    <Sun size={18} />
                  ) : (
                    <Moon size={18} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip
                title={
                  serverRunning
                    ? `Servidor activo · http://${serverAddress}`
                    : "Servidor desconectado"
                }
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    py: 0.6,
                    borderRadius: 2,
                    bgcolor: serverRunning
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(239,68,68,0.12)",
                    border: `1px solid ${
                      serverRunning
                        ? "rgba(16,185,129,0.35)"
                        : "rgba(239,68,68,0.35)"
                    }`,
                  }}
                >
                  <Server
                    size={13}
                    color={serverRunning ? "#10b981" : "#ef4444"}
                  />
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: serverRunning ? "#10b981" : "#ef4444",
                      boxShadow: serverRunning
                        ? "0 0 6px rgba(16,185,129,0.6)"
                        : "0 0 6px rgba(239,68,68,0.6)",
                      animation: serverRunning
                        ? "none"
                        : "pulseRed 1.5s ease-in-out infinite",
                      "@keyframes pulseRed": {
                        "0%, 100%": { opacity: 1, transform: "scale(1)" },
                        "50%": { opacity: 0.5, transform: "scale(1.3)" },
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: serverRunning ? "#10b981" : "#ef4444",
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {serverRunning && serverAddress
                      ? `SERVIDOR · ${serverAddress}`
                      : "SERVIDOR"}
                  </Typography>
                </Box>
              </Tooltip>
              <Tooltip
                title={
                  scaleConnected
                    ? `Bascula conectada - ${scalePort}`
                    : "Sin bascula - Click para conectar"
                }
              >
                <Box
                  onClick={handleOpenScaleDialog}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    py: 0.6,
                    borderRadius: 2,
                    cursor: "pointer",
                    bgcolor: scaleConnected
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(239,68,68,0.12)",
                    border: `1px solid ${
                      scaleConnected
                        ? "rgba(16,185,129,0.35)"
                        : "rgba(239,68,68,0.35)"
                    }`,
                    "&:hover": { opacity: 0.8 },
                  }}
                >
                  <Scale
                    size={13}
                    color={scaleConnected ? "#10b981" : "#ef4444"}
                  />
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: scaleConnected ? "#10b981" : "#ef4444",
                      boxShadow: scaleConnected
                        ? "0 0 6px rgba(16,185,129,0.6)"
                        : "0 0 6px rgba(239,68,68,0.6)",
                      animation: scaleConnected
                        ? "none"
                        : "pulseScale 1.5s ease-in-out infinite",
                      "@keyframes pulseScale": {
                        "0%, 100%": { opacity: 1, transform: "scale(1)" },
                        "50%": { opacity: 0.5, transform: "scale(1.3)" },
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: scaleConnected ? "#10b981" : "#ef4444",
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    BASCULA
                  </Typography>
                </Box>
              </Tooltip>
              {registerOpen && (
                <Tooltip title="Caja abierta">
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        bgcolor: "#f59e0b",
                        boxShadow: "0 0 8px rgba(245,158,11,0.8)",
                        animation: "pulse 1.5s ease-in-out infinite",
                        "@keyframes pulse": {
                          "0%, 100%": { opacity: 1, transform: "scale(1)" },
                          "50%": { opacity: 0.5, transform: "scale(1.3)" },
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#f59e0b",
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                    >
                      CAJA
                    </Typography>
                  </Box>
                </Tooltip>
              )}
              <Tooltip title="Tareas del día">
                <IconButton
                  size="small"
                  onClick={() => setTaskDialogOpen(true)}
                  sx={{ color: "#94a3b8", "&:hover": { color: "#3b82f6" } }}
                >
                  <Badge
                    badgeContent={todayTasksCount}
                    color="error"
                    overlap="circular"
                    sx={{
                      "& .MuiBadge-badge": {
                        fontSize: "0.55rem",
                        minWidth: 16,
                        height: 16,
                      },
                    }}
                  >
                    <CalendarDays size={18} />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Box sx={{ textAlign: "center", minWidth: 75 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#94a3b8",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    lineHeight: 1.2,
                    display: "block",
                  }}
                >
                  {clock.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    timeZone: "America/Mexico_City",
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#64748b",
                    fontSize: "0.6rem",
                    lineHeight: 1.2,
                    display: "block",
                  }}
                >
                  {clock.toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Mexico_City",
                  })}
                </Typography>
              </Box>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ borderColor: "rgba(148,163,184,0.2)", mx: 0.5 }}
              />
              <Box sx={{ textAlign: "right", px: 1, py: 0.3 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#cbd5e1",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    display: "block",
                  }}
                >
                  {(cashier?.name || "Usuario").toUpperCase()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#64748b",
                    fontSize: "0.6rem",
                    lineHeight: 1.2,
                    display: "block",
                  }}
                >
                  {cashier?.role === "admin" ? "Propietario" : "Cajero"}
                </Typography>
              </Box>
              <Tooltip title="Cerrar sesión">
                <IconButton
                  size="small"
                  onClick={logout}
                  sx={{
                    color: "#64748b",
                    "&:hover": {
                      color: "#ef4444",
                      background: "rgba(239,68,68,0.1)",
                    },
                  }}
                >
                  <LogOut size={16} />
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
            background: isDarkMode
              ? "rgba(11, 17, 33, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            borderRight: "1px solid rgba(100, 116, 139, 0.25)",
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-thumb": {
              background: isDarkMode
                ? "rgba(148, 163, 184, 0.3)"
                : "rgba(100, 116, 139, 0.3)",
              borderRadius: "2px",
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
            background: isDarkMode
              ? "rgba(11, 17, 33, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
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
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
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

      <Dialog
        open={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ScanLine size={20} color="#3b82f6" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Atajos de Teclado
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            {[
              { key: "F1", desc: "Mostrar esta ayuda" },
              { key: "F5", desc: "Ir a la terminal de venta" },
              { key: "F2", desc: "Agregar producto sin código (terminal)" },
              { key: "F6", desc: "Descuento manual del producto (terminal)" },
              { key: "F3", desc: "Disminuir cantidad (terminal)" },
              { key: "F4", desc: "Aumentar cantidad (terminal)" },
              { key: "F8", desc: "Finalizar venta (terminal)" },
              { key: "F10", desc: "Retirar efectivo (terminal)" },
              {
                key: "F11",
                desc: "Cerrar caja (terminal, sin venta en curso)",
              },
              { key: "F12", desc: "Cerrar sesión" },
              { key: "Ctrl + Q", desc: "Enfocar búsqueda (terminal)" },
              { key: "Ctrl + B", desc: "Colapsar menú lateral" },
              { key: "Ctrl + N", desc: "Nuevo producto en inventario" },
              { key: "Ctrl + P", desc: "Ir a proveedores / Nuevo proveedor" },
              { key: "↑ ↓", desc: "Navegar resultados de búsqueda" },
              { key: "Enter", desc: "Confirmar en diálogos" },
              { key: "Esc", desc: "Cerrar sugerencias / diálogos" },
            ].map(({ key, desc }) => (
              <Box
                key={key}
                sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
              >
                <Chip
                  label={key}
                  size="small"
                  sx={{
                    minWidth: 72,
                    fontWeight: 600,
                    bgcolor: "rgba(59,130,246,0.1)",
                    color: "primary.main",
                  }}
                />
                <Typography variant="body2" color="textSecondary">
                  {desc}
                </Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setShortcutsDialogOpen(false)} fullWidth>
            Cerrar
          </CancelButton>
        </DialogActions>
      </Dialog>

      {/* ─── CAJA ANTERIOR ABIERTA (CAMBIO DE TURNO) ───── */}
      <Dialog
        open={!!handover}
        onClose={() => {}}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !handoverLoading) {
            e.preventDefault();
            handleHandoverConfirm();
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "8px" } }}
      >
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          <Stack spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(245, 158, 11, 0.14)",
              }}
            >
              <TriangleAlert size={28} color="#d97706" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Caja anterior abierta
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
            La caja sigue abierta por{" "}
            <strong>{handover?.opener_name || "otro cajero"}</strong>
            {handover?.opened_at
              ? ` a las ${formatMXTime(handover.opened_at)}`
              : ""}
            . Para trabajar con tu propia caja, ciérrala y abre una nueva.
          </Typography>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "8px",
              bgcolor: isDarkMode ? "rgba(15,23,42,0.5)" : "#f8fafc",
              py: 1.5,
              px: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "textSecondary",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontSize: "0.6rem",
                display: "block",
              }}
            >
              Efectivo a declarar
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#059669" }}>
              ${(handover?.currentCash || 0).toFixed(2)}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ fontSize: "0.68rem", display: "block", mt: 0.5 }}
            >
              Se declarará como cierre y quedará como apertura de tu nueva caja.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, flexDirection: "column", gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={handoverLoading}
            onClick={handleHandoverConfirm}
            startIcon={
              handoverLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <ArrowRight />
              )
            }
            sx={{
              bgcolor: "#059669",
              "&:hover": { bgcolor: "#047857" },
              textTransform: "none",
            }}
          >
            Cerrar y abrir nueva caja
          </Button>
          <Button
            variant="text"
            fullWidth
            disabled={handoverLoading}
            onClick={() => {
              setHandover(null);
              logout();
            }}
            sx={{ color: "#64748b", textTransform: "none" }}
          >
            Ahora no (cerrar sesión)
          </Button>
        </DialogActions>
      </Dialog>

      <StoreSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin={cashier?.role === "admin"}
      />

      <Dialog
        open={scaleDialogOpen}
        onClose={() => setScaleDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Scale size={20} color={scaleConnected ? "#10b981" : "#64748b"} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Bascula
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: scaleConnected ? "#10b981" : "#ef4444",
                  boxShadow: scaleConnected
                    ? "0 0 8px rgba(16,185,129,0.6)"
                    : "none",
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: scaleConnected ? "#10b981" : "#ef4444",
                }}
              >
                {scaleConnected ? "Conectada" : "Desconectada"}
              </Typography>
            </Box>
            {scaleConnected ? (
              <>
                <Typography variant="body2" color="textSecondary">
                  Puerto: <strong>{scalePort}</strong>
                </Typography>
                {scaleReading && (
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: "4px",
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography variant="body2" color="textSecondary">
                      Última lectura: <strong>{scaleReading}</strong>
                    </Typography>
                    {scaleLastWeight != null && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ mt: 0.25 }}
                      >
                        Peso: <strong>{scaleLastWeight}</strong>
                      </Typography>
                    )}
                  </Box>
                )}
                {scaleNote && (
                  <Alert severity="warning" sx={{ py: 0 }}>
                    {scaleNote}
                  </Alert>
                )}
                {scaleError && (
                  <Alert severity="error" sx={{ py: 0 }}>
                    {scaleError}
                  </Alert>
                )}
                <Button
                  onClick={handleProbeScale}
                  disabled={scaleLoading}
                  startIcon={
                    scaleLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <RefreshCw size={16} />
                    )
                  }
                  sx={{ textTransform: "none", alignSelf: "flex-start" }}
                >
                  Probar lectura
                </Button>
              </>
            ) : (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body2" color="textSecondary">
                    Selecciona el puerto COM:
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleRefreshPorts}
                    disabled={scaleLoading}
                    sx={{ textTransform: "none", minWidth: 0 }}
                  >
                    Refrescar
                  </Button>
                </Box>
                {scaleError && (
                  <Alert severity="error" sx={{ py: 0 }}>
                    {scaleError}
                  </Alert>
                )}
                {scaleLoading && (
                  <Typography variant="body2" color="textSecondary">
                    Buscando puertos...
                  </Typography>
                )}
                {!scaleLoading && scalePorts.length === 0 && (
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    No se detectaron puertos. Verifica la conexion USB.
                  </Typography>
                )}
                {!scaleLoading && scalePorts.length > 0 && (
                  <Stack spacing={0.5}>
                    {scalePorts.map((p) => (
                      <Button
                        key={p.path}
                        variant={
                          scalePort === p.path ? "contained" : "outlined"
                        }
                        fullWidth
                        onClick={() => handleConnectScale(p.path)}
                        disabled={scaleLoading}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      >
                        {p.path}
                        {p.manufacturer ? ` - ${p.manufacturer}` : ""}
                      </Button>
                    ))}
                  </Stack>
                )}
                <TextField
                  select
                  label="Baud Rate"
                  value={scaleBaud}
                  size="small"
                  onChange={(e) => setScaleBaud(e.target.value)}
                >
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
            <Button
              onClick={handleDisconnectScale}
              color="error"
              sx={{ mr: "auto" }}
            >
              Desconectar
            </Button>
          )}
          <CancelButton onClick={() => setScaleDialogOpen(false)}>
            Cerrar
          </CancelButton>
        </DialogActions>
      </Dialog>

      {/* ─── TAREAS (lazy) ─────────────────────────────── */}
      <Suspense fallback={null}>
        <TaskDialog
          open={taskDialogOpen}
          onClose={() => setTaskDialogOpen(false)}
          onTasksChange={refreshTodayTasks}
        />
      </Suspense>

      {/* ─── RECORDATORIO DE TAREA ───────────────────── */}
      <Dialog
        open={reminderDialog.open}
        onClose={() => setReminderDialog({ open: false, task: null })}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setReminderDialog({ open: false, task: null });
          }
        }}
        PaperProps={{ sx: { borderRadius: "8px" } }}
      >
        <DialogTitle sx={{ textAlign: "center" }}>
          <Stack spacing={1} alignItems="center">
            <CalendarDays size={40} color="#f59e0b" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Recordatorio
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography
            variant="body1"
            sx={{ fontWeight: 600, fontSize: "1.1rem", mb: 0.5 }}
          >
            {reminderDialog.task?.title}
          </Typography>
          {reminderDialog.task?.task_time && (
            <Typography variant="body2" color="textSecondary">
              Hora: {reminderDialog.task.task_time}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            variant="contained"
            onClick={() => setReminderDialog({ open: false, task: null })}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout;
