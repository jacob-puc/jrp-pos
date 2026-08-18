import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  useTheme,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Avatar,
} from "@mui/material";
import {
  History,
  X,
  Banknote,
  ShoppingCart,
  Receipt,
  TrendingUp,
  BarChart3,
  Clock,
  CreditCard,
  CircleOff,
  Store,
  TriangleAlert,
  CheckCircle2,
  Landmark,
  Eye,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ChartNoAxesCombined,
  Download,
} from "lucide-react";
import { CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import { formatMXTime, formatMXDate } from "../utils/dateUtils";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { useCashier } from "../contexts/CashierContext";
applyPlugin(jsPDF);

const RegisterHistory = () => {
  const { cashier } = useCashier();
  const [loading, setLoading] = useState(true);
  const [closedRegisters, setClosedRegisters] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [filterCashier, setFilterCashier] = useState("all");
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isAdmin = cashier?.role === "admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await window.api.invoke("get-closed-registers", {
      cashierId: cashier?.id,
      role: cashier?.role,
    });
    if (result.success) {
      setClosedRegisters(result.registers || []);
    } else {
      setError(result.error || "No se pudieron cargar los cierres");
    }
    if (isAdmin) {
      const cashiersResult = await window.api.invoke("get-cashiers");
      if (Array.isArray(cashiersResult)) setCashiers(cashiersResult);
    }
    setLoading(false);
  }, [cashier?.id, cashier?.role, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRegisters = useMemo(() => {
    if (filterCashier === "all") return closedRegisters;
    return closedRegisters.filter(
      (cr) =>
        String(cr.opened_by) === String(filterCashier) ||
        String(cr.closed_by) === String(filterCashier),
    );
  }, [closedRegisters, filterCashier]);

  const maxPage = Math.max(
    0,
    Math.ceil(filteredRegisters.length / rowsPerPage) - 1,
  );
  const safePage = Math.min(page, maxPage);
  const pagedRegisters = filteredRegisters.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage,
  );

  const handleViewRegisterDetail = async (registerId) => {
    setDetailLoading(true);
    setDetail(null);
    setDetailOpen(true);
    const result = await window.api.invoke(
      "get-register-sales-detail",
      registerId,
    );
    if (result.success) {
      setDetail(result);
    }
    setDetailLoading(false);
  };

  const [cancelSaleData, setCancelSaleData] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancelSale = async () => {
    if (!cancelSaleData) return;
    setCancelLoading(true);
    try {
      const result = await window.api.invoke("cancel-sale", {
        saleId: cancelSaleData.saleId,
        cashierName: cashier?.name,
        role: cashier?.role,
        cashierId: cashier?.id,
      });
      const saleId = cancelSaleData.saleId;
      setCancelSaleData(null);
      if (result.success) {
        await handleViewRegisterDetail(cancelSaleData.registerId);
      } else {
        setError(result.error || "No se pudo cancelar la venta");
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const [cancelExpenseData, setCancelExpenseData] = useState(null);
  const [cancelExpenseLoading, setCancelExpenseLoading] = useState(false);

  const handleCancelExpense = async () => {
    if (!cancelExpenseData) return;
    setCancelExpenseLoading(true);
    try {
      const result = await window.api.invoke("delete-cash-expense", {
        expenseId: cancelExpenseData.expenseId,
        cashierId: cashier?.id,
        role: cashier?.role,
      });
      const registerId = cancelExpenseData.registerId;
      setCancelExpenseData(null);
      if (result.success) {
        await handleViewRegisterDetail(registerId);
      } else {
        setError(result.error || "No se pudo cancelar el gasto");
      }
    } finally {
      setCancelExpenseLoading(false);
    }
  };

  const fmtMX = (n) =>
    Number(n || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const exportDetailPDF = async () => {
    if (!detail) return;
    const store =
      (await window.api.invoke("get-setting", "store_name")) || "MI TIENDA POS";
    const doc = new jsPDF();
    const r = detail.register;

    doc.setFontSize(16);
    doc.text(store, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Historial de Caja — ${registerName(r)}`, 14, 24);
    doc.text(
      `Responsable: ${r.opener_name || "—"}   Cerrado por: ${r.closer_name || "—"}`,
      14,
      30,
    );
    doc.text(
      `Abierta: ${formatMXDate(r.opened_at)} ${formatMXTime(r.opened_at)}   Cerrada: ${r.closed_at ? `${formatMXDate(r.closed_at)} ${formatMXTime(r.closed_at)}` : "—"}`,
      14,
      36,
    );
    doc.setTextColor(0);

    doc.autoTable({
      startY: 42,
      head: [["Resumen Financiero", "Monto"]],
      body: [
        ["Apertura", `$${fmtMX(r.opening_balance)}`],
        ["Efectivo", `$${fmtMX(r.cash_sales)}`],
        ["Tarjeta", `$${fmtMX(r.card_sales)}`],
        ["Transferencia", `$${fmtMX(r.transfer_sales)}`],
        ["Gastos", `-$${fmtMX(detail.totalExpenses)}`],
        ["Neto", `$${fmtMX(detail.totalSales - (detail.totalExpenses || 0))}`],
      ],
    });

    const txn = [
      ...detail.sales.map((s) => ({
        time: s.created_at,
        id: `#V-${s.id}`,
        type: s.status === "cancelado" ? "Cancelado" : "Venta",
        method: methodNames[s.payment_method] || s.payment_method,
        amount: s.status === "cancelado" ? 0 : s.total,
      })),
      ...detail.expenses.map((e) => ({
        time: e.created_at,
        id: `#G-${e.id}`,
        type: e.status === "cancelado" ? "Cancelado" : "Gasto",
        method: e.reason || "—",
        amount: e.status === "cancelado" ? 0 : -e.amount,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Hora", "ID", "Tipo", "Método", "Monto"]],
      body: txn.map((t) => [
        formatMXTime(t.time),
        t.id,
        t.type,
        t.method,
        `${t.amount >= 0 ? "+" : "-"}$${fmtMX(Math.abs(t.amount))}`,
      ]),
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
      body: detail.items.map((i) => [
        i.product_name || "Producto",
        String(i.quantity),
        `$${fmtMX(i.price_at_sale)}`,
        `$${fmtMX(i.quantity * i.price_at_sale)}`,
      ]),
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Verificación", "Valor"]],
      body: [
        ["Cierre Esperado", `$${fmtMX(r.expected_close)}`],
        ["Declarado", `$${fmtMX(r.declared_close)}`],
        ["Diferencia", `$${fmtMX(r.difference)}`],
      ],
    });

    const when = new Date(r.closed_at || r.opened_at);
    const suffix = Number.isNaN(when.getTime())
      ? "detalle"
      : when.toISOString().slice(0, 10);
    doc.save(`caja-${suffix}.pdf`);
  };

  const methodNames = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };
  const methodIcons = {
    cash: <Banknote size={17} color="#059669" />,
    card: <CreditCard size={17} color="#4f46e5" />,
    transfer: <Landmark size={17} color="#d97706" />,
  };
  const formatDuration = (start, end) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMs = Math.max(0, e - s);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const registerName = (cr) => {
    const n = cr.name;
    if (n && n !== "Cierre por cambio de turno" && !/^Cierre \d/.test(n)) {
      return n;
    }
    return cr.opener_name || `Cierre #${cr.id}`;
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
        borderRadius: "6px",
        bgcolor: isDark ? "rgba(255,255,255,0.06)" : "#e4e4e7",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Icon size={16} color={theme.palette.text.secondary} />
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

  const MoneyCell = ({ value, tone = "default" }) => {
    const colorMap = {
      default: theme.palette.text.primary,
      success: "#10b981",
      error: "#ef4444",
      warning: "#d97706",
    };
    return (
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: "0.85rem",
          color: colorMap[tone],
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${fmtMX(value)}
      </Typography>
    );
  };

  const SampleBadge = ({ tone, label }) => {
    const palette = {
      success: { bg: "#10b981", soft: "rgba(16,185,129,0.12)" },
      warning: { bg: "#f59e0b", soft: "rgba(245,158,11,0.14)" },
      error: { bg: "#ef4444", soft: "rgba(239,68,68,0.12)" },
      info: { bg: "#3b82f6", soft: "rgba(59,130,246,0.12)" },
    };
    const c = palette[tone];
    return (
      <Chip
        label={label}
        size="small"
        sx={{
          bgcolor: c.soft,
          color: c.bg,
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 24,
          borderRadius: "6px",
          border: `1px solid ${c.bg}33`,
          "& .MuiChip-label": { px: 1.2 },
        }}
      />
    );
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography
        variant="h2"
        sx={{ mb: 2, textAlign: "center", fontSize: "1.8rem" }}
      >
        Historial de Caja
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
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
            <CalendarDays size={18} />
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "America/Mexico_City",
            })}
          </Typography>
        </Box>
        {isAdmin && (
          <TextField
            select
            label="Filtrar por cajero"
            size="small"
            value={filterCashier}
            onChange={(e) => {
              setFilterCashier(e.target.value);
              setPage(0);
            }}
            sx={{
              minWidth: 200,
              "& .MuiOutlinedInput-root": {
                borderRadius: "2px",
                "& fieldset": { borderRadius: "2px" },
              },
            }}
          >
            <MenuItem value="all">Todos los cajeros</MenuItem>
            {cashiers.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.name} {c.role === "admin" ? "(Propietario)" : ""}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
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
              <History size={20} /> Cierres Anteriores
            </Typography>
            {filteredRegisters.length === 0 ? (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ textAlign: "center", py: 3 }}
              >
                No hay cierres de caja registrados
              </Typography>
            ) : (
              <>
                <TableContainer
                  sx={{
                    borderRadius: "10px",
                    border: "1px solid",
                    borderColor: isDark
                      ? "rgba(59,130,246,0.12)"
                      : "rgba(37,99,235,0.1)",
                    overflow: "hidden",
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Cajero</TableCell>
                        <TableCell align="right">Apertura</TableCell>
                        <TableCell align="right">Cierre</TableCell>
                        <TableCell align="right">Ajustes</TableCell>
                        <TableCell align="right">Ventas</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="center">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedRegisters.map((cr) => {
                        const diff = Number(cr.difference || 0);
                        const status = diff === 0
                          ? { tone: "success", label: "Completo" }
                          : { tone: "error", label: "Diferencia" };
                        return (
                          <TableRow key={cr.id} hover>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <CalendarDays size={14} color="#64748b" />
                                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                                  {formatMXDate(cr.closed_at)}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Avatar
                                  sx={{
                                    width: 26,
                                    height: 26,
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    bgcolor: "rgba(59,130,246,0.15)",
                                    color: "#3b82f6",
                                  }}
                                >
                                  {(cr.opener_name || "U").charAt(0)}
                                </Avatar>
                                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                                  {registerName(cr)}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <MoneyCell value={cr.opening_balance} />
                            </TableCell>
                            <TableCell align="right">
                              <MoneyCell value={cr.declared_close} />
                            </TableCell>
                            <TableCell align="right">
                              <MoneyCell value={cr.difference} tone={diff < 0 ? "error" : diff > 0 ? "warning" : "default"} />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>
                                {cr.sale_count || 0}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <SampleBadge tone={status.tone} label={status.label} />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Ver detalle">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleViewRegisterDetail(cr.id)}
                                >
                                  <Eye size={18} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={filteredRegisters.length}
                  page={safePage}
                  onPageChange={(e, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25]}
                  labelRowsPerPage="Filas por página"
                  sx={{
                    "& .MuiTablePagination-selectLabel": { mb: 0 },
                    "& .MuiTablePagination-displayedRows": { mb: 0 },
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            height: "min(920px, 92vh)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: isDark ? "#16181d" : "#f4f4f5",
          },
        }}
      >
        {detailLoading ? (
          <Box sx={{ p: 3 }}>
            <CardSkeleton count={4} />
          </Box>
        ) : detail ? (
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
                      borderRadius: "6px",
                      bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#e4e4e7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <History size={20} color={theme.palette.text.secondary} />
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
                    {registerName(detail.register)}
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
                    {detail.register.opener_name || "—"}
                  </span>
                  <Box component="span" sx={{ color: "#cbd5e1" }}>
                    |
                  </Box>
                  <span>
                    <strong>Cerrado por:</strong>{" "}
                    {detail.register.closer_name || "—"}
                  </span>
                  <Tooltip title="Exportar PDF">
                    <IconButton
                      size="small"
                      onClick={exportDetailPDF}
                      sx={{
                        border: "1px solid",
                        borderColor: "#9ca3af",
                        borderRadius: "4px",
                      }}
                    >
                      <Download size={17} />
                    </IconButton>
                  </Tooltip>
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setDetailOpen(false)}
                sx={{
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                }}
              >
                <X size={22} />
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
                      value: `${detail.totalSales.toFixed(2)}`,
                      icon: CircleDollarSign,
                      color: "#059669",
                    },
                    {
                      label: "Artículos",
                      value: detail.totalItems,
                      icon: ShoppingCart,
                      color: "#4f46e5",
                    },
                    {
                      label: "Operaciones",
                      value: detail.saleCount,
                      icon: Receipt,
                      color: "#0d9488",
                    },
                  ].map((s) => (
                    <Grid size={{ xs: 4 }} key={s.label}>
                      <Box
                        sx={{
                          p: 1.25,
                          borderRadius: "6px",
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
                          <s.icon size={15} color={s.color} />
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

                <SectionTitle icon={Clock3}>Duración</SectionTitle>
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
                      {formatMXTime(detail.register.opened_at)}
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
                      {detail.register.closed_at
                        ? formatMXTime(detail.register.closed_at)
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
                        detail.register.opened_at,
                        detail.register.closed_at,
                      )}
                    </Typography>
                  </Box>
                </Stack>

                <SectionTitle icon={ChartNoAxesCombined}>
                  Resumen Financiero
                </SectionTitle>
                <Card
                  sx={{
                    borderRadius: "12px",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    
                    mb: 3,
                  }}
                >
                  <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      {[
                        {
                          label: "Apertura",
                          value: `${(detail.register.opening_balance || 0).toFixed(2)}`,
                          icon: Store,
                          color: "#64748b",
                          neg: false,
                        },
                        {
                          label: "Efectivo",
                          value: `${(detail.register.cash_sales || 0).toFixed(2)}`,
                          icon: CircleDollarSign,
                          color: "#059669",
                          neg: false,
                        },
                        {
                          label: "Tarjeta",
                          value: `${(detail.register.card_sales || 0).toFixed(2)}`,
                          icon: CreditCard,
                          color: "#4f46e5",
                          neg: false,
                        },
                        {
                          label: "Transferencia",
                          value: `${(detail.register.transfer_sales || 0).toFixed(2)}`,
                          icon: Landmark,
                          color: "#d97706",
                          neg: false,
                        },
                        {
                          label: "Gastos",
                          value: `-${(detail.totalExpenses || 0).toFixed(2)}`,
                          icon: CircleDollarSign,
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
                            <row.icon size={17} color={row.color} />
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
                            detail.totalSales - (detail.totalExpenses || 0)
                          ).toFixed(2)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <SectionTitle icon={CheckCircle2}>
                  Verificación de Cierre
                </SectionTitle>
                <Card
                  sx={{
                    borderRadius: "12px",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    
                  }}
                >
                  <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      {[
                        {
                          label: "Cierre Esperado",
                          value: `${(detail.register.expected_close || 0).toFixed(2)}`,
                          icon: TrendingUp,
                          color: "#0d9488",
                        },
                        {
                          label: "Declarado",
                          value: `${(detail.register.declared_close || 0).toFixed(2)}`,
                          icon: CheckCircle2,
                          color: "#059669",
                        },
                        {
                          label: "Diferencia",
                          value: `${(detail.register.difference || 0).toFixed(2)}`,
                          icon: TriangleAlert,
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
                            <row.icon size={17} color={row.color} />
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
                  <History size={18} color={theme.palette.primary.main} />
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      fontSize: "1rem",
                      color: "text.primary",
                    }}
                  >
                    Transacciones ({detail.saleCount})
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
                  <SectionTitle icon={ChartNoAxesCombined}>
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
                          {[
                            "Hora",
                            "ID",
                            "Tipo",
                            "Método",
                            "Monto",
                            ...(isAdmin ? ["Acción"] : []),
                          ].map((h, i) => (
                            <TableCell
                              key={h}
                              align={
                                h === "Monto"
                                  ? "right"
                                  : h === "Acción"
                                    ? "center"
                                    : "left"
                              }
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
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          ...detail.sales.map((s) => ({
                            type: "sale",
                            saleId: s.id,
                            id: `#V-${s.id}`,
                            time: s.created_at,
                            method: s.payment_method,
                            status: s.status,
                            methodLabel:
                              methodNames[s.payment_method] || s.payment_method,
                            amount: s.total,
                          })),
                          ...detail.expenses.map((e) => ({
                            type: "expense",
                            expenseId: e.id,
                            id: `#G-${e.id}`,
                            time: e.created_at,
                            method: null,
                            methodLabel: null,
                            desc: e.reason,
                            status: e.status,
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
                                    item.status === "cancelado"
                                      ? "Cancelado"
                                      : item.type === "sale"
                                        ? "Venta"
                                        : "Gasto"
                                  }
                                  size="small"
                                  variant="filled"
                                  sx={{
                                    fontSize: "0.62rem",
                                    fontWeight: 700,
                                    height: 22,
                                    bgcolor:
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

                              {isAdmin && (
                                <TableCell align="center">
                                  {item.type === "sale" &&
                                    item.status !== "cancelado" && (
                                      <CancelButton
                                        size="small"
                                        sx={{
                                          px: 0.75,
                                          py: 0.1,
                                          minWidth: 0,
                                          fontSize: "0.68rem",
                                        }}
                                        onClick={() =>
                                          setCancelSaleData({
                                            saleId: item.saleId,
                                            registerId: detail.register.id,
                                          })
                                        }
                                      >
                                        Cancelar
                                      </CancelButton>
                                    )}

                                  {item.type === "expense" &&
                                    item.status !== "cancelado" && (
                                      <CancelButton
                                        size="small"
                                        sx={{
                                          px: 0.75,
                                          py: 0.1,
                                          minWidth: 0,
                                          fontSize: "0.68rem",
                                        }}
                                        onClick={() =>
                                          setCancelExpenseData({
                                            expenseId: item.expenseId,
                                            amount: Math.abs(item.amount),
                                            desc: item.desc,
                                            registerId: detail.register.id,
                                          })
                                        }
                                      >
                                        Cancelar
                                      </CancelButton>
                                    )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        {detail.sales.length === 0 &&
                          detail.expenses.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={isAdmin ? 6 : 5}
                                align="center"
                              >
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
                        {detail.items.map((item, i) => (
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
                        {detail.items.length === 0 && (
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
        ) : null}
      </Dialog>

      {/* CANCEL SALE */}
      <Dialog
        open={!!cancelSaleData}
        onClose={() => !cancelLoading && setCancelSaleData(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TriangleAlert size={22} color="#ef4444" />

            <Typography variant="h6" fontWeight={700}>
              Cancelar venta #{cancelSaleData?.saleId}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se revertirá el stock de los productos y esta venta dejará de
            contar en la caja. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            justifyContent: "space-between",
          }}
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
            {cancelLoading ? "Cancelando..." : "Sí, cancelar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL EXPENSE */}
      <Dialog
        open={!!cancelExpenseData}
        onClose={() => !cancelExpenseLoading && setCancelExpenseData(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TriangleAlert size={22} color="#ef4444" />

            <Typography variant="h6" fontWeight={700}>
              Cancelar gasto
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {cancelExpenseData?.desc ? (
              <>
                <strong>Motivo:</strong> {cancelExpenseData.desc}
                <br />
              </>
            ) : null}
            Se cancelará el gasto de ${cancelExpenseData?.amount?.toFixed(2)}.
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            justifyContent: "space-between",
          }}
        >
          <CancelButton
            onClick={() =>
              !cancelExpenseLoading && setCancelExpenseData(null)
            }
          >
            No
          </CancelButton>

          <Button
            variant="contained"
            color="error"
            disabled={cancelExpenseLoading}
            onClick={handleCancelExpense}
          >
            {cancelExpenseLoading ? "Cancelando..." : "Sí, cancelar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegisterHistory;
