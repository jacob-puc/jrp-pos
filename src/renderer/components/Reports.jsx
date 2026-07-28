import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Card, CardContent, TextField,
  InputAdornment, Stack, useTheme, TablePagination, Chip, Alert, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, Fade, IconButton,
  Drawer, Tooltip, Divider,
} from "@mui/material";
import {
  AssessmentOutlined, AttachMoney, ShoppingCart, TrendingUp, CalendarToday,
  Print, FileDownload, CreditCard, AccountBalance, ChevronLeft, ChevronRight,
  Close, Receipt, MoneyOff, RemoveShoppingCart,
} from "@mui/icons-material";
import { CardSkeleton, TableSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import { mxToday, formatMXDate, formatMXTime, formatMXDateTime } from "../utils/dateUtils";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

const Reports = () => {
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [avg, setAvg] = useState(0);
  const [byMethod, setByMethod] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [saleDetail, setSaleDetail] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySales, setDaySales] = useState(null);
  const [dayExpenses, setDayExpenses] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    const today = mxToday();
    const firstDay = new Date();
    firstDay.setDate(1);
    const firstStr = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
    setStartDate(firstStr.toISOString().slice(0, 10));
    setEndDate(today);
  }, []);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    const [salesResult, expResult] = await Promise.all([
      window.api.invoke("get-sales-by-range", { startDate, endDate }),
      window.api.invoke("get-expenses-by-range", { startDate, endDate }),
    ]);
    if (salesResult.success) {
      setSales(salesResult.sales);
      setTotal(salesResult.total);
      setCount(salesResult.count);
      setAvg(salesResult.count > 0 ? salesResult.total / salesResult.count : 0);
      setByMethod(salesResult.byMethod || []);
      setPage(0);
    }
    if (expResult.success) {
      setExpenses(expResult.expenses);
      setTotalExpenses(expResult.totalExpenses);
      setExpensesCount(expResult.count);
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDayClick = async (day) => {
    const year = calendarDate.getFullYear();
    const month = String(calendarDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    setSelectedDay(dateStr);
    setDaySales(null);
    setDayExpenses(null);
    setDayLoading(true);
    const [salesResult, expResult] = await Promise.all([
      window.api.invoke("get-sales-by-date", { date: dateStr }),
      window.api.invoke("get-expenses-by-date", { date: dateStr }),
    ]);
    if (salesResult.success) setDaySales(salesResult);
    if (expResult.success) setDayExpenses(expResult);
    setDayLoading(false);
  };

  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = mxToday();
    const todayDateNum = parseInt(today.split("-")[2]);

    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<Box key={`empty-${i}`} sx={{ width: "calc(100% / 7)", height: 46 }} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDay;
      cells.push(
        <Box
          key={d}
          onClick={() => handleDayClick(d)}
          sx={{
            width: "calc(100% / 7)", height: 46,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 2, cursor: "pointer", fontSize: "0.95rem", fontWeight: isToday ? 800 : 500,
            color: isSelected ? "white" : isToday ? theme.palette.primary.main : "text.primary",
            bgcolor: isSelected ? theme.palette.primary.main : isToday ? "transparent" : "transparent",
            border: isToday && !isSelected ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
            transition: "all 0.15s",
            "&:hover": { bgcolor: isSelected ? theme.palette.primary.dark : isDark ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.08)" },
          }}
        >
          {d}
        </Box>
      );
    }
    return cells;
  };

  const viewDetails = async (saleId) => {
    const result = await window.api.invoke("get-sale-details", saleId);
    if (result.success) setSaleDetail(result);
  };

  const exportCSV = () => {
    if (sales.length === 0) return;
    const header = "ID Venta,Fecha,Total,Método de Pago\n";
    const rows = sales.map(s =>
      `${s.id},"${new Date(s.created_at).toLocaleString()}",${s.total.toFixed(2)},${s.payment_method}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-ventas-${startDate}-a-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const now = new Date();
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte de Ventas</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#333}
      h1{color:#2563eb;text-align:center}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th{background:#2563eb;color:white;padding:10px;text-align:left}
      td{padding:8px;border-bottom:1px solid #ddd}
      .summary{display:flex;gap:20px;margin:20px 0;justify-content:center}
      .card{border:2px solid #e2e8f0;border-radius:8px;padding:20px;text-align:center;min-width:150px}
      .num{font-size:24px;font-weight:bold;color:#2563eb}
      .footer{text-align:center;margin-top:40px;color:#666;font-size:12px}
    </style></head><body>
      <h1>Reporte de Ventas</h1>
      <p style="text-align:center">${startDate} — ${endDate}</p>
      <div class="summary">
        <div class="card"><div>Total Ventas</div><div class="num">$${total.toFixed(2)}</div></div>
        <div class="card"><div>Transacciones</div><div class="num">${count}</div></div>
        <div class="card"><div>Promedio</div><div class="num">$${avg.toFixed(2)}</div></div>
      </div>
      <table><tr><th>ID</th><th>Fecha</th><th>Método</th><th>Total</th></tr>
      ${sales.map(s => `<tr><td>#${s.id}</td><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.payment_method}</td><td>$${s.total.toFixed(2)}</td></tr>`).join("")}
      </table>
      <div class="footer">Generado el ${now.toLocaleString()}</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const methodIcons = { cash: <AttachMoney />, card: <CreditCard />, transfer: <AccountBalance /> };
  const methodLabels = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 3, textAlign: "center", fontSize: "1.8rem" }}>
        Reportes de Ventas
      </Typography>

      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField label="Desde" type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Hasta" type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Button variant="contained" onClick={fetchData} startIcon={<CalendarToday />} sx={{ width: "100%" }}>Consultar</Button>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Button
              variant={calendarOpen ? "contained" : "outlined"}
              color={calendarOpen ? "primary" : "inherit"}
              onClick={() => { setCalendarOpen(!calendarOpen); if (calendarOpen) setSelectedDay(null); }}
              startIcon={calendarOpen ? <Close /> : <CalendarToday />}
              sx={{ width: "100%" }}
            >
              Calendario
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* ── Calendar open: stats left, calendar center, day sales right ── */}
      {calendarOpen ? (
        <Box sx={{ display: "flex", gap: 3, alignItems: "stretch", justifyContent: "center" }}>
          {/* Left: stacked stats */}
          <Box sx={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            {selectedDay && dayLoading ? (
              <CardSkeleton count={3} />
            ) : (
              <Card sx={{ flex: 1, display: "flex", flexDirection: "column", p: 2 }}>
                <Stack spacing={1.5} sx={{ flex: 1, justifyContent: "center" }}>
                  <Card sx={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)", border: "2px solid rgba(16, 185, 129, 0.2)" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.15)" }}>
                        <AttachMoney sx={{ fontSize: 20, color: theme.palette.success.main }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>{selectedDay ? "Total del día" : "Ventas Totales"}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: "1rem", lineHeight: 1.1 }}>${(selectedDay && daySales ? daySales.total : total).toFixed(2)}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                  <Card sx={{ background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%)", border: "2px solid rgba(59, 130, 246, 0.2)" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
                        <ShoppingCart sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>{selectedDay ? "Transacciones del día" : "Transacciones"}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: "1rem", lineHeight: 1.1 }}>{selectedDay && daySales ? daySales.count : count}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                  <Card sx={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.15) 100%)", border: "2px solid rgba(245, 158, 11, 0.2)" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.15)" }}>
                        <TrendingUp sx={{ fontSize: 20, color: theme.palette.warning.main }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>{selectedDay ? "Promedio del día" : "Ticket Promedio"}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.warning.main, fontSize: "1rem", lineHeight: 1.1 }}>${selectedDay && daySales ? (daySales.count > 0 ? daySales.total / daySales.count : 0).toFixed(2) : avg.toFixed(2)}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                  {selectedDay && (
                    <Card sx={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.15) 100%)", border: "2px solid rgba(239, 68, 68, 0.2)" }}>
                      <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239, 68, 68, 0.15)" }}>
                          <MoneyOff sx={{ fontSize: 20, color: theme.palette.error.main }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem", lineHeight: 1.2 }}>Gastos del día</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.error.main, fontSize: "1rem", lineHeight: 1.1 }}>${(dayExpenses?.totalExpenses || 0).toFixed(2)}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                  {(() => {
                    const methods = selectedDay && daySales ? (daySales.byMethod || []) : byMethod;
                    return methods.length > 0 && (
                      <Stack spacing={1}>
                        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textAlign: "center" }}>Por método de pago:</Typography>
                        {methods.map((m) => (
                          <Chip key={m.payment_method}
                            icon={methodIcons[m.payment_method] || <AttachMoney />}
                            label={`${methodLabels[m.payment_method] || m.payment_method}: $${Number(m.total).toFixed(2)}`}
                            variant="outlined" color="primary" size="small"
                          />
                        ))}
                      </Stack>
                    );
                  })()}
                </Stack>
              </Card>
            )}
          </Box>

          {/* Center: Calendar */}
          <Card sx={{ flex: "0 1 480px", p: 2.5, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <IconButton onClick={prevMonth} size="small"><ChevronLeft /></IconButton>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: "1.2rem" }}>
                {MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </Typography>
              <IconButton onClick={nextMonth} size="small"><ChevronRight /></IconButton>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", flex: 1, alignContent: "flex-start" }}>
              {DAYS.map((d) => (
                <Box key={d} sx={{ width: "calc(100% / 7)", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "text.secondary", mb: 0.5, py: 0.5 }}>
                  {d}
                </Box>
              ))}
              {renderCalendar()}
            </Box>
          </Card>

          {/* Right: day sales list */}
          <Box sx={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            {selectedDay && !dayLoading && daySales ? (
              <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, pb: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    <Receipt sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                    Detalle del {selectedDay.split('-').reverse().join('/')}
                  </Typography>
                  <IconButton size="small" onClick={() => setSelectedDay(null)}>
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
                <Divider sx={{ mb: 1, mt: 1 }} />
                <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
                  {(() => {
                    const items = [
                      ...(daySales?.sales || []).map(s => ({
                        id: `sale-${s.id}`, type: "sale",
                        title: `Venta #${s.id}`,
                        desc: methodLabels[s.payment_method] || s.payment_method,
                        time: s.created_at, amount: s.total,
                      })),
                      ...(dayExpenses?.expenses || []).map(e => ({
                        id: `exp-${e.id}`, type: "expense",
                        title: e.reason.startsWith("Compra") ? "Compra de inventario" : "Retiro de efectivo",
                        desc: e.reason,
                        time: e.created_at, amount: -e.amount,
                      })),
                    ].sort((a, b) => new Date(a.time) - new Date(b.time));

                    if (items.length === 0) {
                      return (
                        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: 0.5, py: 4 }}>
                          <Receipt sx={{ fontSize: 36, color: "text.secondary", mb: 1 }} />
                          <Typography color="textSecondary" variant="body2">Sin movimientos en este día</Typography>
                        </Box>
                      );
                    }
                    return items.map((item) => (
                      <Card key={item.id} sx={{ mb: 1, p: 1.5, borderLeft: `4px solid ${item.type === "sale" ? theme.palette.success.main : theme.palette.error.main}` }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                            <Typography variant="caption" color="textSecondary">{formatMXTime(item.time)} — {item.desc}</Typography>
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: item.type === "sale" ? theme.palette.success.main : "error.main" }}>
                              {item.type === "sale" ? "+" : "-"}${Math.abs(item.amount).toFixed(2)}
                            </Typography>
                          </Box>
                        </Box>
                      </Card>
                    ));
                  })()}
                </Box>
              </Card>
            ) : selectedDay && dayLoading ? (
              <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography color="textSecondary">Cargando...</Typography>
              </Box>
            ) : (
              <Box />
            )}
          </Box>
        </Box>
      ) : (
        /* ── Calendar closed: normal horizontal layout ── */
        <Box sx={{ display: "flex", gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Fade in timeout={500}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)", border: "2px solid rgba(16, 185, 129, 0.2)" }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.15)" }}>
                      <AttachMoney sx={{ fontSize: 22, color: theme.palette.success.main }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Ventas Totales</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: "1.25rem", lineHeight: 1.1 }}>${total.toFixed(2)}</Typography>
                    </Box>
                  </CardContent>
                </Card>
                <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%)", border: "2px solid rgba(59, 130, 246, 0.2)" }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
                      <ShoppingCart sx={{ fontSize: 22, color: theme.palette.primary.main }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Transacciones</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: "1.25rem", lineHeight: 1.1 }}>{count}</Typography>
                    </Box>
                  </CardContent>
                </Card>
                <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.15) 100%)", border: "2px solid rgba(245, 158, 11, 0.2)" }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.15)" }}>
                      <TrendingUp sx={{ fontSize: 22, color: theme.palette.warning.main }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Ticket Promedio</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.warning.main, fontSize: "1.25rem", lineHeight: 1.1 }}>${avg.toFixed(2)}</Typography>
                    </Box>
                  </CardContent>
                </Card>
                <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.15) 100%)", border: "2px solid rgba(239, 68, 68, 0.2)" }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239, 68, 68, 0.15)" }}>
                      <MoneyOff sx={{ fontSize: 22, color: theme.palette.error.main }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Gastos / Egresos</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.error.main, fontSize: "1.25rem", lineHeight: 1.1 }}>${totalExpenses.toFixed(2)}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            </Fade>

            {!loading && byMethod.length > 0 && (
              <Stack direction="row" spacing={2} sx={{ mb: 3 }} justifyContent="center">
                {byMethod.map((m) => (
                  <Chip key={m.payment_method}
                    icon={methodIcons[m.payment_method] || <AttachMoney />}
                    label={`${methodLabels[m.payment_method] || m.payment_method}: $${Number(m.total).toFixed(2)} (${m.count} ventas)`}
                    variant="outlined" color="primary" sx={{ fontSize: "0.85rem", py: 2 }}
                  />
                ))}
              </Stack>
            )}

            {loading ? (
              <TableSkeleton rows={4} columns={5} />
            ) : (
              <Fade in timeout={500}>
                <Box>
                <Card>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, pb: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>Ventas del Período</Typography>
                    <Button variant="outlined" startIcon={<Print />} onClick={printReport}>Imprimir</Button>
                  </Box>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Método</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sales.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s) => (
                          <TableRow key={s.id} sx={{ "&:hover": { backgroundColor: isDark ? "rgba(59, 130, 246, 0.06)" : "rgba(37, 99, 235, 0.04)" } }}>
                            <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>#{s.id}</Typography></TableCell>
                            <TableCell>
                              <Typography variant="body2">{formatMXDate(s.created_at)}</Typography>
                              <Typography variant="caption" color="textSecondary">{formatMXTime(s.created_at)}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip icon={methodIcons[s.payment_method] || <AttachMoney />}
                                label={methodLabels[s.payment_method] || s.payment_method}
                                size="small" variant="outlined" color="primary" />
                            </TableCell>
                            <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>${s.total.toFixed(2)}</Typography></TableCell>
                            <TableCell align="center">
                              <Button size="small" variant="text" onClick={() => viewDetails(s.id)}>Detalle</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {sales.length === 0 && (
                          <TableRow><TableCell colSpan={5} align="center"><Typography color="textSecondary" sx={{ py: 4 }}>No hay ventas en este período</Typography></TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    rowsPerPageOptions={[10, 15, 30]} component="div" count={sales.length}
                    rowsPerPage={rowsPerPage} page={page}
                    onPageChange={(e, p) => setPage(p)}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                  />
                </Card>
                {expenses.length > 0 && (
                  <Card sx={{ mt: 2 }}>
                    <Box sx={{ p: 2, pb: 0 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                        <MoneyOff color="error" /> Gastos del Período
                      </Typography>
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Caja</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Monto</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {expenses.map((e) => (
                            <TableRow key={e.id} sx={{ "&:hover": { backgroundColor: isDark ? "rgba(239, 68, 68, 0.06)" : "rgba(239, 68, 68, 0.04)" } }}>
                              <TableCell>
                                <Chip label={e.reason.startsWith("Compra") ? "Compra" : "Retiro"} size="small"
                                  color="error" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{formatMXDate(e.created_at)}</Typography>
                                <Typography variant="caption" color="textSecondary">{formatMXTime(e.created_at)}</Typography>
                              </TableCell>
                              <TableCell>{e.reason}</TableCell>
                              <TableCell>{e.register_name || `#${e.register_id}`}</TableCell>
                              <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700, color: "error.main" }}>-${Number(e.amount).toFixed(2)}</Typography></TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={4} align="right" sx={{ fontWeight: 700, fontSize: "1rem" }}>Total Gastos:</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "1rem", color: "error.main" }}>-${totalExpenses.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                )}
                </Box>
              </Fade>
            )}
          </Box>
        </Box>
      )}

      <Dialog open={!!saleDetail} onClose={() => setSaleDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle de Venta #{saleDetail?.sale?.id ?? ""}</DialogTitle>
        <DialogContent>
          {saleDetail?.sale ? (
            <Box>
              <Typography variant="body2" color="textSecondary">
                {formatMXDateTime(saleDetail.sale.created_at)} — {methodLabels[saleDetail.sale.payment_method] || saleDetail.sale.payment_method}
              </Typography>
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Cant</TableCell>
                      <TableCell align="right">Precio</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saleDetail.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">${item.price_at_sale.toFixed(2)}</TableCell>
                        <TableCell align="right">${(item.price_at_sale * item.quantity).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="h5" sx={{ textAlign: "right", mt: 2, fontWeight: 700, color: theme.palette.success.main }}>
                Total: ${saleDetail.sale.total.toFixed(2)}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="textSecondary">No se encontraron detalles de esta venta</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setSaleDetail(null)}>Cerrar</CancelButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;
