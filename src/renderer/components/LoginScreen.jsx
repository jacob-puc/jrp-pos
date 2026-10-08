import React, { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Paper, Avatar, Stack, TextField, Button, useTheme, Alert, Chip, Skeleton,
} from "@mui/material";
import { Person, ArrowForward, CheckCircle, Lock } from "@mui/icons-material";
import { useCashier } from "../contexts/CashierContext";
import useDbChanges from "../utils/useDbChanges";

const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const LoginScreen = ({ onLogin }) => {
  const [cashiers, setCashiers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [storeName, setStoreName] = useState("MI TIENDA");
  const [storeLogo, setStoreLogo] = useState("");
  const theme = useTheme();
  const { setCashier } = useCashier();
  const pinRef = useRef(null);
  const isDark = theme.palette.mode === "dark";

  const load = async ({ silent = false } = {}) => {
    if (!silent) setUsersLoading(true);
    try {
      const [list, name, logo] = await Promise.all([
        window.api.invoke("get-cashiers"),
        window.api.invoke("get-setting", "store_name"),
        window.api.invoke("get-setting", "store_logo"),
      ]);
      // Solo usuarios activos pueden iniciar sesión (igual en Host y Cliente).
      setCashiers((Array.isArray(list) ? list : []).filter((c) => c.is_active !== 0));
      if (name) setStoreName(name.toUpperCase());
      if (logo) setStoreLogo(logo);
    } catch {}
    if (!silent) setUsersLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Usuarios dados de alta en el Host aparecen solos en esta pantalla
  useDbChanges(() => load({ silent: true }));

  useEffect(() => {
    if (selectedId) pinRef.current?.focus();
  }, [selectedId]);

  const handleUserClick = (id) => {
    setSelectedId(id);
    setPin("");
    setError("");
  };

  const handlePinChange = (e) => {
    setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
    setError("");
  };

  const handleSubmit = async () => {
    if (!selectedId) { setError("Selecciona un usuario"); return; }
    if (pin.length < 3) { setError("Ingresa el PIN completo"); return; }
    setLoading(true);
    try {
      const result = await window.api.invoke("verify-cashier-pin", selectedId, pin);
      if (result.success) {
        setCashier(result.cashier);
        if (onLogin) onLogin(result.cashier);
      } else {
        setError(result.error || "PIN incorrecto");
      }
    } catch { setError("Error al verificar PIN"); }
    setLoading(false);
  };

  return (
    <Box sx={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", p: 4,
      background: isDark
        ? "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)"
        : "linear-gradient(135deg, #f0f7ff 0%, #e2ecf8 100%)",
    }}>
      <Box sx={{ textAlign: "center", mb: 5, animation: "fadeIn 0.7s ease-out" }}>
        {storeLogo ? (
          <Box sx={{
            width: 88, height: 88, borderRadius: "12px", mx: "auto", mb: 2.5, overflow: "hidden",
            background: "rgba(255,255,255,0.9)",
            border: "2px solid rgba(37, 99, 235, 0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(37, 99, 235, 0.25)",
          }}>
            <img src={storeLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
        ) : (
          <Box sx={{
            width: 80, height: 80, borderRadius: "12px", mx: "auto", mb: 2.5,
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(37, 99, 235, 0.35)",
          }}>
            <Person sx={{ color: "white", fontSize: 40 }} />
          </Box>
        )}
        <Typography variant="h4" sx={{ fontWeight: 900, fontSize: "1.8rem", letterSpacing: "1px", color: isDark ? "#f1f5f9" : "#0f172a" }}>
          {storeName}
        </Typography>
        <Typography variant="body1" sx={{ color: isDark ? "#94a3b8" : "#64748b", mt: 0.5, fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", fontSize: "0.85rem" }}>
          Sistema de Punto de Venta
        </Typography>
      </Box>

      <Paper elevation={0} sx={{
        width: "100%", maxWidth: 960, display: "flex", borderRadius: "12px", overflow: "hidden",
        border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "rgba(37,99,235,0.1)"}`,
        background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        boxShadow: isDark ? "0 25px 60px rgba(0,0,0,0.5)" : "0 25px 60px rgba(0,0,0,0.08)",
      }}>
        <Box sx={{
          width: 380, minWidth: 380, p: 3.5, display: "flex", flexDirection: "column",
          borderRight: `1px solid ${isDark ? "rgba(59,130,246,0.1)" : "rgba(37,99,235,0.08)"}`,
        }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 700, mb: 2, textTransform: "uppercase", letterSpacing: "1px",
            color: isDark ? "#94a3b8" : "#64748b", fontSize: "0.7rem",
          }}>
            Seleccionar Usuario
          </Typography>
          <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 1.5 }}>
            {usersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: "10px", background: "transparent" }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Skeleton variant="circular" width={48} height={48} sx={{ bgcolor: isDark ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.06)" }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: isDark ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.06)" }} />
                      <Skeleton variant="text" width="35%" height={16} sx={{ bgcolor: isDark ? "rgba(148,163,184,0.04)" : "rgba(100,116,139,0.04)" }} />
                    </Box>
                  </Stack>
                </Paper>
              ))
            ) : cashiers.map((c, idx) => {
              const isSelected = selectedId === c.id;
              const initial = c.name.charAt(0).toUpperCase();
              const bgColor = colors[idx % colors.length];
              return (
                <Paper
                  key={c.id}
                  onClick={() => handleUserClick(c.id)}
                  elevation={0}
                  sx={{
                    p: 2, cursor: "pointer", borderRadius: "10px",
                    border: `2px solid ${isSelected ? bgColor : "transparent"}`,
                    background: isSelected
                      ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)")
                      : "transparent",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{
                      width: 48, height: 48, fontWeight: 700, fontSize: "1.1rem",
                      background: isSelected ? bgColor : (isDark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.12)"),
                      color: isSelected ? "white" : (isDark ? "#94a3b8" : "#64748b"),
                    }}>
                      {initial}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a" }}>
                        {c.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                        {c.role === "admin" ? "Propietario" : "Cajero"}
                      </Typography>
                    </Box>
                    {isSelected && <CheckCircle sx={{ color: bgColor, fontSize: 22 }} />}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 5 }}>
          {!selectedId ? (
            <Box sx={{ textAlign: "center", opacity: 0.4 }}>
              <Person sx={{ fontSize: 72, color: isDark ? "#64748b" : "#94a3b8", mb: 2 }} />
              <Typography variant="h6" sx={{ color: isDark ? "#64748b" : "#94a3b8", fontWeight: 500 }}>
                Selecciona un usuario
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
              <Avatar sx={{
                width: 72, height: 72, mx: "auto", mb: 1.5, fontWeight: 700, fontSize: "1.5rem",
                background: colors[selectedId % colors.length],
                boxShadow: `0 8px 24px ${colors[selectedId % colors.length]}44`,
              }}>
                {cashiers.find(c => c.id === selectedId)?.name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.25, color: isDark ? "#f1f5f9" : "#0f172a" }}>
                {cashiers.find(c => c.id === selectedId)?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: isDark ? "#94a3b8" : "#64748b", mb: 0.5 }}>
                {cashiers.find(c => c.id === selectedId)?.role === "admin" ? "Propietario" : "Cajero"}
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? "#64748b" : "#94a3b8", display: "block", mb: 3 }}>
                Ingresa tu PIN de acceso
              </Typography>

              <TextField
                ref={pinRef}
                value={pin}
                onChange={handlePinChange}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                type="password"
                placeholder="••••"
                inputProps={{ maxLength: 6, style: { textAlign: "center", fontSize: "1.8rem", letterSpacing: "12px", fontWeight: 700 } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                  },
                }}
                fullWidth
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: "6px", py: 0.5 }}>
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={loading || pin.length < 3}
                sx={{
                  mt: 3, py: 1.6, borderRadius: "10px", fontWeight: 700, fontSize: "1rem",
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
                  "&:hover": { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" },
                  "&:disabled": { opacity: 0.5 },
                }}
                endIcon={<ArrowForward />}
              >
                {loading ? "Verificando..." : "Entrar"}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      <Typography variant="caption" sx={{ mt: 4, color: isDark ? "#475569" : "#94a3b8", opacity: 0.6 }}>
        JRP POS v1.0
      </Typography>
    </Box>
  );
};

export default LoginScreen;
