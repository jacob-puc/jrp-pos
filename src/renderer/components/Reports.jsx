import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Card, CardContent, TextField,
  InputAdornment, Stack, useTheme, TablePagination, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, Fade, IconButton,
  Tooltip, Divider, Tab, Tabs,
} from "@mui/material";
import {
  Banknote, ShoppingCart, TrendingUp, Printer, Download, CreditCard,
  Landmark, ChevronLeft, ChevronRight, X, Receipt, Ban, CalendarDays,
} from "lucide-react";
import { CardSkeleton, TableSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import { mxToday, formatMXDate, formatMXTime, formatMXDateTime, getMXDateString } from "../utils/dateUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);

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
  const [calendarData, setCalendarData] = useState({
    dailySales: {}, dailyExpenses: {}, salesTotal: 0, salesCount: 0,
    expensesTotal: 0, expensesCount: 0, profit: 0, prevSales: 0, prevExpenses: 0,
  });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");
  const [expensesPage, setExpensesPage] = useState(0);
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    const today = mxToday();
    const [y, m] = today.split("-");
    const firstStr = `${y}-${m}-01`;
    setStartDate(firstStr);
    setEndDate(today);
    setExpenseStartDate(firstStr);
    setExpenseEndDate(today);
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

  const fetchExpenses = useCallback(async (sDate, eDate, pg) => {
    const result = await window.api.invoke("get-expenses-by-range", { startDate: sDate, endDate: eDate });
    if (result.success) {
      setExpenses(result.expenses);
      setTotalExpenses(result.totalExpenses);
      setExpensesCount(result.count);
      setExpensesPage(pg);
    }
  }, []);

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
  const goToday = () => {
    const now = new Date();
    setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const fmtMoney = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pctOf = (cur, prev) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);
  const registerLabel = (e) => {
    const n = e.register_name;
    if (n && n !== "Cierre por cambio de turno" && !/^Cierre \d/.test(n)) return n;
    return e.register_opener_name || (e.register_id ? `#${e.register_id}` : "Sin caja");
  };

  const Delta = ({ value, invert }) => {
    const up = value >= 0;
    const good = invert ? !up : up;
    const color = good ? theme.palette.success.main : theme.palette.error.main;
    return (
      <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color, display: "inline-flex", alignItems: "center", gap: 0.25 }}>
        {up ? "▲" : "▼"} {Math.abs(Math.round(value))}% vs mes anterior
      </Typography>
    );
  };

  const fetchCalendarMonth = useCallback(async (refDate) => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const mm = String(month + 1).padStart(2, "0");
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMm = String(prevMonth + 1).padStart(2, "0");
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    const monthStart = `${year}-${mm}-01`;
    const monthEnd = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMm = String(nextMonth + 1).padStart(2, "0");
    const monthEndPlus = `${nextYear}-${nextMm}-01`;
    const prevStart = `${prevYear}-${prevMm}-01`;
    const prevEnd = `${prevYear}-${prevMm}-${String(daysInPrevMonth).padStart(2, "0")}`;

    setCalendarLoading(true);
    const [salesRes, expRes, prevSalesRes, prevExpRes] = await Promise.all([
      window.api.invoke("get-daily-sales-week", { startDate: monthStart, endDate: monthEndPlus }),
      window.api.invoke("get-expenses-by-range", { startDate: monthStart, endDate: monthEnd }),
      window.api.invoke("get-sales-by-range", { startDate: prevStart, endDate: prevEnd }),
      window.api.invoke("get-expenses-by-range", { startDate: prevStart, endDate: prevEnd }),
    ]);

    const dailySales = {};
    let salesTotal = 0;
    let salesCount = 0;
    if (salesRes.success) {
      (salesRes.rows || []).forEach((r) => {
        const t = Number(r.total) || 0;
        dailySales[r.date] = { total: t, count: Number(r.count) || 0 };
        salesTotal += t;
        salesCount += Number(r.count) || 0;
      });
    }
    const dailyExpenses = {};
    let expensesTotal = 0;
    let expensesCount = 0;
    if (expRes.success) {
      (expRes.expenses || []).forEach((e) => {
        if (e.status === "cancelado") return;
        const dk = getMXDateString(e.created_at);
        dailyExpenses[dk] = (dailyExpenses[dk] || 0) + (Number(e.amount) || 0);
        expensesTotal += Number(e.amount) || 0;
        expensesCount += 1;
      });
    }
    setCalendarData({
      dailySales,
      dailyExpenses,
      salesTotal,
      salesCount,
      expensesTotal,
      expensesCount,
      profit: salesTotal - expensesTotal,
      prevSales: prevSalesRes.success ? prevSalesRes.total || 0 : 0,
      prevExpenses: prevExpRes.success ? prevExpRes.totalExpenses || 0 : 0,
    });
    setCalendarLoading(false);
  }, []);

  useEffect(() => {
    if (calendarOpen) fetchCalendarMonth(calendarDate);
  }, [calendarOpen, calendarDate, fetchCalendarMonth]);

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = mxToday();

    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<Box key={`empty-${i}`} sx={{ minHeight: 84 }} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDay;
      const sTotal = calendarData.dailySales[dateStr]?.total || 0;
      const eTotal = calendarData.dailyExpenses[dateStr] || 0;
      const fmtCell = (n) => `$${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
      cells.push(
        <Box
          key={d}
          onClick={() => handleDayClick(d)}
          sx={{
            minHeight: 84, borderRadius: "12px", p: 0.75, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "stretch",
            border: "1px solid",
            borderColor: isSelected || isToday ? theme.palette.primary.main : "divider",
            borderWidth: isSelected || isToday ? 2 : 1,
            bgcolor: isSelected ? "rgba(59,130,246,0.16)" : isToday ? "rgba(59,130,246,0.08)" : "background.paper",
            transition: "all 0.15s",
            "&:hover": { bgcolor: "rgba(59,130,246,0.16)", borderColor: theme.palette.primary.main },
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", mb: 0.25 }}>
            <Box sx={{
              width: 24, height: 24, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: isToday ? theme.palette.primary.main : "transparent",
              border: isSelected && !isToday ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
            }}>
              <Typography sx={{ fontSize: "0.8rem", lineHeight: 1, fontWeight: 800, color: isToday ? "#fff" : isSelected ? theme.palette.primary.main : "text.primary" }}>
                {d}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 0.35 }}>
            {sTotal > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Box sx={{ width: 13, height: 13, borderRadius: "2px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.success.main }}>
                  <Typography sx={{ fontSize: "0.55rem", color: "#fff", fontWeight: 800, lineHeight: 1 }}>S</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.62rem", lineHeight: 1.2, fontWeight: 700, color: theme.palette.success.main, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fmtCell(sTotal)}
                </Typography>
              </Box>
            )}
            {eTotal > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Box sx={{ width: 13, height: 13, borderRadius: "2px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.error.main }}>
                  <Typography sx={{ fontSize: "0.55rem", color: "#fff", fontWeight: 800, lineHeight: 1 }}>E</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.62rem", lineHeight: 1.2, fontWeight: 700, color: theme.palette.error.main, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fmtCell(eTotal)}
                </Typography>
              </Box>
            )}
            {sTotal === 0 && eTotal === 0 && (
              <Typography sx={{ fontSize: "0.62rem", lineHeight: 1.2, color: "text.disabled", textAlign: "center" }}>—</Typography>
            )}
          </Box>
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
    const rows = sales.filter((s) => s.status !== "cancelado").map(s =>
      `${s.id},"${formatMXDateTime(s.created_at)}",${s.total.toFixed(2)},${s.payment_method}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-ventas-${startDate}-a-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = async () => {
    const store = await window.api.invoke("get-setting", "store_name");
    const storeName = store || "MI TIENDA POS";
    const now = new Date();
    const win = window.open("", "_blank");
    const methodNames = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
    const byMethodHtml = byMethod.map(m =>
      `<tr><td>${methodNames[m.payment_method] || m.payment_method}</td><td>${m.count}</td><td align="right">$${Number(m.total).toFixed(2)}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte de Ventas</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;margin:30px 40px;color:#1e293b;font-size:13px}
        h1{font-size:22px;color:#1e3a5f;margin-bottom:2px;letter-spacing:0.5px}
        .subtitle{font-size:13px;color:#64748b;margin-top:0;margin-bottom:20px}
        hr{border:none;border-top:2px solid #2563eb;margin:15px 0}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
        th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;font-weight:600}
        td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
        tr:nth-child(even){background:#f8fafc}
        .total-row td{background:#1e3a5f;color:#fff;font-weight:700;padding:8px 10px}
        .resumen-table td{padding:6px 10px;border:none;font-size:12px}
        .resumen-table tr:last-child td{border-top:2px solid #1e3a5f;font-weight:700;font-size:14px}
        .section-title{font-size:14px;font-weight:700;color:#1e3a5f;margin:18px 0 6px 0}
        .footer{text-align:center;margin-top:35px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:12px}
        @media print{body{margin:0.5in} .no-print{display:none}}
      </style></head><body>
      <h1>${storeName.toUpperCase()}</h1>
      <p class="subtitle">Reporte de Ventas — ${startDate} al ${endDate}</p>
      <hr>
      <div class="section-title">Resumen</div>
      <table class="resumen-table">
        <tr><td>Total Ventas</td><td align="right"><b>$${total.toFixed(2)}</b></td></tr>
        <tr><td>Transacciones</td><td align="right"><b>${count}</b></td></tr>
        <tr><td>Ticket Promedio</td><td align="right"><b>$${avg.toFixed(2)}</b></td></tr>
      </table>
      ${byMethodHtml ? `<div class="section-title">Desglose por método de pago</div>
      <table><tr><th>Método</th><th>Ventas</th><th>Total</th></tr>${byMethodHtml}</table>` : ""}
      <div class="section-title">Ventas del Período</div>
      <table><tr><th>#</th><th>Fecha</th><th>Método</th><th>Total</th></tr>
      ${sales.filter((s) => s.status !== "cancelado").map(s => `<tr><td>#${s.id}</td><td>${formatMXDateTime(s.created_at)}</td><td>${methodNames[s.payment_method] || s.payment_method}</td><td align="right">$${s.total.toFixed(2)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="3">TOTAL</td><td align="right">$${total.toFixed(2)}</td></tr>
      </table>
      <div class="footer">Generado el ${now.toLocaleString("es-MX")} — JRP POS</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // ─── EXPORTAR PDF ─────────────────────────────────────
  const exportPDF = async () => {
    const store = await window.api.invoke("get-setting", "store_name");
    const storeName = store || "MI TIENDA POS";
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;

    // Logo / header
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(storeName.toUpperCase(), margin, 22);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(`Reporte de Ventas — ${startDate} al ${endDate}`, margin, 29);

    // Separador
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(margin, 33, pageW - margin, 33);

    // Resumen
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30);
    doc.text("RESUMEN", margin, 44);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    let yy = 52;
    const colR = pageW / 3;
    const leftX = margin;
    const centerX = pageW / 2 - colR / 2;
    const rightX = pageW - margin - colR;

    doc.setFont(undefined, "bold");
    doc.text("Total Ventas", leftX + colR / 2 - 10, yy, { align: "center" });
    doc.text("Transacciones", centerX + colR / 2 - 12, yy, { align: "center" });
    doc.text("Ticket Prom.", rightX + colR / 2 - 10, yy, { align: "center" });
    yy += 6;
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(`$${total.toFixed(2)}`, leftX + colR / 2 - 10, yy, { align: "center" });
    doc.text(`${count}`, centerX + colR / 2 - 6, yy, { align: "center" });
    doc.text(`$${avg.toFixed(2)}`, rightX + colR / 2 - 10, yy, { align: "center" });

    // Línea separadora
    yy += 10;
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, yy, pageW - margin, yy);
    yy += 6;

    // Desglose por método
    if (byMethod.length > 0) {
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.setTextColor(30);
      doc.text("Desglose por método de pago", margin, yy);
      yy += 7;
      const methodNames = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
      byMethod.forEach((m, i) => {
        const label = methodNames[m.payment_method] || m.payment_method;
        const amt = Number(m.total).toFixed(2);
        doc.setFontSize(9);
        doc.setFont(undefined, "normal");
        doc.setTextColor(60);
        doc.text(`${label}`, margin + 10, yy);
        doc.setFont(undefined, "bold");
        doc.text(`$${amt}`, pageW - margin - 20, yy, { align: "right" });
        doc.setFont(undefined, "normal");
        yy += 5;
      });
      yy += 4;
    }

    // Tabla de ventas
    doc.line(margin, yy, pageW - margin, yy);
    yy += 4;
    const tableHeaders = [["#", "Fecha", "Método", "Total"]];
    const tableData = sales.filter((s) => s.status !== "cancelado").map((s) => [
      `#${s.id}`,
      formatMXDate(s.created_at),
      s.payment_method === "cash" ? "Efectivo" : s.payment_method === "card" ? "Tarjeta" : "Transferencia",
      `$${s.total.toFixed(2)}`,
    ]);

    doc.autoTable({
      head: tableHeaders,
      body: tableData,
      startY: yy,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      footStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      showFoot: "everyPage",
      footer: [[{ content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } }, `$${total.toFixed(2)}`]],
    });

    yy = doc.lastAutoTable.finalY + 10;

    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.setTextColor(150);
    doc.text(`Generado el ${new Date().toLocaleString("es-MX")}`, margin, yy);
    doc.setFont(undefined, "bold");
    doc.text("JRP POS", pageW - margin, yy, { align: "right" });

    doc.save(`reporte-ventas-${startDate}-a-${endDate}.pdf`);
  };

  // ─── GRÁFICA SEMANAL/MENSUAL ─────────────────────────
  const [chartMode, setChartMode] = useState("semanal");
  const [chartRefDate, setChartRefDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [dailySales, setDailySales] = useState([]);
  const [monthlyWeeks, setMonthlyWeeks] = useState([]);
  const [chartBackMonth, setChartBackMonth] = useState(null);

  const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: toDateStr(monday), end: toDateStr(sunday) };
  };

  const fetchDailyWeek = useCallback(async (refDate) => {
    const { start, end } = getWeekRange(refDate);
    const [ey, em, ed] = end.split("-").map(Number);
    const endPlusDate = new Date(ey, em - 1, ed + 1);
    const endPlus = toDateStr(endPlusDate);
    const result = await window.api.invoke("get-daily-sales-week", { startDate: start, endDate: endPlus });
    if (result.success) {
      const dayMap = {};
      (result.rows || []).forEach((r) => { dayMap[r.date] = r; });
      const [sy, sm, sd] = start.split("-").map(Number);
      const monday = new Date(sy, sm - 1, sd);
      const formatted = DAY_LABELS.map((label, i) => {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const ds = toDateStr(d);
        const row = dayMap[ds] || { total: 0, count: 0 };
        const isToday = ds === mxToday();
        return { day: label, date: ds, total: Number(row.total), ventas: Number(row.count), isToday };
      });
      setDailySales(formatted);
    }
  }, []);

  const fetchMonthlyWeeks = useCallback(async (refDate) => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const mm = String(month + 1).padStart(2, "0");
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMm = String(nextMonth + 1).padStart(2, "0");
    const monthStart = `${year}-${mm}-01`;
    const monthEnd = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
    const monthEndPlus = `${nextYear}-${nextMm}-01`;
    const result = await window.api.invoke("get-weekly-sales-range", { startDate: monthStart, endDate: monthEndPlus });
    if (result.success) {
      const formatted = (result.rows || []).map((r) => ({
        weekStart: r.week_start,
        label: r.week_start ? `Sem ${r.week_start.slice(5)}` : r.week_key,
        total: Number(r.total),
        ventas: Number(r.count),
      }));
      setMonthlyWeeks(formatted);
    }
  }, []);

  useEffect(() => {
    if (chartMode === "semanal") fetchDailyWeek(chartRefDate);
    else fetchMonthlyWeeks(chartRefDate);
  }, [chartMode, chartRefDate, fetchDailyWeek, fetchMonthlyWeeks]);

  const navigateChart = (direction) => {
    const d = new Date(chartRefDate);
    if (chartMode === "semanal") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setChartRefDate(d);
  };

  const formatChartTitle = () => {
    if (chartMode === "semanal") {
      const { start, end } = getWeekRange(chartRefDate);
      return `${start} al ${end}`;
    }
    return `${MONTH_NAMES[chartRefDate.getMonth()]} ${chartRefDate.getFullYear()}`;
  };

  const handleWeekClick = (weekStart) => {
    setChartBackMonth({ year: chartRefDate.getFullYear(), month: chartRefDate.getMonth() });
    setChartMode("semanal");
    setChartRefDate(new Date(weekStart));
  };

  const methodIcons = { cash: <Banknote />, card: <CreditCard />, transfer: <Landmark /> };
  const methodLabels = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
  const methodColors = { cash: "#059669", card: "#4f46e5", transfer: "#d97706" };

  const filteredSales = paymentFilter === "all" ? sales : sales.filter(s => s.payment_method === paymentFilter);
  const filteredExpenses = expenseFilter === "all" ? expenses : expenses.filter(e => {
    const isCompra = e.reason.startsWith("Compra");
    return expenseFilter === "compra" ? isCompra : !isCompra;
  });
  const filteredExpTotal = filteredExpenses
    .filter((e) => e.status !== "cancelado")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Box sx={{ flex: 1 }} />
        <Typography variant="h2" sx={{ fontSize: "1.8rem", fontWeight: 700, textAlign: "center" }}>
          Reportes de Ventas
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* ── Calendar open: resumen mensual + calendario + detalle diario ── */}
      {calendarOpen ? (
        <Box>
          {/* Header: nav de mes + Hoy + cerrar */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton onClick={prevMonth} size="small"><ChevronLeft /></IconButton>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: "1.3rem", minWidth: 210, textAlign: "center" }}>
                {MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </Typography>
              <IconButton onClick={nextMonth} size="small"><ChevronRight /></IconButton>
              <Button size="small" variant="outlined" onClick={goToday} sx={{ ml: 1, borderRadius: "12px" }}>
                Hoy
              </Button>
            </Box>
            <IconButton size="small" onClick={() => { setCalendarOpen(false); setSelectedDay(null); }}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", color: "text.secondary", "&:hover": { bgcolor: "action.hover" } }}>
              <X size={18} />
            </IconButton>
          </Box>

          {calendarLoading ? (
            <CardSkeleton count={3} />
          ) : (
            <>
              {/* Resumen mensual */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px", height: "100%" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, "&:last-child": { pb: 2 } }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,185,129,0.12)", flexShrink: 0 }}>
                        <Banknote size={24} color={theme.palette.success.main} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.62rem" }}>Ventas del Mes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>{fmtMoney(calendarData.salesTotal)}</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="textSecondary">{calendarData.salesCount} ventas</Typography>
                          <Delta value={pctOf(calendarData.salesTotal, calendarData.prevSales)} invert={false} />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px", height: "100%" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, "&:last-child": { pb: 2 } }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.12)", flexShrink: 0 }}>
                        <Ban size={24} color={theme.palette.error.main} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.62rem" }}>Gastos del Mes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>{fmtMoney(calendarData.expensesTotal)}</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="textSecondary">{calendarData.expensesCount} gastos</Typography>
                          <Delta value={pctOf(calendarData.expensesTotal, calendarData.prevExpenses)} invert />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ bgcolor: theme.palette.primary.main, color: "#fff", borderRadius: "12px", boxShadow: "0 8px 24px rgba(37,99,235,0.35)", height: "100%" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, "&:last-child": { pb: 2 } }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", flexShrink: 0 }}>
                        <TrendingUp size={24} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.62rem", opacity: 0.9 }}>Utilidad Neta</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>{fmtMoney(calendarData.profit)}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>Ventas − Gastos del mes</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Leyenda */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 13, height: 13, borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.success.main }}>
                    <Typography sx={{ fontSize: "0.55rem", color: "#fff", fontWeight: 800, lineHeight: 1 }}>S</Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">Ventas</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 13, height: 13, borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.error.main }}>
                    <Typography sx={{ fontSize: "0.55rem", color: "#fff", fontWeight: 800, lineHeight: 1 }}>E</Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">Gastos</Typography>
                </Box>
              </Box>

              {/* Calendario + detalle del día */}
              <Box sx={{ display: "flex", gap: 3, alignItems: "stretch" }}>
                <Card sx={{ flex: 1, minWidth: 0, p: 2.5, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, flex: 1, alignContent: "start" }}>
                    {DAYS.map((d) => (
                      <Box key={d} sx={{ textAlign: "center", fontSize: "0.78rem", fontWeight: 700, color: "text.secondary", py: 0.5 }}>
                        {d}
                      </Box>
                    ))}
                    {renderCalendar()}
                  </Box>
                </Card>

                <Card sx={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                  {selectedDay ? (
                    <>
                      <Box sx={{ p: 2, pb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem" }}>Reporte del día</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatMXDate(`${selectedDay}T12:00:00`, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => setSelectedDay(null)}>
                            <X size={18} />
                          </IconButton>
                        </Box>
                        <Grid container spacing={1} sx={{ mt: 1 }}>
                          <Grid size={{ xs: 6 }}>
                            <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  }}>
                              <CardContent sx={{ py: 1.5, px: 1.5, "&:last-child": { pb: 1.5 } }}>
                                <Typography variant="caption" sx={{ color: theme.palette.success.main, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Ingresos</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>
                                  {fmtMoney(daySales ? daySales.total : (calendarData.dailySales[selectedDay]?.total || 0))}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  }}>
                              <CardContent sx={{ py: 1.5, px: 1.5, "&:last-child": { pb: 1.5 } }}>
                                <Typography variant="caption" sx={{ color: theme.palette.error.main, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Gastos</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>
                                  {fmtMoney(dayExpenses ? dayExpenses.totalExpenses : (calendarData.dailyExpenses[selectedDay] || 0))}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>
                      <Divider />
                      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
                        {dayLoading ? (
                          <CardSkeleton count={3} />
                        ) : (() => {
                          const items = [
                            ...(daySales?.sales || []).map(s => ({
                              id: `sale-${s.id}`, type: "sale", saleId: s.id,
                              title: `Venta #${s.id}`,
                              desc: methodLabels[s.payment_method] || s.payment_method,
                              status: s.status,
                              time: s.created_at, amount: s.total,
                            })),
                            ...(dayExpenses?.expenses || []).map(e => ({
                              id: `exp-${e.id}`, type: "expense", saleId: null,
                              title: e.reason.startsWith("Compra") ? "Compra de inventario" : "Retiro de efectivo",
                              desc: e.reason, status: e.status,
                              time: e.created_at, amount: -e.amount,
                            })),
                          ].sort((a, b) => new Date(a.time) - new Date(b.time));

                          if (items.length === 0) {
                            return (
                              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: 0.5, py: 4, textAlign: "center" }}>
                                <Receipt size={36} color={theme.palette.text.secondary} style={{ marginBottom: 4 }} />
                                <Typography color="textSecondary" variant="body2">Sin movimientos en este día</Typography>
                              </Box>
                            );
                          }
                          return items.map((item) => (
                            <Card
                              key={item.id}
                              onClick={() => item.type === "sale" && viewDetails(item.saleId)}
                              sx={{
                                mb: 1, p: 1.25,
                                borderLeft: `4px solid ${item.status === "cancelado" ? "rgba(148,163,184,0.6)" : (item.type === "sale" ? theme.palette.success.main : theme.palette.error.main)}`,
                                cursor: item.type === "sale" ? "pointer" : "default",
                                opacity: item.status === "cancelado" ? 0.65 : 1,
                                transition: "all 0.15s",
                                "&:hover": item.type === "sale" ? { bgcolor: isDark ? "rgba(59,130,246,0.14)" : "rgba(37,99,235,0.06)" } : {},
                              }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: item.status === "cancelado" ? "text.secondary" : "text.primary", textDecoration: item.status === "cancelado" ? "line-through" : "none" }}>{item.title}</Typography>
                                    {item.status === "cancelado" && (
                                      <Chip label="Cancelado" size="small" sx={{ fontSize: "0.58rem", fontWeight: 700, height: 18, bgcolor: "rgba(239,68,68,0.14)", color: "error.main" }} />
                                    )}
                                  </Box>
                                  <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                                    {formatMXTime(item.time)} — {item.desc}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap", color: item.status === "cancelado" ? "text.secondary" : (item.type === "sale" ? theme.palette.success.main : theme.palette.error.main), textDecoration: item.status === "cancelado" ? "line-through" : "none" }}>
                                  {item.type === "sale" ? "+" : "−"}{fmtMoney(Math.abs(item.amount))}
                                </Typography>
                              </Box>
                            </Card>
                          ));
                        })()}
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 1, opacity: 0.5, p: 3, textAlign: "center" }}>
                      <CalendarDays size={44} color={theme.palette.text.secondary} />
                      <Typography color="textSecondary" variant="body2">Selecciona un día en el calendario<br />para ver su detalle</Typography>
                    </Box>
                  )}
                </Card>
              </Box>
            </>
          )}
        </Box>
      ) : (
        /* ── Calendar closed ── */
        <Box sx={{ display: "flex", gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Stats 2x2 */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px" }}>
                  <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.12)", mb: 1 }}>
                      <Banknote size={17} color={theme.palette.success.main} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Ventas Totales</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.35rem", lineHeight: 1.2, mt: 0.5 }}>${total.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px" }}>
                  <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.12)", mb: 1 }}>
                      <ShoppingCart size={17} color={theme.palette.primary.main} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Transacciones</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.35rem", lineHeight: 1.2, mt: 0.5 }}>{count}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px" }}>
                  <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.12)", mb: 1 }}>
                      <TrendingUp size={17} color={theme.palette.warning.main} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Ticket Promedio</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.35rem", lineHeight: 1.2, mt: 0.5 }}>${avg.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider",  borderRadius: "12px" }}>
                  <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239, 68, 68, 0.12)", mb: 1 }}>
                      <Ban size={17} color={theme.palette.error.main} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.55rem" }}>Gastos / Egresos</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.35rem", lineHeight: 1.2, mt: 0.5 }}>${totalExpenses.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Chart */}
            <Box sx={{ mb: 2 }}>
              <Card>
                <Box sx={{ p: 2, pb: 0 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Stack direction="row" spacing={0.5}>
                      <Chip label="Semanal" size="small" color={chartMode === "semanal" ? "primary" : "default"}
                        onClick={() => { setChartMode("semanal"); fetchDailyWeek(chartRefDate); }}
                        variant={chartMode === "semanal" ? "filled" : "outlined"} sx={{ fontWeight: 600 }} />
                      <Chip label="Mensual" size="small" color={chartMode === "mensual" ? "primary" : "default"}
                        onClick={() => { setChartMode("mensual"); fetchMonthlyWeeks(chartRefDate); }}
                        variant={chartMode === "mensual" ? "filled" : "outlined"} sx={{ fontWeight: 600 }} />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconButton size="small" onClick={() => navigateChart(-1)}><ChevronLeft fontSize="small" /></IconButton>
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 140, textAlign: "center", fontSize: "0.8rem" }}>
                        {formatChartTitle()}
                      </Typography>
                      <IconButton size="small" onClick={() => navigateChart(1)}><ChevronRight fontSize="small" /></IconButton>
                      {chartBackMonth && chartMode === "semanal" && (
                        <Button size="small" variant="text" sx={{ fontSize: "0.7rem", ml: 1 }}
                          onClick={() => {
                            setChartMode("mensual");
                            setChartRefDate(new Date(chartBackMonth.year, chartBackMonth.month, 1));
                            setChartBackMonth(null);
                          }}>
                          Volver al mes
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Box>
                <Box sx={{ p: 1, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartMode === "semanal" ? (
                      <BarChart data={dailySales} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="day" fontSize={11} tick={{ fill: "#64748b" }} />
                        <YAxis fontSize={11} tick={{ fill: "#64748b" }} tickFormatter={(v) => `$${v}`} />
                        <ReTooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Ventas"]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    ) : (
                      <BarChart data={monthlyWeeks} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" fontSize={11} tick={{ fill: "#64748b" }} />
                        <YAxis fontSize={11} tick={{ fill: "#64748b" }} tickFormatter={(v) => `$${v}`} />
                        <ReTooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Ventas"]} />
                        <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={60}
                          onClick={(data) => data?.weekStart && handleWeekClick(data.weekStart)}
                          style={{ cursor: "pointer" }} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Box>

            {/* Filtros */}
            <Card variant="outlined" sx={{ borderRadius: "12px", mb: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              {tabIndex === 0 ? (
                <Box sx={{ p: 2.5 }}>
                  <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} md={3} lg={2.5}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Desde</Typography>
                      <TextField type="date" value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                        size="small" fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={3} lg={2.5}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Hasta</Typography>
                      <TextField type="date" value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                        size="small" fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={3} lg={4}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Método de Pago</Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {["all", "cash", "card", "transfer"].map((m) => (
                          <Chip key={m} label={m === "all" ? "Todos" : methodLabels[m]} size="small"
                            onClick={() => { setPaymentFilter(m); setPage(0); }}
                            color={paymentFilter === m ? "primary" : "default"}
                            variant={paymentFilter === m ? "filled" : "outlined"}
                            sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
                        ))}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                      <Button variant="contained" onClick={fetchData} fullWidth
                        sx={{ height: 36.5, textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}>
                        Aplicar Filtros
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Box sx={{ p: 2.5 }}>
                  <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} md={3} lg={3}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Desde</Typography>
                      <TextField type="date" value={expenseStartDate}
                        onChange={(e) => { setExpenseStartDate(e.target.value); setExpensesPage(0); }}
                        size="small" fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Hasta</Typography>
                      <TextField type="date" value={expenseEndDate}
                        onChange={(e) => { setExpenseEndDate(e.target.value); setExpensesPage(0); }}
                        size="small" fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                      <Typography variant="caption" sx={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary", mb: 0.5, display: "block", pl: 0.5 }}>Tipo de Gasto</Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {["all", "compra", "retiro"].map((m) => (
                          <Chip key={m} label={m === "all" ? "Todos" : m === "compra" ? "Compra" : "Retiro"} size="small"
                            onClick={() => { setExpenseFilter(m); setExpensesPage(0); }}
                            color={expenseFilter === m ? "primary" : "default"}
                            variant={expenseFilter === m ? "filled" : "outlined"}
                            sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
                        ))}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                      <Button variant="contained" onClick={() => { fetchExpenses(expenseStartDate, expenseEndDate, expensesPage); }} fullWidth
                        sx={{ height: 36.5, textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}>
                        Aplicar Filtros
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Card>

            {/* Tabla */}
            <Card variant="outlined" sx={{ borderRadius: "12px", overflow: "hidden" }}>
              <Box sx={{ position: "relative", borderBottom: 1, borderColor: "divider" }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} centered
                  sx={{ minHeight: 0, "& .MuiTabs-indicator": { height: 3, bgcolor: "#1e3a8a" }, "& .MuiTab-root": { textTransform: "none", fontWeight: 700, py: 2.5, minHeight: 0, fontSize: "0.95rem", color: "text.secondary" }, "& .Mui-selected": { color: "#1e3a8a" } }}>
                  <Tab label="Ventas" />
                  <Tab label="Gastos" />
                </Tabs>
                <Stack direction="row" spacing={1} sx={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)" }}>
                  <Tooltip title="Calendario">
                    <IconButton size="small"
                      sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: "4px", color: "#1e3a8a", bgcolor: calendarOpen ? "rgba(30,58,138,0.1)" : "transparent", "&:hover": { bgcolor: "#eff6ff" } }}
                      onClick={() => { setCalendarOpen(!calendarOpen); if (calendarOpen) setSelectedDay(null); }}>
                      <CalendarDays size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Imprimir reporte">
                    <IconButton size="small"
                      sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: "4px", color: "#1e3a8a", "&:hover": { bgcolor: "#eff6ff" } }}
                      onClick={printReport}>
                      <Printer size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Exportar PDF">
                    <IconButton size="small"
                      sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: "4px", color: "#1e3a8a", "&:hover": { bgcolor: "#eff6ff" } }}
                      onClick={exportPDF}>
                      <Download size={20} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              {loading ? (
                <Box sx={{ p: 2 }}><TableSkeleton rows={4} columns={5} /></Box>
              ) : (
                <Fade in timeout={500}>
                  <Box>
                    {tabIndex === 0 && (
                      <Box>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                                <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Fecha y Hora</TableCell>
                                <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Concepto</TableCell>
                                <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Método</TableCell>
                                <TableCell align="right" sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Monto</TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Acción</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredSales.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s, idx) => (
                                <TableRow key={s.id}
                                  sx={{
                                    bgcolor: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                                    "&:hover": { bgcolor: "rgba(37, 99, 235, 0.04)" },
                                    transition: "background-color 0.15s",
                                  }}>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{formatMXDate(s.created_at)}</Typography>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: "0.7rem" }}>{formatMXTime(s.created_at)}</Typography>
                                  </TableCell>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Venta #{s.id}</Typography>
                                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, mt: 0.3 }}>
                                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: s.status === "cancelado" ? "error.main" : "success.main" }} />
                                      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: s.status === "cancelado" ? "error.main" : "success.main" }}>
                                        {s.status === "cancelado" ? "Cancelado" : "Completado"}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <Tooltip title={methodLabels[s.payment_method] || s.payment_method}>
                                      <Box sx={{
                                        width: 32, height: 32, borderRadius: "4px",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        bgcolor: `${methodColors[s.payment_method] || "#64748b"}1f`,
                                      }}>
                                        {(() => {
                                          const Icon = { cash: Banknote, card: CreditCard, transfer: Landmark }[s.payment_method] || Banknote;
                                          return <Icon size={16} color={methodColors[s.payment_method] || "#64748b"} />;
                                        })()}
                                      </Box>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 1.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: s.status === "cancelado" ? "text.secondary" : "success.main", textDecoration: s.status === "cancelado" ? "line-through" : "none" }}>
                                      {s.status === "cancelado" ? "-" : "+"}${s.total.toFixed(2)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 1.5 }}>
                                    <Button size="small" variant="text" onClick={() => viewDetails(s.id)}
                                      sx={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "none" }}>Detalle</Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {filteredSales.length === 0 && (
                                <TableRow><TableCell colSpan={5} align="center"><Typography color="textSecondary" sx={{ py: 4, fontSize: "0.85rem" }}>No hay ventas en este período</Typography></TableCell></TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <TablePagination
                          rowsPerPageOptions={[10, 15, 30]} component="div" count={filteredSales.length}
                          rowsPerPage={rowsPerPage} page={page}
                          onPageChange={(e, p) => setPage(p)}
                          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                          labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                          sx={{ fontSize: "0.75rem" }}
                        />
                      </Box>
                    )}
                    {tabIndex === 1 && (
                      <Box>
                        {filteredExpenses.length > 0 ? (
                          <TableContainer>
                              <Table>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                                    <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Fecha y Hora</TableCell>
                                    <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Descripción</TableCell>
                                    <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Tipo</TableCell>
                                    <TableCell sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Caja</TableCell>
                                    <TableCell align="right" sx={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", py: 2 }}>Monto</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {filteredExpenses.map((e, idx) => (
                                    <TableRow key={e.id}
                                      sx={{
                                        bgcolor: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                                        "&:hover": { bgcolor: "rgba(239, 68, 68, 0.04)" },
                                        transition: "background-color 0.15s",
                                      }}>
                                      <TableCell sx={{ py: 1.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{formatMXDate(e.created_at)}</Typography>
                                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: "0.7rem" }}>{formatMXTime(e.created_at)}</Typography>
                                      </TableCell>
                                      <TableCell sx={{ py: 1.5, fontSize: "0.8rem", color: e.status === "cancelado" ? "text.secondary" : "text.primary", textDecoration: e.status === "cancelado" ? "line-through" : "none" }}>{e.reason}</TableCell>
                                      <TableCell sx={{ py: 1.5 }}>
                                        {e.status === "cancelado" ? (
                                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.8, py: 0.3, borderRadius: "2px", bgcolor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)" }}>
                                            <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "error.main" }}>
                                              Cancelado
                                            </Typography>
                                          </Box>
                                        ) : (
                                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.8, py: 0.3, borderRadius: "2px", bgcolor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                            <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "error.main" }}>
                                              {e.reason.startsWith("Compra") ? "Compra" : "Retiro"}
                                            </Typography>
                                          </Box>
                                        )}
                                      </TableCell>
                                      <TableCell sx={{ py: 1.5, fontSize: "0.8rem" }}>{registerLabel(e)}</TableCell>
                                      <TableCell align="right" sx={{ py: 1.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: e.status === "cancelado" ? "text.secondary" : "error.main", textDecoration: e.status === "cancelado" ? "line-through" : "none" }}>-${Number(e.amount).toFixed(2)}</Typography>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow>
                                    <TableCell colSpan={4} align="right" sx={{ fontWeight: 700, fontSize: "0.85rem", py: 1.5, borderBottom: "none" }}>Total Gastos:</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.85rem", color: "error.main", py: 1.5, borderBottom: "none" }}>-${filteredExpTotal.toFixed(2)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                          </TableContainer>
                        ) : (
                          <Box sx={{ textAlign: "center", py: 6 }}>
                            <Ban size={40} color={theme.palette.text.secondary} style={{ marginBottom: 4, opacity: 0.4 }} />
                            <Typography color="textSecondary" sx={{ fontSize: "0.85rem" }}>No hay gastos en este período</Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Fade>
              )}
            </Card>
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
                {saleDetail.sale.status === "cancelado" && (
                  <Typography component="span" variant="caption" color="error" sx={{ fontWeight: 700, ml: 1 }}>
                    · CANCELADO
                  </Typography>
                )}
              </Typography>
              {saleDetail.sale.discount_total > 0 && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                  Descuento aplicado: ${Number(saleDetail.sale.discount_total).toFixed(2)}
                </Typography>
              )}
              <TableContainer component={Paper} sx={{ mt: 2, border: "1px solid", borderColor: "divider" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary" }}>Producto</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary" }}>Cant</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary" }}>Precio</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "text.secondary" }}>Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saleDetail.items?.map((item, idx) => (
                      <TableRow key={item.id}
                        sx={{
                          bgcolor: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                          "&:hover": { bgcolor: "rgba(37, 99, 235, 0.04)" },
                        }}>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{item.name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>${item.price_at_sale.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem", fontWeight: 700 }}>${(item.price_at_sale * item.quantity).toFixed(2)}</TableCell>
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
