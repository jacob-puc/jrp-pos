import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
  Chip,
  useTheme,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Divider,
  Fade,
  CircularProgress,
} from "@mui/material";
import {
  AttachMoney,
  Receipt,
  TrendingUp,
  LocalPrintshopOutlined,
  Assessment,
  CalendarToday,
  AccessTime,
  ShoppingCart,
  VisibilityOutlined,
  PreviewOutlined,
  FileDownloadOutlined,
  CheckCircle,
  AccountBalance,
  CreditCard,
  MoneyOff,
  Store,
  Warning,
  History,
  Lock,
  RemoveShoppingCart,
  Close,
} from "@mui/icons-material";
import { CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import {
  mxToday,
  formatMXDateTime,
  formatMXTime,
  formatMXDate,
} from "../utils/dateUtils";
import { useCashier } from "../contexts/CashierContext";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);

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
  const [cancelSaleData, setCancelSaleData] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const regResult = await window.api.invoke("get-cash-register-status", {
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    const reg = regResult.success ? regResult.register : null;
    setRegister(reg);

    const { success, sales: fetchedSales } = await window.api.invoke(
      "get-sales-for-today",
      {
        date: mxToday(),
        registerId: reg?.id || null,
      },
    );
    if (success) {
      setSales(fetchedSales || []);
      const active = (fetchedSales || []).filter(
        (s) => s.status !== "cancelado",
      );
      const total = active.reduce((sum, sale) => sum + sale.total, 0);
      setTotalSales(total);
      setSalesCount(active.length);
    }
    const closedResult = await window.api.invoke("get-closed-registers", {
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (closedResult.success) setClosedRegisters(closedResult.registers || []);
    if (reg?.status === "open") {
      const expResult = await window.api.invoke("get-cash-register-expenses", {
        cashierId: cashier?.id,
        role: cashier?.role,
      });
      if (expResult.success) setExpensesList(expResult.expenses || []);
    }
    setLoading(false);
  }, [cashier?.id, cashier?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenRegister = async () => {
    const result = await window.api.invoke("open-cash-register", {
      openingBalance: parseFloat(openingBalance) || 0,
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (result.success) {
      setOpenRegisterModal(false);
      fetchData();
      setRegisterMessage({
        type: "success",
        text: "Caja abierta exitosamente",
      });
    } else setRegisterMessage({ type: "error", text: result.error });
  };

  const handleCloseRegister = async () => {
    const result = await window.api.invoke("close-cash-register", {
      declaredClose: parseFloat(declaredClose) || 0,
      expenses: parseFloat(expenses) || 0,
      name:
        registerName.trim() || `Cierre ${new Date().toLocaleString("es-MX")}`,
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (result.success) {
      setCloseRegisterModal(false);
      setRegisterName("");
      fetchData();
      setRegisterMessage({
        type: "success",
        text: `Caja cerrada. Esperado: $${result.expectedClose.toFixed(2)}, Diferencia: $${result.difference.toFixed(2)}`,
      });
    } else setRegisterMessage({ type: "error", text: result.error });
  };

  const printDailyReport = async () => {
    const store = await window.api.invoke("get-setting", "store_name");
    const storeName = store || "MI TIENDA POS";
    const now = new Date();
    const today = now.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const totalExp = expensesList.reduce((s, e) => s + Number(e.amount), 0);
    const ganancia = totalSales - totalExp;
    const methodNames = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
    };
    const expensesHtml =
      expensesList.length > 0
        ? `
      <div class="section-title">Gastos / Egresos</div>
      <table><tr><th>#</th><th>Hora</th><th>Motivo</th><th>Monto</th></tr>
      ${expensesList.map((e, i) => `<tr><td>${i + 1}</td><td>${new Date(e.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td><td>${e.reason}</td><td align="right">$${Number(e.amount).toFixed(2)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="3">TOTAL GASTOS</td><td align="right">$${totalExp.toFixed(2)}</td></tr>
      </table>`
        : "";
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte Diario</title>
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
        .resumen-table td{padding:5px 10px;border:none;font-size:12px}
        .resumen-table tr:last-child td{border-top:2px solid #1e3a5f;font-weight:700;font-size:14px}
        .section-title{font-size:14px;font-weight:700;color:#1e3a5f;margin:18px 0 6px 0}
        .footer{text-align:center;margin-top:35px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:12px}
        .signature{display:flex;justify-content:space-around;margin-top:40px}
        .sig-box{text-align:center;width:200px}
        .sig-line{display:block;border-top:2px solid #1e293b;margin-top:40px;padding-top:6px;font-size:12px;color:#1e293b}
        @media print{body{margin:0.5in} .no-print{display:none}}
      </style></head><body>
      <h1>${storeName.toUpperCase()}</h1>
      <p class="subtitle">Reporte Diario — ${today}</p>
      <hr>
      <div class="section-title">Ventas del Día</div>
      <table><tr><th>#</th><th>Hora</th><th>Método</th><th>Total</th></tr>
      ${sales.filter((s) => s.status !== "cancelado").map((s, i) => `<tr><td>${i + 1}</td><td>${new Date(s.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td><td>${methodNames[s.payment_method] || s.payment_method}</td><td align="right">$${s.total.toFixed(2)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="3">TOTAL VENTAS</td><td align="right">$${totalSales.toFixed(2)}</td></tr>
      </table>
      ${expensesHtml}
      <hr>
      <div class="section-title">Resumen Final</div>
      <table class="resumen-table">
        <tr><td>Ventas Totales</td><td align="right">$${totalSales.toFixed(2)}</td></tr>
        <tr><td>Total Gastos</td><td align="right">-$${totalExp.toFixed(2)}</td></tr>
        <tr><td>GANANCIA DEL DÍA</td><td align="right">$${ganancia.toFixed(2)}</td></tr>
      </table>
      <div class="section-title">Desglose por método</div>
      <table class="resumen-table">
        <tr><td>Efectivo</td><td align="right">$${totalCash.toFixed(2)}</td></tr>
        <tr><td>Tarjeta</td><td align="right">$${totalCard.toFixed(2)}</td></tr>
        <tr><td>Transferencia</td><td align="right">$${totalTransfer.toFixed(2)}</td></tr>
      </table>
      ${
        register
          ? `<div class="section-title">Caja</div>
      <table class="resumen-table">
        <tr><td>Apertura de caja</td><td align="right">$${register.opening_balance.toFixed(2)}</td></tr>
        <tr><td>Efectivo en caja</td><td align="right">$${(register.opening_balance + totalCash - (register.expenses || 0)).toFixed(2)}</td></tr>
        <tr><td>Cierre esperado</td><td align="right">$${(register.opening_balance + totalSales - (register.expenses || 0)).toFixed(2)}</td></tr>
      </table>`
          : ""
      }
      <div class="signature"><div class="sig-box"><span class="sig-line">Cajero</span></div><div class="sig-box"><span class="sig-line">Supervisor</span></div></div>
      <div class="footer">Generado el ${formatMXDateTime(now)} — JRP POS</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // ─── EXPORTAR PDF ─────────────────────────────────────
  const exportDailyPDF = async () => {
    const store = await window.api.invoke("get-setting", "store_name");
    const storeName = store || "MI TIENDA POS";
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;

    // Store name + report title
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(storeName.toUpperCase(), margin, 22);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(
      `Reporte Diario — ${new Date().toLocaleDateString("es-MX")}`,
      margin,
      29,
    );

    // Separador
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(margin, 33, pageW - margin, 33);

    // ─── TABLA DE VENTAS ─────────────────────────────────
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30);
    doc.text("VENTAS DEL DÍA", margin, 44);

    const saleRows = sales
      .filter((s) => s.status !== "cancelado")
      .map((s, i) => [
      i + 1,
      new Date(s.created_at).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      }),
      s.payment_method === "cash"
        ? "Efectivo"
        : s.payment_method === "card"
          ? "Tarjeta"
          : "Transferencia",
      `$${s.total.toFixed(2)}`,
    ]);

    doc.autoTable({
      head: [["#", "Hora", "Método", "Total"]],
      body: saleRows,
      startY: 48,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      footStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
      },
      footer: [
        [
          {
            content: "TOTAL VENTAS",
            colSpan: 3,
            styles: { fontStyle: "bold", halign: "right" },
          },
          `$${totalSales.toFixed(2)}`,
        ],
      ],
    });

    let yy = doc.lastAutoTable.finalY + 6;

    // ─── TABLA DE GASTOS ─────────────────────────────────
    if (expensesList.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.setTextColor(30);
      doc.text("GASTOS / EGRESOS", margin, yy);
      yy += 4;

      const expRows = expensesList.map((e, i) => [
        i + 1,
        new Date(e.created_at).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Mexico_City",
        }),
        e.reason,
        `$${Number(e.amount).toFixed(2)}`,
      ]);
      const totalExpenses = expensesList.reduce(
        (s, e) => s + Number(e.amount),
        0,
      );

      doc.autoTable({
        head: [["#", "Hora", "Motivo", "Monto"]],
        body: expRows,
        startY: yy,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [239, 68, 68],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        footStyles: {
          fillColor: [239, 68, 68],
          textColor: 255,
          fontStyle: "bold",
        },
        footer: [
          [
            {
              content: "TOTAL GASTOS",
              colSpan: 3,
              styles: { fontStyle: "bold", halign: "right" },
            },
            `$${totalExpenses.toFixed(2)}`,
          ],
        ],
      });

      yy = doc.lastAutoTable.finalY + 8;
    } else {
      yy += 4;
      doc.setFontSize(9);
      doc.setFont(undefined, "italic");
      doc.setTextColor(150);
      doc.text("Sin gastos registrados", margin, yy);
      yy += 8;
    }

    // ─── LÍNEA SEPARADORA ───────────────────────────────
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, yy, pageW - margin, yy);
    yy += 6;

    // ─── RESUMEN FINAL ──────────────────────────────────
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30);
    doc.text("RESUMEN FINAL", margin, yy);
    yy += 8;

    const totalExp = expensesList.reduce((s, e) => s + Number(e.amount), 0);
    const ganancia = totalSales - totalExp;
    const efectivoEnCaja = register
      ? register.opening_balance + totalCash - (register.expenses || 0)
      : 0;
    const cierreEsperado = register
      ? register.opening_balance + totalSales - (register.expenses || 0)
      : 0;

    const summaryRows = [
      ["Ventas Totales", `$${totalSales.toFixed(2)}`],
      ["Total Gastos", `-$${totalExp.toFixed(2)}`],
      ["", ""],
      ["GANANCIA DEL DÍA", `$${ganancia.toFixed(2)}`],
    ];
    if (register) {
      summaryRows.push(["", ""]);
      summaryRows.push([
        "Apertura de caja",
        `$${register.opening_balance.toFixed(2)}`,
      ]);
      summaryRows.push(["Efectivo en caja", `$${efectivoEnCaja.toFixed(2)}`]);
      summaryRows.push(["Cierre esperado", `$${cierreEsperado.toFixed(2)}`]);
    }

    doc.autoTable({
      body: summaryRows,
      startY: yy,
      margin: { left: margin + 10, right: margin + 10 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { fontStyle: "bold", halign: "right", cellWidth: 50 },
      },
      theme: "plain",
    });

    yy = doc.lastAutoTable.finalY + 6;

    // Desglose por método
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(60);
    doc.text("Desglose por método:", margin + 10, yy);
    yy += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    [
      ["Efectivo", `$${totalCash.toFixed(2)}`],
      ["Tarjeta", `$${totalCard.toFixed(2)}`],
      ["Transferencia", `$${totalTransfer.toFixed(2)}`],
    ].forEach(([label, val]) => {
      doc.setFont(undefined, "normal");
      doc.text(label, margin + 16, yy);
      doc.setFont(undefined, "bold");
      doc.text(val, pageW - margin - 16, yy, { align: "right" });
      doc.setFont(undefined, "normal");
      yy += 5;
    });

    yy += 4;
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, yy, pageW - margin, yy);
    yy += 8;

    // Footers
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text("Cajero: ___________________", margin + 10, yy);
    doc.text("Supervisor: ___________________", pageW / 2 + 5, yy);
    yy += 14;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, yy, pageW - margin, yy);
    yy += 5;

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generado el ${new Date().toLocaleString("es-MX")}`, margin, yy);
    doc.setFont(undefined, "bold");
    doc.text("JRP POS", pageW - margin, yy, { align: "right" });

    doc.save(`reporte-diario-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleViewRegisterDetail = async (registerId) => {
    const result = await window.api.invoke(
      "get-register-sales-detail",
      registerId,
    );
    if (result.success) {
      setRegisterDetailData(result);
      setRegisterDetailModal(true);
    }
  };

  const handleCancelSale = async () => {
    if (!cancelSaleData) return;
    setCancelLoading(true);
    const result = await window.api.invoke("cancel-sale", {
      saleId: cancelSaleData.id,
      cashierName: cashier?.name,
    });
    setCancelLoading(false);
    const saleId = cancelSaleData.id;
    setCancelSaleData(null);
    if (result.success) {
      fetchData();
      setRegisterMessage({
        type: "success",
        text: `Venta #${saleId} cancelada. Se revirtió el stock.`,
      });
    } else {
      setRegisterMessage({ type: "error", text: result.error });
    }
  };

  const handleRegisterExpense = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setRegisterMessage({ type: "error", text: "Ingresa un monto válido" });
      return;
    }
    if (!withdrawReason.trim()) {
      setRegisterMessage({
        type: "error",
        text: "Ingresa el motivo del retiro",
      });
      return;
    }
    setWithdrawLoading(true);
    const result = await window.api.invoke("register-cash-expense", {
      amount,
      reason: withdrawReason.trim(),
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    setWithdrawLoading(false);
    if (result.success) {
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setWithdrawReason("");
      fetchData();
      window.api
        .invoke("open-cash-drawer")
        .catch((e) => console.error("[DRAWER]", e));
      setRegisterMessage({
        type: "success",
        text: `Retiro de $${amount.toFixed(2)} registrado: ${withdrawReason.trim()}`,
      });
    } else {
      setRegisterMessage({ type: "error", text: result.error });
    }
  };

  const isOpen = useMemo(() => register?.status === "open", [register]);
  const canManageRegister = useMemo(() => {
    if (!isOpen || !register) return false;
    const openerIsAdmin = register.opener_role === "admin";
    const isOwn =
      String(register.opened_by) === String(cashier?.id) ||
      String(register.cashier_id) === String(cashier?.id);
    return isOwn || openerIsAdmin || cashier?.role === "admin";
  }, [isOpen, register, cashier?.id, cashier?.role]);

  useEffect(() => {
    if (loading) return;
    const action = localStorage.getItem("eodPendingAction");
    if (!action) return;
    localStorage.removeItem("eodPendingAction");
    if (action === "close-register") {
      if (!canManageRegister) {
        setRegisterMessage({
          type: "error",
          text: "No hay caja abierta para cerrar",
        });
        return;
      }
      setRegisterName("");
      setExpenses("");
      setCloseRegisterModal(true);
    } else if (action === "withdraw") {
      if (!canManageRegister) {
        setRegisterMessage({
          type: "error",
          text: "No hay caja abierta para retirar efectivo",
        });
        return;
      }
      setWithdrawAmount("");
      setWithdrawReason("");
      setWithdrawDialogOpen(true);
    }
  }, [loading, canManageRegister]);

  const totalCash = useMemo(
    () =>
      sales
        .filter(
          (s) => s.status !== "cancelado" && s.payment_method === "cash",
        )
        .reduce((sum, s) => sum + s.total, 0),
    [sales],
  );
  const totalCard = useMemo(
    () =>
      sales
        .filter(
          (s) => s.status !== "cancelado" && s.payment_method === "card",
        )
        .reduce((sum, s) => sum + s.total, 0),
    [sales],
  );
  const totalTransfer = useMemo(
    () =>
      sales
        .filter(
          (s) => s.status !== "cancelado" && s.payment_method === "transfer",
        )
        .reduce((sum, s) => sum + s.total, 0),
    [sales],
  );
  const isAdmin = cashier?.role === "admin";
  const dayItems = useMemo(
    () =>
      [
        ...sales.map((s) => ({
          type: "sale",
          id: `sale-${s.id}`,
          saleId: s.id,
          status: s.status,
          title: `Venta #${s.id}`,
          desc:
            s.payment_method === "cash"
              ? "Efectivo"
              : s.payment_method === "card"
                ? "Tarjeta"
                : "Transferencia",
          time: s.created_at,
          amount: s.total,
          icon: <ShoppingCart sx={{ fontSize: 20 }} />,
          iconBg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        })),
        ...expensesList.map((e) => ({
          type: "expense",
          id: `exp-${e.id}`,
          title: e.reason.startsWith("Compra")
            ? "Compra de inventario"
            : "Retiro de efectivo",
          desc: e.reason,
          time: e.created_at,
          amount: -e.amount,
          icon: <RemoveShoppingCart sx={{ fontSize: 20 }} />,
          iconBg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        })),
      ].sort((a, b) => new Date(a.time) - new Date(b.time)),
    [sales, expensesList],
  );

  const methodNames = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };
  const methodIcons = {
    cash: <AttachMoney sx={{ fontSize: 17, color: "#059669" }} />,
    card: <CreditCard sx={{ fontSize: 17, color: "#4f46e5" }} />,
    transfer: <AccountBalance sx={{ fontSize: 17, color: "#d97706" }} />,
  };
  const formatDuration = (start, end) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMs = Math.max(0, e - s);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const SectionTitle = ({ icon: Icon, children }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: "10px",
        bgcolor: isDark ? "rgba(255,255,255,0.06)" : "#e4e4e7",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Icon sx={{ fontSize: 16, color: "text.secondary" }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: "0.68rem",
          color: "text.primary",
        }}
      >
        {children}
      </Typography>
    </Box>
  );

  const statusBanner = !register
    ? {
        bg: "rgba(217, 119, 6, 0.12)",
        color: "#d97706",
        icon: Warning,
        title: "Sin Apertura de Caja",
        subtitle: "Abre una caja para comenzar a vender",
      }
    : isOpen
      ? {
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
          icon: CheckCircle,
          title: "Caja Abierta",
          subtitle:
            String(register.opened_by) === String(cashier?.id) ||
            String(register.cashier_id) === String(cashier?.id)
              ? `Abierta a las ${formatMXTime(register.opened_at)}`
              : `Abierta por: ${register.opener_name || "otro usuario"}`,
        }
      : {
          bg: "rgba(100, 116, 139, 0.12)",
          color: "#64748b",
          icon: Lock,
          title: "Caja Cerrada",
          subtitle: "Abre una caja para comenzar a registrar ventas",
        };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography
        variant="h2"
        sx={{ mb: 2, textAlign: "center", fontSize: "1.8rem" }}
      >
        Caja
      </Typography>

      {registerMessage && (
        <Alert
          severity={registerMessage.type}
          sx={{ mb: 2 }}
          onClose={() => setRegisterMessage(null)}
        >
          {registerMessage.text}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box sx={{ textAlign: "left" }}>
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.75rem",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            <CalendarToday fontSize="small" />
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "America/Mexico_City",
            })}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "#64748b",
              fontSize: "0.65rem",
              ml: 3,
              lineHeight: 1.3,
            }}
          >
            {new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Mexico_City",
            })}
          </Typography>
        </Box>
      </Box>

      <Card
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
          mb: 2,
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            py: 1.75,
            px: 2.5,
            "&:last-child": { pb: 1.75 },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: statusBanner.bg,
              flexShrink: 0,
            }}
          >
            <statusBanner.icon sx={{ fontSize: 24, color: statusBanner.color }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {statusBanner.title}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ lineHeight: 1.35, display: "block" }}
            >
              {statusBanner.subtitle}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Card
              sx={{
                flex: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "none",
              }}
            >
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  px: 2,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(16, 185, 129, 0.12)",
                  }}
                >
                  <AttachMoney sx={{ fontSize: 22, color: "#059669" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "textSecondary",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontSize: "0.6rem",
                      lineHeight: 1.2,
                    }}
                  >
                    Ventas Totales
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "text.primary",
                      fontSize: "1.25rem",
                      lineHeight: 1.1,
                    }}
                  >
                    ${totalSales.toFixed(2)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Card
              sx={{
                flex: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "none",
              }}
            >
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  px: 2,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(13, 148, 136, 0.12)",
                  }}
                >
                  <Receipt sx={{ fontSize: 22, color: "#0d9488" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "textSecondary",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontSize: "0.6rem",
                      lineHeight: 1.2,
                    }}
                  >
                    Transacciones
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "text.primary",
                      fontSize: "1.25rem",
                      lineHeight: 1.1,
                    }}
                  >
                    {salesCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Card
              sx={{
                flex: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "none",
              }}
            >
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  px: 2,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(217, 119, 6, 0.12)",
                  }}
                >
                  <AccountBalance sx={{ fontSize: 22, color: "#d97706" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "textSecondary",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontSize: "0.6rem",
                      lineHeight: 1.2,
                    }}
                  >
                    Efectivo en Caja
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "text.primary",
                      fontSize: "1.25rem",
                      lineHeight: 1.1,
                    }}
                  >
                    $
                    {isOpen
                      ? (
                          register.opening_balance +
                          totalCash -
                          (register.expenses || 0)
                        ).toFixed(2)
                      : "0.00"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Fade>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 1.5,
              px: 2,
              "&:last-child": { pb: 1.5 },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(16, 185, 129, 0.12)",
              }}
            >
              <AttachMoney sx={{ fontSize: 22, color: "#059669" }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "textSecondary",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontSize: "0.6rem",
                  lineHeight: 1.2,
                }}
              >
                Efectivo
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "text.primary",
                  fontSize: "1.25rem",
                  lineHeight: 1.1,
                }}
              >
                ${totalCash.toFixed(2)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 1.5,
              px: 2,
              "&:last-child": { pb: 1.5 },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(79, 70, 229, 0.12)",
              }}
            >
              <CreditCard sx={{ fontSize: 22, color: "#4f46e5" }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "textSecondary",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontSize: "0.6rem",
                  lineHeight: 1.2,
                }}
              >
                Tarjeta
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "text.primary",
                  fontSize: "1.25rem",
                  lineHeight: 1.1,
                }}
              >
                ${totalCard.toFixed(2)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 1.5,
              px: 2,
              "&:last-child": { pb: 1.5 },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(217, 119, 6, 0.12)",
              }}
            >
              <AccountBalance sx={{ fontSize: 22, color: "#d97706" }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "textSecondary",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontSize: "0.6rem",
                  lineHeight: 1.2,
                }}
              >
                Transferencia
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "text.primary",
                  fontSize: "1.25rem",
                  lineHeight: 1.1,
                }}
              >
                ${totalTransfer.toFixed(2)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        sx={{ mb: 3, flexWrap: "wrap" }}
      >
        {!isOpen && (
          <Button
            variant="outlined"
            size="large"
            startIcon={<Store />}
            onClick={() => {
              setOpeningBalance("");
              setOpenRegisterModal(true);
            }}
            sx={{
              px: 3,
              fontSize: "0.9rem",
              border: "2px solid",
              borderColor: "primary.main",
              color: "primary.main",
              backgroundColor: "rgba(59,130,246,0.06)",
              "&:hover": {
                backgroundColor: "rgba(59,130,246,0.12)",
                borderColor: "primary.main",
              },
            }}
          >
            Abrir Caja
          </Button>
        )}
        {canManageRegister && (
          <Button
            variant="outlined"
            size="large"
            startIcon={<MoneyOff />}
            onClick={() => {
              setDeclaredClose("");
              setExpenses("");
              setRegisterName("");
              setCloseRegisterModal(true);
            }}
            sx={{
              px: 3,
              fontSize: "0.9rem",
              border: "2px solid",
              borderColor: "warning.main",
              color: "warning.main",
              backgroundColor: "rgba(245,158,11,0.06)",
              "&:hover": {
                backgroundColor: "rgba(245,158,11,0.12)",
                borderColor: "warning.main",
              },
            }}
          >
            Cerrar Caja
          </Button>
        )}
        {canManageRegister && (
          <Button
            variant="outlined"
            size="large"
            startIcon={<RemoveShoppingCart />}
            onClick={() => {
              setWithdrawAmount("");
              setWithdrawReason("");
              setWithdrawDialogOpen(true);
            }}
            sx={{
              px: 3,
              fontSize: "0.9rem",
              border: "2px solid",
              borderColor: "error.main",
              color: "error.main",
              backgroundColor: "rgba(239,68,68,0.06)",
              "&:hover": {
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "error.main",
              },
            }}
          >
            Retirar Dinero
          </Button>
        )}
      </Stack>

      {isOpen && register && (
        <Box sx={{ maxWidth: 700, mx: "auto", mb: 3 }}>
          <Card>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2.5,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <AccountBalance color="primary" /> Resumen de Caja
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Exportar PDF">
                    <IconButton
                      size="small"
                      onClick={exportDailyPDF}
                      sx={{ border: "1px solid", borderColor: "#9ca3af", borderRadius: "8px", color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                    >
                      <FileDownloadOutlined />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Imprimir reporte">
                    <IconButton
                      size="small"
                      onClick={printDailyReport}
                      sx={{ border: "1px solid", borderColor: "#9ca3af", borderRadius: "8px", color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                    >
                      <LocalPrintshopOutlined />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver detalles">
                    <IconButton
                      size="small"
                      onClick={() => setDetailsModalOpen(true)}
                      sx={{ border: "1px solid", borderColor: "#9ca3af", borderRadius: "8px", color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                    >
                      <PreviewOutlined />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
              <Grid container spacing={1.5}>
                {[
                  {
                    label: "Apertura",
                    value: register.opening_balance,
                    icon: Store,
                    color: "#64748b",
                    bg: "rgba(100, 116, 139, 0.12)",
                  },
                  {
                    label: "Efectivo",
                    value: totalCash,
                    icon: AttachMoney,
                    color: "#059669",
                    bg: "rgba(16, 185, 129, 0.12)",
                  },
                  {
                    label: "Tarjeta",
                    value: totalCard,
                    icon: CreditCard,
                    color: "#4f46e5",
                    bg: "rgba(79, 70, 229, 0.12)",
                  },
                  {
                    label: "Transferencia",
                    value: totalTransfer,
                    icon: AccountBalance,
                    color: "#d97706",
                    bg: "rgba(217, 119, 6, 0.12)",
                  },
                  {
                    label: "Gastos",
                    value: register.expenses || 0,
                    icon: MoneyOff,
                    color: "#dc2626",
                    bg: "rgba(220, 38, 38, 0.12)",
                  },
                  {
                    label: "Cierre Esperado",
                    value:
                      register.opening_balance +
                      totalSales -
                      (register.expenses || 0),
                    icon: TrendingUp,
                    color: "#0d9488",
                    bg: "rgba(13, 148, 136, 0.12)",
                  },
                ].map((item, idx) => (
                  <Grid size={{ xs: 6, md: 4 }} key={idx}>
                    <Card
                      sx={{
                        height: "100%",
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "none",
                      }}
                    >
                      <CardContent
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          py: 1.25,
                          px: 1.5,
                          "&:last-child": { pb: 1.25 },
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: item.bg,
                            flexShrink: 0,
                          }}
                        >
                          <item.icon sx={{ fontSize: 18, color: item.color }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "textSecondary",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              fontSize: "0.55rem",
                              lineHeight: 1.2,
                              display: "block",
                            }}
                          >
                            {item.label}
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              lineHeight: 1.1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            ${item.value.toFixed(2)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
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
            <Typography
              variant="h6"
              sx={{
                mb: 1.5,
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Assessment /> Detalle del Día
            </Typography>
            {dayItems.length === 0 ? (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ textAlign: "center", py: 3 }}
              >
                No hay movimientos registrados hoy
              </Typography>
            ) : (
              <List sx={{ py: 0 }}>
                {dayItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ListItem
                      sx={{
                        py: 1.5,
                        px: 0,
                        "&:hover": {
                          backgroundColor: isDark
                            ? "rgba(37, 99, 235, 0.04)"
                            : "rgba(37, 99, 235, 0.03)",
                          borderRadius: 2,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          width: "100%",
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background: item.iconBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {item.title}
                            </Typography>
                            {item.status === "cancelado" && (
                              <Chip
                                label="Cancelado"
                                size="small"
                                sx={{
                                  fontSize: "0.58rem",
                                  fontWeight: 700,
                                  height: 18,
                                  bgcolor: "rgba(239,68,68,0.14)",
                                  color: "error.main",
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            <AccessTime
                              fontSize="inherit"
                              sx={{ verticalAlign: "middle", mr: 0.5 }}
                            />
                            {formatMXTime(item.time)} — {item.desc}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 0.25,
                          }}
                        >
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              color:
                                item.status === "cancelado"
                                  ? "text.secondary"
                                  : item.type === "sale"
                                    ? theme.palette.success.main
                                    : "error.main",
                              textDecoration:
                                item.status === "cancelado"
                                  ? "line-through"
                                  : "none",
                            }}
                          >
                            {item.type === "sale" ? "+" : "-"}$
                            {Math.abs(item.amount).toFixed(2)}
                          </Typography>
                          {item.type === "sale" &&
                            item.status !== "cancelado" &&
                            canManageRegister && (
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  setCancelSaleData({ id: item.saleId })
                                }
                                sx={{
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  textTransform: "none",
                                  minWidth: 0,
                                  py: 0,
                                  px: 0.5,
                                }}
                              >
                                Cancelar
                              </Button>
                            )}
                        </Box>
                      </Box>
                    </ListItem>
                    {index < dayItems.length - 1 && (
                      <Divider sx={{ opacity: 0.3 }} />
                    )}
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
            <Typography
              variant="h6"
              sx={{
                mb: 1.5,
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
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
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Ventas
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Transacciones
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Detalle
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {closedRegisters.map((cr) => (
                    <TableRow
                      key={cr.id}
                      hover
                      sx={{
                        "&:hover": {
                          backgroundColor: isDark
                            ? "rgba(37, 99, 235, 0.06)"
                            : "rgba(37, 99, 235, 0.04)",
                        },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        {cr.name || `Cierre #${cr.id}`}
                      </TableCell>
                      <TableCell>{cr.opener_name || "—"}</TableCell>
                      <TableCell>{cr.closer_name || "—"}</TableCell>
                      <TableCell>{formatMXDate(cr.closed_at)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.success.main,
                        }}
                      >
                        ${(cr.total_sales || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">{cr.sale_count || 0}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver detalle">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewRegisterDetail(cr.id)}
                          >
                            <VisibilityOutlined />
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
          Hay {salesCount} venta(s) registrada(s) hoy fuera de caja. Abre la
          caja para visualizar el detalle.
        </Alert>
      )}

      <Dialog
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle del Día</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Monto
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dayItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No hay movimientos hoy
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  dayItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Chip
                          label={item.type === "sale" ? "Venta" : "Gasto"}
                          size="small"
                          color={item.type === "sale" ? "success" : "error"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatMXTime(item.time)}</TableCell>
                      <TableCell>{item.desc}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color:
                            item.type === "sale"
                              ? theme.palette.success.main
                              : "error.main",
                        }}
                      >
                        {item.type === "sale" ? "+" : "-"}$
                        {Math.abs(item.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setDetailsModalOpen(false)}>
            Cerrar
          </CancelButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openRegisterModal}
        onClose={() => setOpenRegisterModal(false)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleOpenRegister();
        }}
        PaperProps={{
          sx: {
            borderRadius: "20px",
            background: isDark
              ? "rgba(17, 24, 39, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <Store sx={{ color: theme.palette.primary.main, fontSize: 26 }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, fontSize: "1.1rem" }}
            >
              Abrir Caja
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ fontSize: "0.8rem" }}
          >
            Ingresa el monto inicial en efectivo para abrir la caja del día.
          </Typography>
        </DialogTitle>
        <Divider sx={{ mb: 2 }} />
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <TextField
            label="Monto de apertura"
            type="number"
            value={openingBalance}
            fullWidth
            autoFocus
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AttachMoney sx={{ fontSize: 18, color: "#64748b" }} />
                  </InputAdornment>
                ),
              },
            }}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <CancelButton onClick={() => setOpenRegisterModal(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={handleOpenRegister}
            variant="outlined"
            startIcon={<CheckCircle />}
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
            Abrir Caja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={closeRegisterModal}
        onClose={() => setCloseRegisterModal(false)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleCloseRegister();
        }}
        PaperProps={{
          sx: {
            borderRadius: "10px",
            background: isDark
              ? "rgba(17, 24, 39, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <MoneyOff
              sx={{ color: theme.palette.warning.main, fontSize: 26 }}
            />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, fontSize: "1.1rem" }}
            >
              Cerrar Caja
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ fontSize: "0.8rem" }}
          >
            Ingresa el monto final en efectivo y los gastos del día para cerrar
            la caja.
          </Typography>
        </DialogTitle>
        <Divider sx={{ mb: 2 }} />
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre de la caja"
              value={registerName}
              fullWidth
              autoFocus
              onChange={(e) => setRegisterName(e.target.value)}
              placeholder="Ej: Caja mañana, Caja tarde..."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Store sx={{ fontSize: 18, color: "#64748b" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Efectivo declarado"
              type="number"
              value={declaredClose}
              fullWidth
              onChange={(e) => setDeclaredClose(e.target.value)}
              placeholder="0.00"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney sx={{ fontSize: 18, color: "#64748b" }} />
                    </InputAdornment>
                  ),
                },
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label="Gastos / Egresos"
              type="number"
              value={expenses}
              fullWidth
              onChange={(e) => setExpenses(e.target.value)}
              placeholder="0.00"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney sx={{ fontSize: 18, color: "#64748b" }} />
                    </InputAdornment>
                  ),
                },
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <CancelButton onClick={() => setCloseRegisterModal(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={handleCloseRegister}
            variant="outlined"
            startIcon={<CheckCircle />}
            sx={{
              border: "1px solid",
              borderColor: "warning.main",
              color: "warning.main",
              backgroundColor: "rgba(245,158,11,0.06)",
              "&:hover": {
                backgroundColor: "rgba(245,158,11,0.12)",
                borderColor: "warning.main",
              },
            }}
          >
            Cerrar Caja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!cancelSaleData}
        onClose={() => !cancelLoading && setCancelSaleData(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
          >
            <Warning sx={{ color: "error.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Cancelar venta #{cancelSaleData?.id}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Se revertirá el stock de los productos y esta venta dejará de contar
            en la caja y en las ganancias. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{ px: 3, pb: 3, justifyContent: "space-between" }}
        >
          <CancelButton
            onClick={() => !cancelLoading && setCancelSaleData(null)}
          >
            No
          </CancelButton>
          <Button
            variant="contained"
            color="error"
            disabled={cancelLoading}
            onClick={handleCancelSale}
          >
            {cancelLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Sí, cancelar"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={withdrawDialogOpen}
        onClose={() => !withdrawLoading && setWithdrawDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleRegisterExpense();
        }}
        PaperProps={{
          sx: {
            borderRadius: "12px",
            background: isDark
              ? "rgba(17, 24, 39, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <RemoveShoppingCart
              sx={{ color: theme.palette.error.main, fontSize: 26 }}
            />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, fontSize: "1.1rem" }}
            >
              Retirar Dinero de Caja
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ fontSize: "0.8rem" }}
          >
            Registra una salida de efectivo. Se agregará a los gastos del día.
          </Typography>
        </DialogTitle>
        <Divider sx={{ mb: 2 }} />
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Motivo del retiro"
              value={withdrawReason}
              fullWidth
              autoFocus
              onChange={(e) => setWithdrawReason(e.target.value)}
              placeholder="Ej: Pago a proveedor, gasto menor..."
              disabled={withdrawLoading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Receipt sx={{ fontSize: 18, color: "#64748b" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Monto a retirar"
              type="number"
              value={withdrawAmount}
              fullWidth
              onChange={(e) => setWithdrawAmount(e.target.value)}
              disabled={withdrawLoading}
              placeholder="0.00"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney sx={{ fontSize: 18, color: "#64748b" }} />
                    </InputAdornment>
                  ),
                },
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <CancelButton
            onClick={() => setWithdrawDialogOpen(false)}
            disabled={withdrawLoading}
          >
            Cancelar
          </CancelButton>
          <Button
            onClick={handleRegisterExpense}
            variant="outlined"
            disabled={withdrawLoading}
            startIcon={
              withdrawLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CheckCircle />
              )
            }
            sx={{
              border: "1px solid",
              borderColor: "error.main",
              color: "error.main",
              backgroundColor: "rgba(239,68,68,0.06)",
              "&:hover": {
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "error.main",
              },
            }}
          >
            {withdrawLoading ? "Registrando..." : "Confirmar Retiro"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={registerDetailModal}
        onClose={() => setRegisterDetailModal(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            height: "min(920px, 92vh)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: isDark ? "#16181d" : "#f4f4f5",
          },
        }}
      >
        {registerDetailData && (
          <>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? "#16181d" : "rgba(255,255,255,0.85)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    mb: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#e4e4e7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <History sx={{ fontSize: 20, color: "text.secondary" }} />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      fontSize: "1.15rem",
                      color: "text.primary",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {registerDetailData.register.name ||
                      `Cierre #${registerDetailData.register.id}`}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    <strong>Responsable:</strong>{" "}
                    {registerDetailData.register.opener_name || "—"}
                  </span>
                  <Box component="span" sx={{ color: "#cbd5e1" }}>
                    |
                  </Box>
                  <span>
                    <strong>Cerrado por:</strong>{" "}
                    {registerDetailData.register.closer_name || "—"}
                  </span>
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setRegisterDetailModal(false)}
                sx={{
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                }}
              >
                <Close sx={{ fontSize: 22 }} />
              </IconButton>
            </Box>

            <Box
              sx={{
                flex: 1,
                display: "flex",
                overflow: "hidden",
                flexDirection: { xs: "column", md: "row" },
              }}
            >
              <Box
                sx={{
                  width: { xs: "100%", md: "34%" },
                  flexShrink: 0,
                  borderRight: { md: "1px solid" },
                  borderBottom: { xs: "1px solid", md: "none" },
                  borderColor: "divider",
                  bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#ececee",
                  p: 2.5,
                  overflowY: "auto",
                }}
              >
                <Grid container spacing={1.25} sx={{ mb: 3 }}>
                  {[
                    {
                      label: "Ventas",
                      value: `$${registerDetailData.totalSales.toFixed(2)}`,
                      icon: AttachMoney,
                      color: "#059669",
                    },
                    {
                      label: "Artículos",
                      value: registerDetailData.totalItems,
                      icon: ShoppingCart,
                      color: "#4f46e5",
                    },
                    {
                      label: "Operaciones",
                      value: registerDetailData.saleCount,
                      icon: Receipt,
                      color: "#0d9488",
                    },
                  ].map((s) => (
                    <Grid size={{ xs: 4 }} key={s.label}>
                      <Box
                        sx={{
                          p: 1.25,
                          borderRadius: "10px",
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.paper",
                          height: "100%",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            mb: 0.5,
                          }}
                        >
                          <s.icon sx={{ fontSize: 15, color: s.color }} />
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              fontSize: "0.5rem",
                              color: "text.secondary",
                              lineHeight: 1.1,
                            }}
                          >
                            {s.label}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {s.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <SectionTitle icon={AccessTime}>Duración</SectionTitle>
                <Stack spacing={1.25} sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                    >
                      Abrió
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                    >
                      {formatMXTime(registerDetailData.register.opened_at)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                    >
                      Cerró
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                    >
                      {registerDetailData.register.closed_at
                        ? formatMXTime(registerDetailData.register.closed_at)
                        : "—"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      pt: 1.25,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                    >
                      Duración
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "text.primary",
                      }}
                    >
                      {formatDuration(
                        registerDetailData.register.opened_at,
                        registerDetailData.register.closed_at,
                      )}
                    </Typography>
                  </Box>
                </Stack>

                <SectionTitle icon={Assessment}>
                  Resumen Financiero
                </SectionTitle>
                <Card
                  sx={{
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "none",
                    mb: 3,
                  }}
                >
                  <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      {[
                        {
                          label: "Apertura",
                          value: `$${(registerDetailData.register.opening_balance || 0).toFixed(2)}`,
                          icon: Store,
                          color: "#64748b",
                          neg: false,
                        },
                        {
                          label: "Efectivo",
                          value: `$${(registerDetailData.register.cash_sales || 0).toFixed(2)}`,
                          icon: AttachMoney,
                          color: "#059669",
                          neg: false,
                        },
                        {
                          label: "Tarjeta",
                          value: `$${(registerDetailData.register.card_sales || 0).toFixed(2)}`,
                          icon: CreditCard,
                          color: "#4f46e5",
                          neg: false,
                        },
                        {
                          label: "Transferencia",
                          value: `$${(registerDetailData.register.transfer_sales || 0).toFixed(2)}`,
                          icon: AccountBalance,
                          color: "#d97706",
                          neg: false,
                        },
                        {
                          label: "Gastos",
                          value: `-$${(registerDetailData.totalExpenses || 0).toFixed(2)}`,
                          icon: MoneyOff,
                          color: "#dc2626",
                          neg: true,
                        },
                      ].map((row) => (
                        <Box
                          key={row.label}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <row.icon sx={{ fontSize: 17, color: row.color }} />
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: "0.8rem",
                                color: row.neg ? "#dc2626" : "text.secondary",
                              }}
                            >
                              {row.label}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              color: row.neg ? "#dc2626" : "text.primary",
                            }}
                          >
                            {row.value}
                          </Typography>
                        </Box>
                      ))}
                      <Box
                        sx={{
                          pt: 1.5,
                          borderTop: "2px solid",
                          borderColor: "divider",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            color: "text.primary",
                          }}
                        >
                          Neto
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 800,
                            fontSize: "1.3rem",
                            color: "text.primary",
                          }}
                        >
                          $
                          {(
                            registerDetailData.totalSales -
                            (registerDetailData.totalExpenses || 0)
                          ).toFixed(2)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <SectionTitle icon={CheckCircle}>
                  Verificación de Cierre
                </SectionTitle>
                <Card
                  sx={{
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "none",
                  }}
                >
                  <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      {[
                        {
                          label: "Cierre Esperado",
                          value: `$${(registerDetailData.register.expected_close || 0).toFixed(2)}`,
                          icon: TrendingUp,
                          color: "#0d9488",
                        },
                        {
                          label: "Declarado",
                          value: `$${(registerDetailData.register.declared_close || 0).toFixed(2)}`,
                          icon: CheckCircle,
                          color: "#059669",
                        },
                        {
                          label: "Diferencia",
                          value: `$${(registerDetailData.register.difference || 0).toFixed(2)}`,
                          icon: Warning,
                          color: "#d97706",
                        },
                      ].map((row) => (
                        <Box
                          key={row.label}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <row.icon sx={{ fontSize: 17, color: row.color }} />
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: "0.8rem",
                                color: "text.secondary",
                              }}
                            >
                              {row.label}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                          >
                            {row.value}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,255,255,0.6)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <History sx={{ fontSize: 18, color: "primary.main" }} />
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      fontSize: "1rem",
                      color: "text.primary",
                    }}
                  >
                    Transacciones ({registerDetailData.saleCount})
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
                  <SectionTitle icon={Assessment}>
                    Ingresos / Egresos
                  </SectionTitle>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                      mb: 3,
                      maxHeight: { xs: 300, md: 400 },
                      bgcolor: isDark ? "rgba(15,23,42,0.4)" : "#ffffff",
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {["Hora", "ID", "Tipo", "Método", "Monto"].map(
                            (h, i) => (
                              <TableCell
                                key={h}
                                align={i === 4 ? "right" : "left"}
                                sx={{
                                  fontWeight: 700,
                                  color: "#f8fafc",
                                  bgcolor: "#0f172a",
                                  fontSize: "0.72rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  borderBottom: "2px solid",
                                  borderColor: "#1e293b",
                                }}
                              >
                                {h}
                              </TableCell>
                            ),
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          ...registerDetailData.sales.map((s) => ({
                            type: "sale",
                            id: `#V-${s.id}`,
                            time: s.created_at,
                            method: s.payment_method,
                            status: s.status,
                            methodLabel:
                              methodNames[s.payment_method] || s.payment_method,
                            amount: s.total,
                          })),
                          ...registerDetailData.expenses.map((e) => ({
                            type: "expense",
                            id: `#G-${e.id}`,
                            time: e.created_at,
                            method: null,
                            methodLabel: null,
                            desc: e.reason,
                            amount: -e.amount,
                          })),
                        ]
                          .sort((a, b) => new Date(b.time) - new Date(a.time))
                          .map((item, idx) => (
                            <TableRow
                              key={item.id}
                              hover
                              sx={{
                                bgcolor:
                                  item.type === "expense"
                                    ? isDark
                                      ? "rgba(239,68,68,0.06)"
                                      : "#fef2f2"
                                    : idx % 2 === 1
                                      ? isDark
                                        ? "rgba(255,255,255,0.03)"
                                        : "#f8fafc"
                                      : "inherit",
                                "&:hover": {
                                  bgcolor: isDark
                                    ? "rgba(59,130,246,0.12)"
                                    : "rgba(59,130,246,0.06)",
                                },
                              }}
                            >
                              <TableCell
                                sx={{
                                  fontSize: "0.8rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatMXTime(item.time)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 700,
                                  color: "primary.main",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {item.id}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    item.type === "sale"
                                      ? item.status === "cancelado"
                                        ? "Cancelado"
                                        : "Venta"
                                      : "Gasto"
                                  }
                                  size="small"
                                  variant="filled"
                                  sx={{
                                    fontSize: "0.62rem",
                                    fontWeight: 700,
                                    height: 22,
                                    bgcolor:
                                      item.type === "sale" &&
                                      item.status === "cancelado"
                                        ? isDark
                                          ? "rgba(239,68,68,0.18)"
                                          : "#fee2e2"
                                        : item.type === "sale"
                                          ? isDark
                                            ? "rgba(59,130,246,0.18)"
                                            : "#eef2ff"
                                        : isDark
                                          ? "rgba(239,68,68,0.18)"
                                          : "#fee2e2",
                                    color:
                                      item.type === "sale" &&
                                      item.status === "cancelado"
                                        ? "error.main"
                                        : item.type === "sale"
                                          ? isDark
                                            ? "#93c5fd"
                                            : "#4338ca"
                                          : "error.main",
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                {item.methodLabel ? (
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    {methodIcons[item.method]}
                                    <Typography
                                      variant="body2"
                                      sx={{ fontSize: "0.8rem" }}
                                    >
                                      {item.methodLabel}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    sx={{ fontSize: "0.72rem" }}
                                  >
                                    {item.desc}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  color:
                                    item.status === "cancelado"
                                      ? "text.secondary"
                                      : item.type === "sale"
                                        ? "text.primary"
                                        : "error.main",
                                  textDecoration:
                                    item.status === "cancelado"
                                      ? "line-through"
                                      : "none",
                                }}
                              >
                                {item.type === "sale" ? "+" : "-"}$
                                {Math.abs(item.amount).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        {registerDetailData.sales.length === 0 &&
                          registerDetailData.expenses.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} align="center">
                                <Typography
                                  variant="body2"
                                  color="textSecondary"
                                  sx={{ py: 2 }}
                                >
                                  Sin movimientos registrados
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <SectionTitle icon={ShoppingCart}>
                    Productos Vendidos
                  </SectionTitle>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ bgcolor: isDark ? "rgba(15,23,42,0.4)" : "#ffffff" }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {["Producto", "Cantidad", "Precio", "Subtotal"].map(
                            (h, i) => (
                              <TableCell
                                key={h}
                                align={i > 0 ? "right" : "left"}
                                sx={{
                                  fontWeight: 700,
                                  color: "#f8fafc",
                                  bgcolor: "#0f172a",
                                  fontSize: "0.72rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  borderBottom: "2px solid",
                                  borderColor: "#1e293b",
                                }}
                              >
                                {h}
                              </TableCell>
                            ),
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {registerDetailData.items.map((item, i) => (
                          <TableRow
                            key={i}
                            hover
                            sx={{
                              bgcolor:
                                i % 2 === 1
                                  ? isDark
                                    ? "rgba(255,255,255,0.03)"
                                    : "#f8fafc"
                                  : "inherit",
                            }}
                          >
                            <TableCell sx={{ fontSize: "0.8rem" }}>
                              {item.product_name || "Producto"}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontSize: "0.8rem" }}
                            >
                              {item.quantity}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontSize: "0.8rem" }}
                            >
                              ${item.price_at_sale.toFixed(2)}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 700, fontSize: "0.8rem" }}
                            >
                              ${(item.quantity * item.price_at_sale).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {registerDetailData.items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{ py: 2 }}
                              >
                                No hay productos registrados
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            </Box>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default EndOfDay;
