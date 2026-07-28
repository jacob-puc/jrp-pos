import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, List, ListItem, Card, CardContent, Grid, Button,
  Stack, Chip, useTheme, Alert, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, InputAdornment, Divider, Fade, CircularProgress,
} from "@mui/material";
import {
  AttachMoney, Receipt, TrendingUp, Print, Assessment, CalendarToday,
  AccessTime,   ShoppingCart, Visibility, CheckCircle, Cancel, AccountBalance,
  CreditCard, MoneyOff, Store, Warning, History, RemoveShoppingCart,
} from "@mui/icons-material";
import { CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import { mxToday, formatMXDateTime } from "../utils/dateUtils";
import { useCashier } from "../contexts/CashierContext";

const EndOfDay = () => {
  const { cashier } = useCashier();
  const [sales, setSales] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [register, setRegister] = useState(null);
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [closeRegisterModal, setCloseRegisterModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [declaredClose, setDeclaredClose] = useState("");
  const [expenses, setExpenses] = useState("");
  const [registerMessage, setRegisterMessage] = useState(null);
  const [closedRegisters, setClosedRegisters] = useState([]);
  const [registerDetailModal, setRegisterDetailModal] = useState(false);
  const [registerDetailData, setRegisterDetailData] = useState(null);
  const [registerName, setRegisterName] = useState("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [expensesList, setExpensesList] = useState([]);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const regResult = await window.api.invoke("get-cash-register-status", { cashierId: cashier?.id, role: cashier?.role });
    const reg = regResult.success ? regResult.register : null;
    setRegister(reg);

    const { success, sales: fetchedSales } = await window.api.invoke("get-sales-for-today", {
      date: mxToday(),
      registerId: reg?.id || null,
    });
    if (success) {
      setSales(fetchedSales || []);
      const total = (fetchedSales || []).reduce((sum, sale) => sum + sale.total, 0);
      setTotalSales(total);
      setSalesCount(fetchedSales?.length || 0);
    }
    const closedResult = await window.api.invoke("get-closed-registers", { cashierId: cashier?.id, role: cashier?.role });
    if (closedResult.success) setClosedRegisters(closedResult.registers || []);
    if (reg?.status === "open") {
      const expResult = await window.api.invoke("get-cash-register-expenses", { cashierId: cashier?.id, role: cashier?.role });
      if (expResult.success) setExpensesList(expResult.expenses || []);
    }
    setLoading(false);
  }, [cashier?.id, cashier?.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenRegister = async () => {
    const result = await window.api.invoke("open-cash-register", {
      openingBalance: parseFloat(openingBalance) || 0,
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (result.success) { setOpenRegisterModal(false); fetchData(); setRegisterMessage({ type: "success", text: "Caja abierta exitosamente" }); }
    else setRegisterMessage({ type: "error", text: result.error });
  };

  const handleCloseRegister = async () => {
    const result = await window.api.invoke("close-cash-register", {
      declaredClose: parseFloat(declaredClose) || 0,
      expenses: parseFloat(expenses) || 0,
      name: registerName.trim() || `Cierre ${new Date().toLocaleString("es-MX")}`,
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (result.success) {
      setCloseRegisterModal(false);
      setRegisterName("");
      fetchData();
      setRegisterMessage({ type: "success", text: `Caja cerrada. Esperado: $${result.expectedClose.toFixed(2)}, Diferencia: $${result.difference.toFixed(2)}` });
    } else setRegisterMessage({ type: "error", text: result.error });
  };

  const printDailyReport = () => {
    const now = new Date();
    const today = now.toLocaleDateString();
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte Diario</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#333}
      h1{color:#2563eb;text-align:center}
      .summary{display:flex;gap:20px;margin:20px 0;justify-content:center;flex-wrap:wrap}
      .card{border:2px solid #e2e8f0;border-radius:8px;padding:20px;text-align:center;min-width:150px}
      .num{font-size:24px;font-weight:bold;color:#1e293b}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th{background:#2563eb;color:white;padding:10px;text-align:left}
      .footer{text-align:center;margin-top:40px;color:#666;font-size:12px;border-top:2px solid #e2e8f0;padding-top:20px}
      .signature{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:100px}
      .sig-box{text-align:center;border-top:2px solid #333;padding-top:10px;margin-top:40px}
    </style></head><body>
      <h1>MI TIENDA POS</h1>
      <p style="text-align:center">Reporte Diario de Ventas<br>${today}</p>
      <div class="summary">
        <div class="card"><div>Ventas Totales</div><div class="num">$${totalSales.toFixed(2)}</div></div>
        <div class="card"><div>Transacciones</div><div class="num">${salesCount}</div></div>
      </div>
      ${register ? `<div class="summary">
        <div class="card"><div>Apertura</div><div class="num">$${register.opening_balance.toFixed(2)}</div></div>
        <div class="card"><div>Efectivo</div><div class="num">$${register.cash_sales.toFixed(2)}</div></div>
        <div class="card"><div>Tarjeta</div><div class="num">$${register.card_sales.toFixed(2)}</div></div>
        <div class="card"><div>Transferencia</div><div class="num">$${register.transfer_sales.toFixed(2)}</div></div>
      </div>` : ""}
      <table><tr><th>ID</th><th>Hora</th><th>Método</th><th>Total</th></tr>
      ${sales.map(s => `<tr><td>#${s.id}</td><td>${new Date(s.created_at).toLocaleTimeString()}</td><td>${s.payment_method}</td><td>$${s.total.toFixed(2)}</td></tr>`).join("")}
      <tr style="background:#2563eb;color:white;font-weight:bold"><td colspan="3">TOTAL DEL DÍA</td><td>$${totalSales.toFixed(2)}</td></tr>
      </table>
      <div class="signature"><div class="sig-box">Cajero</div><div class="sig-box">Supervisor</div></div>
      <div class="footer">Generado el ${formatMXDateTime(now)}</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const handleViewRegisterDetail = async (registerId) => {
    const result = await window.api.invoke("get-register-sales-detail", registerId);
    if (result.success) {
      setRegisterDetailData(result);
      setRegisterDetailModal(true);
    }
  };

  const handleRegisterExpense = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { setRegisterMessage({ type: "error", text: "Ingresa un monto válido" }); return; }
    if (!withdrawReason.trim()) { setRegisterMessage({ type: "error", text: "Ingresa el motivo del retiro" }); return; }
    setWithdrawLoading(true);
    const result = await window.api.invoke("register-cash-expense", {
      amount, reason: withdrawReason.trim(),
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    setWithdrawLoading(false);
    if (result.success) {
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setWithdrawReason("");
      fetchData();
      setRegisterMessage({ type: "success", text: `Retiro de $${amount.toFixed(2)} registrado: ${withdrawReason.trim()}` });
    } else {
      setRegisterMessage({ type: "error", text: result.error });
    }
  };

  const isOpen = register?.status === "open";
  const totalCash = sales.filter(s => s.payment_method === "cash").reduce((sum, s) => sum + s.total, 0);
  const totalCard = sales.filter(s => s.payment_method === "card").reduce((sum, s) => sum + s.total, 0);
  const totalTransfer = sales.filter(s => s.payment_method === "transfer").reduce((sum, s) => sum + s.total, 0);
  const isAdmin = cashier?.role === "admin";
  const dayItems = [
    ...sales.map(s => ({
      type: 'sale', id: `sale-${s.id}`,
      title: `Venta #${s.id}`,
      desc: s.payment_method === "cash" ? "Efectivo" : s.payment_method === "card" ? "Tarjeta" : "Transferencia",
      time: s.created_at, amount: s.total,
      icon: <ShoppingCart sx={{ fontSize: 20 }} />,
      iconBg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    })),
    ...expensesList.map(e => ({
      type: 'expense', id: `exp-${e.id}`,
      title: e.reason.startsWith("Compra") ? "Compra de inventario" : "Retiro de efectivo",
      desc: e.reason,
      time: e.created_at, amount: -e.amount,
      icon: <RemoveShoppingCart sx={{ fontSize: 20 }} />,
      iconBg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 2, textAlign: "center", fontSize: "1.8rem" }}>Caja</Typography>

      {registerMessage && (
        <Alert severity={registerMessage.type} sx={{ mb: 2 }} onClose={() => setRegisterMessage(null)}>
          {registerMessage.text}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ textAlign: "left" }}>
          <Typography variant="caption" color="textSecondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.75rem", fontWeight: 500, lineHeight: 1.3 }}>
            <CalendarToday fontSize="small" />
            {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Mexico_City" })}
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.65rem", ml: 3, lineHeight: 1.3 }}>
            {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {register ? (
            <Chip icon={isOpen ? <CheckCircle /> : <Cancel />}
              label={isOpen ? "Caja Abierta" : "Caja Cerrada"}
              color={isOpen ? "success" : "error"} variant="filled"
              sx={{ fontSize: "0.85rem", px: 2, fontWeight: 700 }} />
          ) : (
            <Chip icon={<Warning />} label="SIN APERTURA" color="warning" variant="filled"
              sx={{ fontSize: "0.95rem", px: 3, py: 2.5, fontWeight: 800, "& .MuiChip-icon": { fontSize: 20 } }} />
          )}
        </Stack>
      </Box>

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)", border: "2px solid rgba(16, 185, 129, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.15)" }}>
                  <AttachMoney sx={{ fontSize: 22, color: theme.palette.success.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Ventas Totales</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: "1.25rem", lineHeight: 1.1 }}>${totalSales.toFixed(2)}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%)", border: "2px solid rgba(59, 130, 246, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
                  <Receipt sx={{ fontSize: 22, color: theme.palette.primary.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Transacciones</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: "1.25rem", lineHeight: 1.1 }}>{salesCount}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.12) 100%)", border: "2px solid rgba(59, 130, 246, 0.15)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
                  <AccountBalance sx={{ fontSize: 22, color: theme.palette.primary.dark }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Efectivo en Caja</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.dark, fontSize: "1.25rem", lineHeight: 1.1 }}>
                    ${isOpen ? (register.opening_balance + (register.cash_sales || 0) - (register.expenses || 0)).toFixed(2) : "0.00"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Fade>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap", justifyContent: "center" }}>
        <Card sx={{ flex: "1 1 160px", background: `linear-gradient(135deg, ${isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.05)"} 0%, ${isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)"} 100%)`, border: `2px solid ${isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)"}` }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.15)" }}>
              <AttachMoney sx={{ fontSize: 20, color: theme.palette.success.main }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>Efectivo</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: "1rem", lineHeight: 1.1 }}>${totalCash.toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: "1 1 160px", background: `linear-gradient(135deg, ${isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.05)"} 0%, ${isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.08)"} 100%)`, border: `2px solid ${isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(37, 99, 235, 0.15)"}` }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
              <CreditCard sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>Tarjeta</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: "1rem", lineHeight: 1.1 }}>${totalCard.toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: "1 1 160px", background: `linear-gradient(135deg, ${isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.05)"} 0%, ${isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)"} 100%)`, border: `2px solid ${isDark ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)"}` }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.15)" }}>
              <AccountBalance sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>Transferencia</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.warning.main, fontSize: "1rem", lineHeight: 1.1 }}>${totalTransfer.toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3, flexWrap: "wrap" }}>
        {!isOpen && (
          <Button variant="contained" size="large" startIcon={<Store />}
            onClick={() => { setOpeningBalance(""); setOpenRegisterModal(true); }}
            sx={{ px: 3, fontSize: "0.9rem" }}>
            Abrir Caja
          </Button>
        )}
        {isOpen && (
          <Button variant="contained" size="large" color="warning" startIcon={<MoneyOff />}
            onClick={() => { setDeclaredClose(""); setExpenses(""); setRegisterName(""); setCloseRegisterModal(true); }}
            sx={{ px: 3, fontSize: "0.9rem" }}>
            Cerrar Caja
          </Button>
        )}
        {isOpen && (
          <Button variant="contained" size="large" color="error" startIcon={<RemoveShoppingCart />}
            onClick={() => { setWithdrawAmount(""); setWithdrawReason(""); setWithdrawDialogOpen(true); }}
            sx={{ px: 3, fontSize: "0.9rem" }}>
            Retirar Dinero
          </Button>
        )}
        <Button variant="outlined" size="large" startIcon={<Print />}
          onClick={printDailyReport} sx={{ px: 3, fontSize: "0.9rem" }}>
          Imprimir Reporte
        </Button>
        {isOpen && (
          <Button variant="outlined" size="large" startIcon={<Visibility />}
            onClick={() => setDetailsModalOpen(true)} sx={{ px: 3, fontSize: "0.9rem" }}>
            Ver Detalles
          </Button>
        )}
      </Stack>

      {isOpen && register && (
        <Box sx={{ maxWidth: 700, mx: "auto", mb: 3 }}>
          <Card>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 1, justifyContent: "center" }}>
                <AccountBalance color="primary" /> Resumen de Caja
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: "Apertura", value: register.opening_balance },
                  { label: "Efectivo", value: totalCash },
                  { label: "Tarjeta", value: totalCard },
                  { label: "Transferencia", value: totalTransfer },
                  { label: "Gastos", value: register.expenses || 0 },
                  { label: "Cierre Esperado", value: register.opening_balance + totalCash - (register.expenses || 0) },
                ].map((item, idx) => (
                  <Grid item xs={6} md={4} key={idx}>
                    <Paper variant="outlined" sx={{
                      p: 1.5, textAlign: "center", width: "100%",
                      bgcolor: isDark ? "rgba(255,255,255,0.03)" : "grey.50",
                    }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", display: "block", mb: 0.5, fontWeight: 500 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "1rem" }}>
                        ${item.value.toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
          </CardContent>
          </Card>
        </Box>
      )}

      {isOpen && register && (
        <Card>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5, fontSize: "1rem", display: "flex", alignItems: "center", gap: 1 }}>
              <Assessment /> Detalle del Día
            </Typography>
            {dayItems.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: "center", py: 3 }}>
                No hay movimientos registrados hoy
              </Typography>
            ) : (
            <List sx={{ py: 0 }}>
              {dayItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem sx={{ py: 1.5, px: 0, "&:hover": { backgroundColor: isDark ? "rgba(37, 99, 235, 0.04)" : "rgba(37, 99, 235, 0.03)", borderRadius: 2 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: "10px",
                        background: item.iconBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white" }}>
                        {item.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          <AccessTime fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                          {new Date(item.time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })} — {item.desc}
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem",
                        color: item.type === "sale" ? theme.palette.success.main : "error.main" }}>
                        {item.type === "sale" ? "+" : "-"}${Math.abs(item.amount).toFixed(2)}
                      </Typography>
                    </Box>
                  </ListItem>
                  {index < dayItems.length - 1 && <Divider sx={{ opacity: 0.3 }} />}
                </React.Fragment>
              ))}
            </List>
            )}
          </CardContent>
        </Card>
      )}

      {!isOpen && !loading && closedRegisters.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5, fontSize: "1rem", display: "flex", alignItems: "center", gap: 1 }}>
              <History /> Cierres Anteriores
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Abrió</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Cerró</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Ventas</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Transacciones</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {closedRegisters.map((cr) => (
                    <TableRow key={cr.id} hover sx={{ "&:hover": { backgroundColor: isDark ? "rgba(37, 99, 235, 0.06)" : "rgba(37, 99, 235, 0.04)" } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{cr.name || `Cierre #${cr.id}`}</TableCell>
                      <TableCell>{cr.opener_name || "—"}</TableCell>
                      <TableCell>{cr.closer_name || "—"}</TableCell>
                      <TableCell>{new Date(cr.closed_at).toLocaleDateString("es-MX")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.success.main }}>${(cr.total_sales || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">{cr.sale_count || 0}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" color="primary" onClick={() => handleViewRegisterDetail(cr.id)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {!register && salesCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Hay {salesCount} venta(s) registrada(s) hoy fuera de caja. Abre la caja para visualizar el detalle.
        </Alert>
      )}

      <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detalle del Día</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Monto</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dayItems.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center"><Typography variant="body2" color="textSecondary">No hay movimientos hoy</Typography></TableCell></TableRow>
                ) : dayItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Chip label={item.type === "sale" ? "Venta" : "Gasto"} size="small"
                        color={item.type === "sale" ? "success" : "error"} variant="outlined" />
                    </TableCell>
                    <TableCell>{new Date(item.time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</TableCell>
                    <TableCell>{item.desc}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: item.type === "sale" ? theme.palette.success.main : "error.main" }}>
                      {item.type === "sale" ? "+" : "-"}${Math.abs(item.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions><CancelButton onClick={() => setDetailsModalOpen(false)}>Cerrar</CancelButton></DialogActions>
      </Dialog>

      <Dialog open={openRegisterModal} onClose={() => setOpenRegisterModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Store color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Abrir Caja</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="textSecondary">Ingresa el monto inicial en efectivo para abrir la caja del día.</Typography>
            <TextField label="Monto de apertura" type="number" value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)} autoFocus
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setOpenRegisterModal(false)}>Cancelar</CancelButton>
          <Button onClick={handleOpenRegister} variant="outlined" startIcon={<CheckCircle />}
            sx={{ borderColor: "success.main", color: "success.main", backgroundColor: "rgba(16,185,129,0.06)", "&:hover": { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "success.main" } }}>
            Abrir Caja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeRegisterModal} onClose={() => setCloseRegisterModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <MoneyOff color="warning" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Cerrar Caja</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Ingresa el monto final en efectivo y los gastos del día para cerrar la caja.
            </Typography>
            <TextField label="Nombre de la caja" value={registerName}
              onChange={(e) => setRegisterName(e.target.value)} autoFocus
              placeholder="Ej: Caja mañana, Caja tarde..." />
            <TextField label="Efectivo declarado" type="number" value={declaredClose}
              onChange={(e) => setDeclaredClose(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }} />
            <TextField label="Gastos / Egresos" type="number" value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setCloseRegisterModal(false)}>Cancelar</CancelButton>
          <Button onClick={handleCloseRegister} variant="contained" color="warning" startIcon={<CheckCircle />}>
            Cerrar Caja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={withdrawDialogOpen} onClose={() => !withdrawLoading && setWithdrawDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <RemoveShoppingCart color="error" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Retirar Dinero de Caja</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Registra una salida de efectivo de la caja. Se agregará automáticamente a los gastos del día.
            </Typography>
            <TextField label="Motivo del retiro" value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)} autoFocus
              placeholder="Ej: Pago a proveedor, gasto menor..."
              disabled={withdrawLoading} />
            <TextField label="Monto a retirar" type="number" value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }}
              disabled={withdrawLoading} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setWithdrawDialogOpen(false)} disabled={withdrawLoading}>Cancelar</CancelButton>
          <Button onClick={handleRegisterExpense} variant="contained" color="error"
            disabled={withdrawLoading} startIcon={withdrawLoading ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}>
            {withdrawLoading ? "Registrando..." : "Confirmar Retiro"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={registerDetailModal} onClose={() => setRegisterDetailModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <History color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {registerDetailData?.register?.name || "Detalle de Caja"}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {registerDetailData && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                  Abrió: {registerDetailData.register.opener_name || "—"}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                  Cerró: {registerDetailData.register.closer_name || "—"}
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">Total Ventas</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.success.main }}>
                    ${registerDetailData.totalSales.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">Artículos Vendidos</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                    {registerDetailData.totalItems}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">Transacciones</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {registerDetailData.saleCount}
                  </Typography>
                </Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <AccountBalance fontSize="small" /> Montos de Caja
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: "Apertura", value: registerDetailData.register.opening_balance },
                  { label: "Efectivo", value: registerDetailData.register.cash_sales || 0 },
                  { label: "Tarjeta", value: registerDetailData.register.card_sales || 0 },
                  { label: "Transferencia", value: registerDetailData.register.transfer_sales || 0 },
                  { label: "Gastos", value: registerDetailData.register.expenses || 0 },
                  { label: "Cierre Esperado", value: registerDetailData.register.expected_close || 0 },
                  { label: "Declarado", value: registerDetailData.register.declared_close || 0 },
                  { label: "Diferencia", value: registerDetailData.register.difference || 0 },
                ].map((item, idx) => (
                  <Grid item xs={6} md={3} key={idx}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: "center", width: "100%", bgcolor: isDark ? "rgba(255,255,255,0.03)" : "grey.50" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", display: "block", mb: 0.3, fontWeight: 500 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                        ${item.value.toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <Assessment fontSize="small" /> Ingresos / Egresos
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Hora</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Monto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      ...registerDetailData.sales.map(s => ({
                        type: 'sale', id: `sale-${s.id}`,
                        time: s.created_at, desc: s.payment_method === "cash" ? "Efectivo" : s.payment_method === "card" ? "Tarjeta" : "Transferencia",
                        amount: s.total,
                      })),
                      ...registerDetailData.expenses.map(e => ({
                        type: 'expense', id: `exp-${e.id}`,
                        time: e.created_at, desc: e.reason,
                        amount: -e.amount,
                      })),
                    ].sort((a, b) => new Date(a.time) - new Date(b.time)).map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Chip label={item.type === "sale" ? "Venta" : "Gasto"} size="small"
                            color={item.type === "sale" ? "success" : "error"} variant="outlined" />
                        </TableCell>
                        <TableCell>{new Date(item.time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</TableCell>
                        <TableCell>{item.desc}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: item.type === "sale" ? theme.palette.success.main : "error.main" }}>
                          {item.type === "sale" ? "+" : "-"}${Math.abs(item.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {registerDetailData.sales.length === 0 && registerDetailData.expenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="textSecondary">Sin movimientos registrados</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <ShoppingCart fontSize="small" /> Productos Vendidos
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Precio</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {registerDetailData.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.product_name || "Producto"}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">${item.price_at_sale.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ${(item.quantity * item.price_at_sale).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {registerDetailData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="textSecondary">No hay productos registrados</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setRegisterDetailModal(false)}>Cerrar</CancelButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EndOfDay;
