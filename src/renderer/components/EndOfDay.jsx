import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
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
  ShoppingCart,
  Banknote,
  CreditCard,
  Landmark,
  Wallet,
  Store,
  Receipt,
  Activity,
  CalendarDays,
  CircleCheck,
  TriangleAlert,
  Download,
  Printer,
  TrendingUp,
  Lock,
  Search,
} from "lucide-react";

import { CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";

import { mxToday, formatMXDateTime, formatMXTime, toUTC } from "../utils/dateUtils";

import { useCashier } from "../contexts/CashierContext";

import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

const inputSx = {
  "& .MuiOutlinedInput-root.MuiOutlinedInput-root": {
    borderRadius: "4px",
    "& fieldset": {
      borderRadius: "4px",
    },
  },
  "& .MuiInputBase-input::placeholder": {
    fontSize: "0.85rem",
  },
};

const FieldLabel = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      display: "block",
      mb: 0.5,
      fontWeight: 600,
      color: "text.secondary",
    }}
  >
    {children}
  </Typography>
);

const EndOfDay = () => {
  const { cashier } = useCashier();

  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [sales, setSales] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [register, setRegister] = useState(null);
  const [prevRegister, setPrevRegister] = useState(null);

  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [closeRegisterModal, setCloseRegisterModal] = useState(false);

  const [openingBalance, setOpeningBalance] = useState("");
  const [declaredClose, setDeclaredClose] = useState("");
  const [expenses, setExpenses] = useState("");
  const [registerName, setRegisterName] = useState("");

  const [registerMessage, setRegisterMessage] = useState(null);

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");

  const [expensesList, setExpensesList] = useState([]);

  const [turnoFilter, setTurnoFilter] = useState("todos");
  const [selectedTurnoIdx, setSelectedTurnoIdx] = useState(-1);
  const turnoTableRef = React.useRef(null);

  const [cancelSaleData, setCancelSaleData] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [saleDetailData, setSaleDetailData] = useState(null);
  const [cancelItemData, setCancelItemData] = useState(null);
  const [cancelItemLoading, setCancelItemLoading] = useState(false);

  const [cancelExpenseData, setCancelExpenseData] = useState(null);
  const [cancelExpenseLoading, setCancelExpenseLoading] = useState(false);

  const [outsideSales, setOutsideSales] = useState([]);
  const [outsideDialogOpen, setOutsideDialogOpen] = useState(false);

  // ─── Recuperación tras corte de luz ─────────────────────────
  // Cajas 'open' de días anteriores + si el apagado fue sucio.
  const [pendingRegisters, setPendingRegisters] = useState([]);
  const [wasUnclean, setWasUnclean] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryTarget, setRecoveryTarget] = useState(null);
  const [recoveryDeclared, setRecoveryDeclared] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [turnoSearch, setTurnoSearch] = useState("");
  const turnoSearchRef = React.useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const regResult = await window.api.invoke("get-cash-register-status", {
        cashierId: cashier?.id,
        role: cashier?.role,
      });

      const reg = regResult.success ? regResult.register : null;
      setRegister(reg);

      const isOpenReg = reg?.status === "open";

      const [salesResult, outsideResult, prevResult, expResult, recResult] =
        await Promise.all([
          window.api.invoke("get-sales-for-today", {
            date: mxToday(),
            registerId: reg?.id || null,
          }),
          isOpenReg
            ? Promise.resolve({ success: true, sales: [] })
            : window.api.invoke("get-outside-register-sales"),
          isOpenReg
            ? Promise.resolve({ success: true, register: null })
            : window.api.invoke("get-previous-register-today"),
          isOpenReg
            ? window.api.invoke("get-cash-register-expenses", {
                cashierId: cashier?.id,
                role: cashier?.role,
              })
            : Promise.resolve({ success: true, expenses: [] }),
          window.api.invoke("get-recovery-info", {
            cashierId: cashier?.id,
            role: cashier?.role,
          }),
        ]);

      if (recResult && recResult.success) {
        const pend = recResult.pending || [];
        setPendingRegisters(pend);
        setWasUnclean(!!recResult.wasUncleanShutdown);
        // Si hay caja de otro día pendiente, pregunta al iniciar si se
        // quiere hacer el corte correspondiente a ese día/horario.
        if (pend.length > 0) {
          const first = pend[0];
          setRecoveryTarget(first);
          setRecoveryDeclared("");
          setRecoveryOpen(true);
        }
      }

      if (salesResult.success) {
        const fetchedSales = salesResult.sales || [];

        setSales(fetchedSales);

        const active = fetchedSales.filter(
          (sale) => sale.status !== "cancelado",
        );

        const total = active.reduce(
          (sum, sale) => sum + Number(sale.total || 0),
          0,
        );

        setTotalSales(total);
        setSalesCount(active.length);
      } else {
        // Antes esto fallaba en silencio: si el backend regresaba
        // success:false (p.ej. no encontró el registerId, error de query,
        // etc.) la pantalla se quedaba en $0.00 sin avisar nada.
        setSales([]);
        setTotalSales(0);
        setSalesCount(0);

        setRegisterMessage({
          type: "error",
          text:
            "No se pudieron cargar las ventas: " +
            (salesResult.error || "respuesta vacía del backend"),
        });
      }

      setOutsideSales(outsideResult.success ? outsideResult.sales || [] : []);

      setPrevRegister(prevResult.success ? prevResult.register : null);

      if (expResult.success) {
        setExpensesList(expResult.expenses || []);
      }
    } catch (error) {
      console.error("[EOD] Error loading data:", error);

      setRegisterMessage({
        type: "error",
        text: "No se pudo cargar la información de caja.",
      });
    } finally {
      setLoading(false);
    }
  }, [cashier?.id, cashier?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleSaleRegistered = () => fetchData();
    window.addEventListener("sale-registered", handleSaleRegistered);
    return () => window.removeEventListener("sale-registered", handleSaleRegistered);
  }, [fetchData]);

  const totalCash = useMemo(
    () =>
      sales
        .filter((s) => s.status !== "cancelado" && s.payment_method === "cash")
        .reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales],
  );

  const totalCard = useMemo(
    () =>
      sales
        .filter((s) => s.status !== "cancelado" && s.payment_method === "card")
        .reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales],
  );

  const totalTransfer = useMemo(
    () =>
      sales
        .filter(
          (s) => s.status !== "cancelado" && s.payment_method === "transfer",
        )
        .reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales],
  );

  const totalExpenses = useMemo(
    () =>
      expensesList.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0,
      ),
    [expensesList],
  );

  const isOpen = register?.status === "open";

  const isAdmin = cashier?.role === "admin";

  const canManageRegister = useMemo(() => {
    if (!isOpen || !register) return false;

    const openerIsAdmin = register.opener_role === "admin";

    const isOwn =
      String(register.opened_by) === String(cashier?.id) ||
      String(register.cashier_id) === String(cashier?.id);

    return isOwn || openerIsAdmin || cashier?.role === "admin";
  }, [isOpen, register, cashier?.id, cashier?.role]);

  // El "cierre esperado" es efectivo FÍSICO: apertura + ventas en EFECTIVO
  // (no todas las ventas, tarjeta/transferencia nunca entran al cajón) - gastos.
  const expectedClose = useMemo(() => {
    if (!register) return 0;

    return (
      Number(register.opening_balance || 0) +
      totalCash -
      Number(register.expenses || 0)
    );
  }, [register, totalCash]);

  const cashInRegister = useMemo(() => {
    if (!register) return 0;

    return (
      Number(register.opening_balance || 0) +
      totalCash -
      Number(register.expenses || 0)
    );
  }, [register, totalCash]);

  const handleOpenRegister = async () => {
    const result = await window.api.invoke("open-cash-register", {
      openingBalance: parseFloat(openingBalance) || 0,
      cashierId: cashier?.id,
      role: cashier?.role,
    });

    if (result.success) {
      setOpenRegisterModal(false);
      setOpeningBalance("");

      await fetchData();

      setRegisterMessage({
        type: "success",
        text: "Caja abierta exitosamente.",
      });
    } else {
      setRegisterMessage({
        type: "error",
        text: result.error,
      });
    }
  };

  const handleCloseRegister = async () => {
    const result = await window.api.invoke("close-cash-register", {
      declaredClose: parseFloat(declaredClose) || 0,

      expenses: 0,

      name:
        registerName.trim() ||
        register?.opener_name ||
        "Cierre sin nombre",

      cashierId: cashier?.id,
      role: cashier?.role,
    });

    if (result.success) {
      setCloseRegisterModal(false);
      setRegisterName("");
      setDeclaredClose("");
      setExpenses("");

      await fetchData();

      setRegisterMessage({
        type: "success",
        text:
          `Caja cerrada. Esperado: $${Number(result.expectedClose || 0).toFixed(
            2,
          )}, ` + `Diferencia: $${Number(result.difference || 0).toFixed(2)}`,
      });
    } else {
      setRegisterMessage({
        type: "error",
        text: result.error,
      });
    }
  };

  const handleRegisterExpense = async () => {
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) {
      setRegisterMessage({
        type: "error",
        text: "Ingresa un monto válido.",
      });
      return;
    }

    if (!withdrawReason.trim()) {
      setRegisterMessage({
        type: "error",
        text: "Ingresa el motivo del retiro.",
      });
      return;
    }

    setWithdrawLoading(true);

    try {
      const result = await window.api.invoke("register-cash-expense", {
        amount,
        reason: withdrawReason.trim(),
        cashierId: cashier?.id,
        role: cashier?.role,
      });

      if (result.success) {
        setWithdrawDialogOpen(false);
        setWithdrawAmount("");
        setWithdrawReason("");

        await fetchData();

        window.api
          .invoke("open-cash-drawer")
          .catch((error) => console.error("[DRAWER]", error));

        setRegisterMessage({
          type: "success",
          text:
            `Retiro de $${amount.toFixed(2)} registrado: ` +
            withdrawReason.trim(),
        });
      } else {
        setRegisterMessage({
          type: "error",
          text: result.error,
        });
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleCancelSale = async () => {
    if (!cancelSaleData) return;

    setCancelLoading(true);

    try {
      const result = await window.api.invoke("cancel-sale", {
        saleId: cancelSaleData.id,
        cashierName: cashier?.name,
        role: cashier?.role,
        cashierId: cashier?.id,
      });

      const saleId = cancelSaleData.id;

      setCancelSaleData(null);

      if (result.success) {
        await fetchData();

        setRegisterMessage({
          type: "success",
          text: `Venta #${saleId} cancelada. ` + "Se revirtió el stock.",
        });
      } else {
        setRegisterMessage({
          type: "error",
          text: result.error,
        });
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelSaleItem = async () => {
    if (!cancelItemData) return;

    setCancelItemLoading(true);

    try {
      const result = await window.api.invoke("cancel-sale-item", {
        saleId: cancelItemData.saleId,
        itemId: cancelItemData.itemId,
        cashierName: cashier?.name,
        role: cashier?.role,
        cashierId: cashier?.id,
      });

      const itemName = cancelItemData.itemName;

      setCancelItemData(null);

      if (result.success) {
        await fetchData();

        setRegisterMessage({
          type: "success",
          text: `Producto "${itemName}" cancelado. Se revirtió el stock.`,
        });
      } else {
        setRegisterMessage({
          type: "error",
          text: result.error,
        });
      }
    } finally {
      setCancelItemLoading(false);
    }
  };

  const handleCancelExpense = async () => {
    if (!cancelExpenseData) return;

    setCancelExpenseLoading(true);

    try {
      const result = await window.api.invoke("delete-cash-expense", {
        expenseId: cancelExpenseData.id,
        cashierId: cashier?.id,
        role: cashier?.role,
      });

      setCancelExpenseData(null);

      if (result.success) {
        await fetchData();

        setRegisterMessage({
          type: "success",
          text: "Gasto cancelado correctamente.",
        });
      } else {
        setRegisterMessage({
          type: "error",
          text: result.error,
        });
      }
    } finally {
      setCancelExpenseLoading(false);
    }
  };

  const handleRecoveryClose = async () => {
    if (!recoveryTarget) return;
    setRecoveryLoading(true);
    try {
      const result = await window.api.invoke("close-cash-register", {
        registerId: recoveryTarget.id,
        declaredClose: parseFloat(recoveryDeclared) || 0,
        expenses: 0,
        name:
          registerName.trim() ||
          recoveryTarget.opener_name ||
          `Corte recuperado ${recoveryTarget.date}`,
        cashierId: cashier?.id,
        role: cashier?.role,
        force: cashier?.role === "admin",
      });
      if (result.success) {
        const remaining = pendingRegisters.filter(
          (r) => r.id !== recoveryTarget.id,
        );
        setPendingRegisters(remaining);
        setRecoveryOpen(false);
        setRecoveryTarget(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length > 0) setRecoveryOpen(true);
        await fetchData();
        setRegisterMessage({
          type: "success",
          text:
            `Corte del ${recoveryTarget.date} recuperado. Esperado: $${Number(
              result.expectedClose || 0,
            ).toFixed(2)}, Diferencia: $${Number(result.difference || 0).toFixed(2)}. ` +
            "Todas las ventas quedaron guardadas en ese corte.",
        });
      } else {
        setRegisterMessage({ type: "error", text: result.error });
      }
    } finally {
      setRecoveryLoading(false);
    }
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
      timeZone: "America/Mexico_City",
    });

    const methodNames = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
    };

    const expensesHtml =
      expensesList.length > 0
        ? `
          <div class="section-title">
            Gastos / Egresos
          </div>

          <table>
            <tr>
              <th>#</th>
              <th>Hora</th>
              <th>Motivo</th>
              <th>Monto</th>
            </tr>

            ${expensesList
              .map(
                (expense, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${formatMXTime(expense.created_at)}</td>
                    <td>${expense.reason}</td>
                    <td align="right">
                      $${Number(expense.amount).toFixed(2)}
                    </td>
                  </tr>
                `,
              )
              .join("")}

            <tr class="total-row">
              <td colspan="3">
                TOTAL GASTOS
              </td>
              <td align="right">
                $${totalExpenses.toFixed(2)}
              </td>
            </tr>
          </table>
        `
        : "";

    const win = window.open("", "_blank");

    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte Diario</title>

        <style>
          body {
            font-family:
              'Segoe UI',
              Arial,
              sans-serif;

            margin: 30px 40px;
            color: #1e293b;
            font-size: 13px;
          }

          h1 {
            font-size: 22px;
            margin-bottom: 2px;
            letter-spacing: .5px;
          }

          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin-top: 0;
            margin-bottom: 20px;
          }

          hr {
            border: none;
            border-top: 2px solid #2563eb;
            margin: 15px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 12px;
          }

          th {
            background: #1e3a5f;
            color: white;
            padding: 8px 10px;
            text-align: left;
          }

          td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
          }

          tr:nth-child(even) {
            background: #f8fafc;
          }

          .total-row td {
            background: #1e3a5f;
            color: white;
            font-weight: 700;
          }

          .resumen-table td {
            padding: 5px 10px;
            border: none;
          }

          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #1e3a5f;
            margin: 18px 0 6px;
          }

          .footer {
            text-align: center;
            margin-top: 35px;
            color: #94a3b8;
            font-size: 11px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
          }

          .signature {
            display: flex;
            justify-content: space-around;
            margin-top: 40px;
          }

          .sig-box {
            text-align: center;
            width: 200px;
          }

          .sig-line {
            display: block;
            border-top: 2px solid #1e293b;
            margin-top: 40px;
            padding-top: 6px;
            font-size: 12px;
            color: #1e293b;
          }

          @media print {
            body {
              margin: .5in;
            }

            .no-print {
              display: none;
            }
          }
        </style>
      </head>

      <body>

        <h1>
          ${storeName.toUpperCase()}
        </h1>

        <p class="subtitle">
          Reporte Diario — ${today}
        </p>

        <hr>

        <div class="section-title">
          Ventas del Día
        </div>

        <table>
          <tr>
            <th>#</th>
            <th>Hora</th>
            <th>Método</th>
            <th>Total</th>
          </tr>

          ${sales
            .filter((sale) => sale.status !== "cancelado")
            .map(
              (sale, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${formatMXTime(sale.created_at)}</td>
                  <td>
                    ${methodNames[sale.payment_method] || sale.payment_method}
                  </td>
                  <td align="right">
                    $${Number(sale.total).toFixed(2)}
                  </td>
                </tr>
              `,
            )
            .join("")}

          <tr class="total-row">
            <td colspan="3">
              TOTAL VENTAS
            </td>

            <td align="right">
              $${totalSales.toFixed(2)}
            </td>
          </tr>
        </table>

        ${expensesHtml}

        <hr>

        <div class="section-title">
          Resumen Final
        </div>

        <table class="resumen-table">
          <tr>
            <td>Ventas Totales</td>
            <td align="right">
              $${totalSales.toFixed(2)}
            </td>
          </tr>

          <tr>
            <td>Total Gastos</td>
            <td align="right">
              -$${totalExpenses.toFixed(2)}
            </td>
          </tr>

          <tr>
            <td>
              <strong>
                GANANCIA DEL DÍA
              </strong>
            </td>

            <td align="right">
              <strong>
                $${(totalSales - totalExpenses).toFixed(2)}
              </strong>
            </td>
          </tr>
        </table>

        <div class="section-title">
          Desglose por método
        </div>

        <table class="resumen-table">
          <tr>
            <td>Efectivo</td>
            <td align="right">
              $${totalCash.toFixed(2)}
            </td>
          </tr>

          <tr>
            <td>Tarjeta</td>
            <td align="right">
              $${totalCard.toFixed(2)}
            </td>
          </tr>

          <tr>
            <td>Transferencia</td>
            <td align="right">
              $${totalTransfer.toFixed(2)}
            </td>
          </tr>
        </table>

        ${
          register
            ? `
              <div class="section-title">
                Control de Caja
              </div>

              <table class="resumen-table">
                <tr>
                  <td>Apertura</td>
                  <td align="right">
                    $${Number(register.opening_balance || 0).toFixed(2)}
                  </td>
                </tr>

                <tr>
                  <td>Efectivo en caja</td>
                  <td align="right">
                    $${cashInRegister.toFixed(2)}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>
                      Cierre esperado
                    </strong>
                  </td>

                  <td align="right">
                    <strong>
                      $${expectedClose.toFixed(2)}
                    </strong>
                  </td>
                </tr>
              </table>
            `
            : ""
        }

        <div class="signature">
          <div class="sig-box">
            <span class="sig-line">Cajero</span>
          </div>
          <div class="sig-box">
            <span class="sig-line">Supervisor</span>
          </div>
        </div>

        <div class="footer">
          Generado el
          ${formatMXDateTime(now)}
          — JRP POS
        </div>

      </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  const exportDailyPDF = async () => {
    const store = await window.api.invoke("get-setting", "store_name");

    const storeName = store || "MI TIENDA POS";

    const doc = new jsPDF();

    const pageW = doc.internal.pageSize.getWidth();

    const margin = 18;

    doc.setFontSize(18);
    doc.setFont(undefined, "bold");

    doc.text(storeName.toUpperCase(), margin, 22);

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");

    doc.text(
      `Reporte Diario — ${new Date().toLocaleDateString("es-MX")}`,
      margin,
      29,
    );

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);

    doc.line(margin, 33, pageW - margin, 33);

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30);

    doc.text("VENTAS DEL DÍA", margin, 44);

    const saleRows = sales
      .filter((sale) => sale.status !== "cancelado")
      .map((sale, index) => [
        index + 1,
        formatMXTime(sale.created_at),
        sale.payment_method === "cash"
          ? "Efectivo"
          : sale.payment_method === "card"
            ? "Tarjeta"
            : "Transferencia",
        `$${Number(sale.total).toFixed(2)}`,
      ]);

    doc.autoTable({
      head: [["#", "Hora", "Método", "Total"]],

      body: saleRows,

      startY: 48,

      margin: {
        left: margin,
        right: margin,
      },

      styles: {
        fontSize: 8,
        cellPadding: 2,
      },

      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
      },

      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },

      foot: [
        [
          {
            content: "TOTAL VENTAS",
            colSpan: 3,
            styles: {
              fontStyle: "bold",
              halign: "right",
            },
          },
          `$${totalSales.toFixed(2)}`,
        ],
      ],
    });

    let yy = doc.lastAutoTable.finalY + 8;

    if (expensesList.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");

      doc.text("GASTOS / EGRESOS", margin, yy);

      yy += 4;

      const expRows = expensesList.map((expense, index) => [
        index + 1,
        formatMXTime(expense.created_at),
        expense.reason,
        `$${Number(expense.amount).toFixed(2)}`,
      ]);

      doc.autoTable({
        head: [["#", "Hora", "Motivo", "Monto"]],

        body: expRows,

        startY: yy,

        margin: {
          left: margin,
          right: margin,
        },

        styles: {
          fontSize: 8,
          cellPadding: 2,
        },

        headStyles: {
          fillColor: [239, 68, 68],
          textColor: 255,
          fontStyle: "bold",
        },

        alternateRowStyles: {
          fillColor: [255, 245, 245],
        },

        foot: [
          [
            {
              content: "TOTAL GASTOS",
              colSpan: 3,
              styles: {
                fontStyle: "bold",
                halign: "right",
              },
            },
            `$${totalExpenses.toFixed(2)}`,
          ],
        ],
      });

      yy = doc.lastAutoTable.finalY + 8;
    }

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);

    doc.line(margin, yy, pageW - margin, yy);

    yy += 7;

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");

    doc.text("RESUMEN FINAL", margin, yy);

    yy += 8;

    const summaryRows = [
      ["Ventas Totales", `$${totalSales.toFixed(2)}`],
      ["Total Gastos", `-$${totalExpenses.toFixed(2)}`],
      ["GANANCIA DEL DÍA", `$${(totalSales - totalExpenses).toFixed(2)}`],
    ];

    if (register) {
      summaryRows.push(
        [
          "Apertura de caja",
          `$${Number(register.opening_balance || 0).toFixed(2)}`,
        ],
        ["Efectivo en caja", `$${cashInRegister.toFixed(2)}`],
        ["Cierre esperado", `$${expectedClose.toFixed(2)}`],
      );
    }

    doc.autoTable({
      body: summaryRows,

      startY: yy,

      margin: {
        left: margin + 10,
        right: margin + 10,
      },

      styles: {
        fontSize: 9,
        cellPadding: 2.5,
      },

      columnStyles: {
        0: {
          fontStyle: "bold",
          cellWidth: 80,
        },

        1: {
          fontStyle: "bold",
          halign: "right",
          cellWidth: 50,
        },
      },

      theme: "plain",
    });

    yy = doc.lastAutoTable.finalY + 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");

    doc.text("Desglose por método:", margin + 10, yy);

    yy += 6;

    [
      ["Efectivo", `$${totalCash.toFixed(2)}`],
      ["Tarjeta", `$${totalCard.toFixed(2)}`],
      ["Transferencia", `$${totalTransfer.toFixed(2)}`],
    ].forEach(([label, value]) => {
      doc.setFont(undefined, "normal");

      doc.text(label, margin + 16, yy);

      doc.setFont(undefined, "bold");

      doc.text(value, pageW - margin - 16, yy, {
        align: "right",
      });

      yy += 5;
    });

    yy += 8;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);

    doc.line(margin, yy, pageW - margin, yy);

    yy += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");

    doc.text("Cajero: ___________________", margin + 10, yy);

    doc.text("Supervisor: ___________________", pageW / 2 + 5, yy);

    yy += 14;

    doc.setFontSize(8);
    doc.setTextColor(150);

    doc.text(`Generado el ${new Date().toLocaleString("es-MX")}`, margin, yy);

    doc.setFont(undefined, "bold");

    doc.text("JRP POS", pageW - margin, yy, {
      align: "right",
    });

    doc.save(`reporte-diario-${mxToday()}.pdf`);
  };

  const dayItems = useMemo(
    () =>
      [
        ...sales.map((sale) => {
          const method =
            sale.payment_method === "cash"
              ? "Efectivo"
              : sale.payment_method === "card"
                ? "Tarjeta"
                : "Transferencia";

          const productsText = (sale.products || [])
            .map(
              (product) =>
                `${product.name}${product.qty > 1 ? ` x${product.qty}` : ""}`,
            )
            .join(", ");

          return {
            type: "sale",
            id: `sale-${sale.id}`,
            saleId: sale.id,
            status: sale.status,
            title: `Venta #${sale.id}`,
            desc: [method, productsText].filter(Boolean).join(" · "),
            time: sale.created_at,
            amount: Number(sale.total || 0),
            icon: ShoppingCart,
            items: sale.items || [],
          };
        }),

        ...expensesList.map((expense) => ({
          type: "expense",
          id: `expense-${expense.id}`,
          expenseId: expense.id,
          title: expense.reason?.startsWith("Compra")
            ? "Compra de inventario"
            : "Retiro de efectivo",
          desc: expense.reason,
          time: expense.created_at,
          amount: -Number(expense.amount || 0),
          icon: Wallet,
        })),
      ].sort((a, b) => new Date(toUTC(a.time)) - new Date(toUTC(b.time))),
    [sales, expensesList],
  );

  const filteredTurnoItems = useMemo(() => {
    const q = turnoSearch.trim().toLowerCase();
    let items = dayItems;
    if (turnoFilter !== "todos") {
      const target = turnoFilter === "ingresos" ? "sale" : "expense";
      items = items.filter((item) => item.type === target);
    }
    if (q) {
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q),
      );
    }
    return items;
  }, [dayItems, turnoFilter, turnoSearch]);

  useEffect(() => {
    setSelectedTurnoIdx(-1);
  }, [turnoFilter, turnoSearch, dayItems]);

  const turnoKeysRef = React.useRef({
    filteredTurnoItems: [],
    selectedTurnoIdx: -1,
    canManageRegister: false,
    anyDialogOpen: false,
  });
  turnoKeysRef.current = {
    filteredTurnoItems,
    selectedTurnoIdx,
    canManageRegister,
    anyDialogOpen:
      openRegisterModal ||
      closeRegisterModal ||
      withdrawDialogOpen ||
      outsideDialogOpen ||
      !!cancelSaleData ||
      !!cancelExpenseData,
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const {
        filteredTurnoItems,
        selectedTurnoIdx,
        canManageRegister,
        anyDialogOpen,
      } = turnoKeysRef.current;

      if (anyDialogOpen) return;

      const target = e.target;
      const tag = target?.tagName;
      const isFormField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const isSearchInput = target === turnoSearchRef.current;

      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isFormField
      ) {
        e.preventDefault();
        setTurnoSearch((prev) => prev + e.key);
        turnoSearchRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (isFormField && !isSearchInput) return;
        e.preventDefault();
        if (filteredTurnoItems.length === 0) return;
        setSelectedTurnoIdx((prev) => {
          const delta = e.key === "ArrowDown" ? 1 : -1;
          return prev === -1
            ? e.key === "ArrowDown"
              ? 0
              : filteredTurnoItems.length - 1
            : Math.min(
                filteredTurnoItems.length - 1,
                Math.max(0, prev + delta),
              );
        });
        return;
      }

      if (e.key === "Enter") {
        if (isFormField && !isSearchInput) return;
        if (!canManageRegister) return;
        const item =
          selectedTurnoIdx >= 0 ? filteredTurnoItems[selectedTurnoIdx] : null;
        if (!item) return;
        e.preventDefault();
        if (item.type === "sale" && item.status !== "cancelado") {
          setCancelSaleData({ id: item.saleId });
        } else if (item.type === "expense") {
          setCancelExpenseData({
            id: item.expenseId,
            amount: Math.abs(item.amount),
            reason: item.desc,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedTurnoIdx < 0 || !turnoTableRef.current) return;
    const row = turnoTableRef.current.querySelector(
      `[data-turno-idx="${selectedTurnoIdx}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedTurnoIdx]);

  const statusBanner = !register
    ? {
        bg: "rgba(217,119,6,.12)",
        color: "#d97706",
        icon: TriangleAlert,
        title: "Sin apertura de caja",
        subtitle: prevRegister
          ? `El corte anterior se cerró con $${Number(
              prevRegister.declared_close || 0,
            ).toFixed(2)}. Abre una caja para comenzar a vender.`
          : "Abre una caja para comenzar a vender.",
      }
    : isOpen
      ? {
          bg: "rgba(16,185,129,.12)",
          color: "#059669",
          icon: CircleCheck,
          title: "Caja abierta",
          subtitle:
            String(register.opened_by) === String(cashier?.id) ||
            String(register.cashier_id) === String(cashier?.id)
              ? `Abierta a las ${formatMXTime(register.opened_at)}`
              : `Abierta por: ${register.opener_name || "otro usuario"}`,
        }
      : {
          bg: "rgba(100,116,139,.12)",
          color: "#64748b",
          icon: Lock,
          title: "Caja cerrada",
          subtitle: prevRegister
            ? `El corte anterior se cerró con $${Number(
                prevRegister.declared_close || 0,
              ).toFixed(2)}. Abre una caja para comenzar a registrar ventas.`
            : "Abre una caja para comenzar a registrar ventas.",
        };

  const StatusIcon = statusBanner.icon;

  // Comparamos el efectivo declarado contra el efectivo que debería haber:
  // apertura + ventas en efectivo - egresos YA registrados en el sistema.
  // Si el esperado sale negativo, la declaración reduce la deuda en lugar
  // de sumarse encima (esperado + declarado).
  const baseExpected =
    Number(register?.opening_balance || 0) +
    totalCash -
    Number(register?.expenses || 0);
  const openCloseDifference =
    baseExpected >= 0
      ? (parseFloat(declaredClose) || 0) - baseExpected
      : baseExpected + (parseFloat(declaredClose) || 0);

  // ─── ACCIÓN PENDIENTE DESDE OTRA PANTALLA ───────────────────
  // Permite navegar a esta vista y abrir automáticamente el modal
  // de cerrar caja o de retiro de efectivo (seteado vía localStorage
  // desde otro componente antes de navegar aquí).
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
      setDeclaredClose("");
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
      const prefill = localStorage.getItem("eodWithdrawPrefill");
      if (prefill) {
        try {
          const parsed = JSON.parse(prefill);
          setWithdrawAmount(String(parsed.amount ?? ""));
          setWithdrawReason(parsed.reason || "");
        } catch {
          setWithdrawAmount("");
          setWithdrawReason("");
        }
        localStorage.removeItem("eodWithdrawPrefill");
      } else {
        setWithdrawAmount("");
        setWithdrawReason("");
      }
      setWithdrawDialogOpen(true);
    }
  }, [loading, canManageRegister]);

  return (
    <Box
      sx={{
        p: 1,
        animation: "fadeIn .4s ease-out",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: "1.8rem",
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            Caja
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mt: 0.5,
            }}
          >
            <CalendarDays size={15} />

            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "America/Mexico_City",
            })}

            {" · "}

            {new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Mexico_City",
            })}
          </Typography>
        </Box>
      </Box>

      {/* ALERT */}
      {registerMessage && (
        <Alert
          severity={registerMessage.type}
          sx={{ mb: 2 }}
          onClose={() => setRegisterMessage(null)}
        >
          {registerMessage.text}
        </Alert>
      )}

      {/* STATUS */}
      <Card
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
          mb: 2,
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            py: 1.75,
            px: 2.5,
            "&:last-child": {
              pb: 1.75,
            },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: statusBanner.bg,
                flexShrink: 0,
              }}
            >
              <StatusIcon size={23} color={statusBanner.color} />
            </Box>

            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {statusBanner.title}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 0.25,
                }}
              >
                {statusBanner.subtitle}
              </Typography>
            </Box>
          </Stack>

          {isOpen && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Exportar PDF">
                <IconButton
                  size="small"
                  onClick={exportDailyPDF}
                  sx={{
                    border: "1px solid",
                    borderColor: "#9ca3af",
                    borderRadius: "4px",
                  }}
                >
                  <Download size={17} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Imprimir reporte">
                <IconButton
                  size="small"
                  onClick={printDailyReport}
                  sx={{
                    border: "1px solid",
                    borderColor: "#9ca3af",
                    borderRadius: "4px",
                  }}
                >
                  <Printer size={17} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* TOP SUMMARY */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            {[
              {
                label: "Ventas totales",
                value: `$${totalSales.toFixed(2)}`,
                icon: Banknote,
                color: "#059669",
                bg: "rgba(16,185,129,.12)",
              },
              {
                label: "Transacciones",
                value: salesCount,
                icon: Receipt,
                color: "#0d9488",
                bg: "rgba(13,148,136,.12)",
              },
              {
                label: "Efectivo en caja",
                value: isOpen ? `$${cashInRegister.toFixed(2)}` : "$0.00",
                icon: Landmark,
                color: "#d97706",
                bg: "rgba(217,119,6,.12)",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.label}
                  sx={{
                    flex: 1,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                    borderRadius: "4px",
                  }}
                >
                  <CardContent
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      py: 1.5,
                      px: 2,
                      "&:last-child": {
                        pb: 1.5,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: item.bg,
                      }}
                    >
                      <Icon size={21} color={item.color} />
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: ".5px",
                          fontSize: ".6rem",
                        }}
                      >
                        {item.label}
                      </Typography>

                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          fontSize: "1.25rem",
                          lineHeight: 1.1,
                        }}
                      >
                        {item.value}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Fade>
      )}

      {/* SALES BREAKDOWN + CASH CONTROL */}
      {isOpen && register && (
        <Card
          sx={{
            mb: 3,
            borderRadius: "4px",
          }}
        >
          <CardContent
            sx={{
              py: 2.5,
              px: 3,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Landmark size={18} />
              Resumen de caja
            </Typography>

            <Grid container spacing={3}>
              {/* SALES */}
              <Grid
                size={{
                  xs: 12,
                  md: 6,
                }}
              >
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      bgcolor: isDark ? "rgba(255,255,255,.04)" : "#f4f4f5",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: ".07em",
                      }}
                    >
                      Desglose de ventas
                    </Typography>
                  </Box>

                  {/* Ventas Totales: suma de TODOS los métodos de pago.
                      No confundir con el efectivo físico en caja. */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1.2,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark ? "rgba(37,99,235,.08)" : "#eff6ff",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ShoppingCart size={17} color="#2563eb" />

                      <Typography variant="body2" fontWeight={700}>
                        Ventas Totales
                      </Typography>
                    </Stack>

                    <Typography
                      variant="body2"
                      fontWeight={800}
                      sx={{ color: "#2563eb" }}
                    >
                      ${totalSales.toFixed(2)}
                    </Typography>
                  </Box>

                  {[
                    {
                      label: "Efectivo",
                      value: totalCash,
                      icon: Banknote,
                      color: "#059669",
                    },
                    {
                      label: "Tarjeta",
                      value: totalCard,
                      icon: CreditCard,
                      color: "#4f46e5",
                    },
                    {
                      label: "Transferencia",
                      value: totalTransfer,
                      icon: Landmark,
                      color: "#d97706",
                    },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <Box
                        key={item.label}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          px: 1.5,
                          py: 1.2,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          "&:last-child": {
                            borderBottom: "none",
                          },
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={17} color={item.color} />

                          <Typography variant="body2">{item.label}</Typography>
                        </Stack>

                        <Typography variant="body2" fontWeight={700}>
                          ${item.value.toFixed(2)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Grid>

              {/* CASH CONTROL */}
              <Grid
                size={{
                  xs: 12,
                  md: 6,
                }}
              >
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      bgcolor: isDark ? "rgba(255,255,255,.04)" : "#f4f4f5",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: ".07em",
                      }}
                    >
                      Control de caja
                    </Typography>
                  </Box>

                  {[
                    [
                      "Apertura",
                      `$${Number(register.opening_balance || 0).toFixed(2)}`,
                    ],
                    ["Ventas en efectivo", `+$${totalCash.toFixed(2)}`],
                    [
                      "Gastos",
                      `-$${Number(register.expenses || 0).toFixed(2)}`,
                    ],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        px: 1.5,
                        py: 1.2,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {label}
                      </Typography>

                      <Typography variant="body2" fontWeight={700}>
                        {value}
                      </Typography>
                    </Box>
                  ))}

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      px: 1.5,
                      py: 1.5,
                      bgcolor: isDark ? "rgba(13,148,136,.08)" : "#f0fdfa",
                    }}
                  >
                    <Typography variant="body2" fontWeight={800}>
                      Cierre esperado
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        color: "#0d9488",
                      }}
                    >
                      ${expectedClose.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* ACTIONS */}
      <Stack
        direction="row"
        spacing={1}
        justifyContent={{
          xs: "center",
          sm: "flex-end",
        }}
        sx={{
          mb: 3,
          flexWrap: "wrap",
        }}
      >
        {!isOpen && (
          <Button
            variant="contained"
            startIcon={<Store size={17} />}
            onClick={() => {
              setOpeningBalance(
                prevRegister?.declared_close
                  ? String(prevRegister.declared_close)
                  : "",
              );

              setOpenRegisterModal(true);
            }}
            sx={{
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "none",
            }}
          >
            Abrir caja
          </Button>
        )}

        {canManageRegister && (
          <Button
            variant="outlined"
            startIcon={<Wallet size={17} />}
            onClick={() => {
              setWithdrawAmount("");
              setWithdrawReason("");
              setWithdrawDialogOpen(true);
            }}
            sx={{
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Retirar dinero
          </Button>
        )}

        {canManageRegister && (
          <Button
            variant="outlined"
            startIcon={<Wallet size={17} />}
            onClick={() => {
              setDeclaredClose("");
              setExpenses("");
              setRegisterName("");
              setCloseRegisterModal(true);
              window.api.invoke("open-cash-drawer").catch((e) => console.error("[DRAWER]", e));
            }}
            sx={{
              px: 3,
              fontSize: "0.9rem",
              border: "2px solid",
              borderColor: "warning.main",
              color: "warning.main",
              backgroundColor: "rgba(245,158,11,0.06)",
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "rgba(245,158,11,0.12)",
                borderColor: "warning.main",
              },
            }}
          >
            Cerrar caja
          </Button>
        )}
      </Stack>

      {/* MOVEMENTS */}
      {isOpen && register && (
        <Card
          sx={{
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1.5,
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Activity size={19} />
                Movimientos del turno
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Buscar producto..."
                  value={turnoSearch}
                  onChange={(e) => setTurnoSearch(e.target.value)}
                  inputRef={turnoSearchRef}
                  sx={{
                    minWidth: 200,
                    "& .MuiOutlinedInput-root": { borderRadius: "4px" },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  select
                  size="small"
                  value={turnoFilter}
                  onChange={(e) => setTurnoFilter(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{
                    minWidth: 150,
                    "& .MuiOutlinedInput-root": { borderRadius: "4px" },
                  }}
                >
                  <option value="todos">Todos</option>
                  <option value="ingresos">Ingresos</option>
                  <option value="egresos">Egresos</option>
                </TextField>

                <Typography variant="caption" color="text.secondary">
                  {filteredTurnoItems.length} movimientos
                </Typography>
              </Stack>
            </Box>

            {filteredTurnoItems.length === 0 ? (
              <Box
                sx={{
                  py: 5,
                  textAlign: "center",
                  color: "text.secondary",
                }}
              >
                <Activity size={28} strokeWidth={1.5} />

                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                  }}
                >
                  No hay movimientos registrados en este turno.
                </Typography>
              </Box>
            ) : (
              <TableContainer
                ref={turnoTableRef}
                component={Paper}
                variant="outlined"
                tabIndex={0}
                sx={{
                  borderRadius: "4px",
                  outline: "none",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Hora
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Concepto
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Tipo
                      </TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Monto
                      </TableCell>

                      {canManageRegister && (
                        <TableCell
                          align="center"
                          sx={{
                            fontWeight: 700,
                          }}
                        >
                          Acción
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredTurnoItems.map((item, idx) => {
                      return (
                        <TableRow
                          key={item.id}
                          hover
                          data-turno-idx={idx}
                          onClick={() => setSelectedTurnoIdx(idx)}
                          sx={{
                            cursor: "pointer",
                            backgroundColor:
                              selectedTurnoIdx === idx
                                ? isDark
                                  ? "rgba(59,130,246,0.15)"
                                  : "rgba(59,130,246,0.10)"
                                : undefined,
                            "&:hover": {
                              backgroundColor: isDark
                                ? "rgba(59,130,246,0.10)"
                                : "rgba(59,130,246,0.06)",
                            },
                          }}
                        >
                        <TableCell
                          sx={{
                            whiteSpace: "nowrap",
                            color: "text.secondary",
                            fontSize: ".8rem",
                          }}
                        >
                          {formatMXTime(item.time)}
                        </TableCell>

                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color:
                                  item.status === "cancelado"
                                    ? "text.secondary"
                                    : "text.primary",
                                textDecoration:
                                  item.status === "cancelado"
                                    ? "line-through"
                                    : "none",
                              }}
                            >
                              {item.title}
                            </Typography>
                          </Stack>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              maxWidth: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.desc}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={item.type === "sale" ? "INGRESO" : "EGRESO"}
                            size="small"
                            sx={{
                              fontSize: ".58rem",
                              fontWeight: 700,
                              height: 20,
                              bgcolor:
                                item.type === "sale"
                                  ? isDark
                                    ? "rgba(16,185,129,.15)"
                                    : "#ecfdf5"
                                  : isDark
                                    ? "rgba(239,68,68,.15)"
                                    : "#fef2f2",
                              color:
                                item.type === "sale" ? "#059669" : "#dc2626",
                              border: "1px solid",
                              borderColor:
                                item.type === "sale"
                                  ? "rgba(5,150,105,.25)"
                                  : "rgba(239,68,68,.25)",
                            }}
                          />
                        </TableCell>

                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            color:
                              item.status === "cancelado"
                                ? "text.secondary"
                                : item.type === "sale"
                                  ? "success.main"
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

                        {canManageRegister && (
                          <TableCell align="center">
                            {item.type === "sale" &&
                              item.status !== "cancelado" &&
                              (item.items?.length || 0) > 1 && (
                                <Tooltip title="Ver productos">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSaleDetailData({
                                        id: item.saleId,
                                        items: item.items || [],
                                        total: Number(item.amount || 0),
                                        method: item.desc.split(" · ")[0],
                                        time: item.time,
                                      });
                                    }}
                                    sx={{
                                      mr: 0.5,
                                      border: "1px solid",
                                      borderColor: "#64748b",
                                      color: "#64748b",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    <Receipt size={15} />
                                  </IconButton>
                                </Tooltip>
                              )}

                            {item.type === "sale" &&
                              item.status !== "cancelado" && (
                                <CancelButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelSaleData({
                                      id: item.saleId,
                                    });
                                  }}
                                >
                                  Cancelar
                                </CancelButton>
                              )}

                            {item.type === "expense" && (
                              <CancelButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelExpenseData({
                                    id: item.expenseId,
                                    amount: Math.abs(item.amount),
                                    reason: item.desc,
                                  });
                                }}
                              >
                                Cancelar
                              </CancelButton>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {!isOpen && outsideSales.length > 0 && (
        <Alert
          severity="info"
          sx={{ mt: 2 }}
          action={
            isAdmin ? (
              <Button size="small" onClick={() => setOutsideDialogOpen(true)}>
                Ver
              </Button>
            ) : undefined
          }
        >
          Hay {outsideSales.length} venta(s) registrada(s) fuera de caja.
        </Alert>
      )}

      {/* OPEN REGISTER */}
      <Dialog
        open={openRegisterModal}
        onClose={() => setOpenRegisterModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "6px",
            boxShadow: isDark
              ? "0 20px 50px rgba(0,0,0,.45)"
              : "0 15px 40px rgba(0,0,0,.12)",
          },
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleOpenRegister();
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(37,99,235,.12)",
              }}
            >
              <Store size={20} color="#2563eb" />
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
              }}
            >
              Abrir caja
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              fontSize: ".8rem",
            }}
          >
            Ingresa el monto inicial en efectivo para abrir la caja del día.
          </Typography>
        </DialogTitle>

        <Divider />

        <DialogContent
          sx={{
            px: 3,
            py: 2.5,
          }}
        >
          <Stack spacing={2}>
            <Box>
              <FieldLabel>Monto de apertura</FieldLabel>

              <TextField
                type="number"
                value={openingBalance}
                fullWidth
                autoFocus
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Banknote size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
                inputProps={{
                  min: 0,
                  step: 0.01,
                }}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            justifyContent: "space-between",
          }}
        >
          <Button
            onClick={() => setOpenRegisterModal(false)}
            sx={{
              color: "text.secondary",
              textTransform: "none",
            }}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleOpenRegister}
            variant="contained"
            color="success"
            startIcon={<CircleCheck size={18} />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "none",
            }}
          >
            Abrir caja
          </Button>
        </DialogActions>
      </Dialog>

      {/* CLOSE REGISTER */}
      <Dialog
        open={closeRegisterModal}
        onClose={() => setCloseRegisterModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "6px",
            boxShadow: isDark
              ? "0 20px 50px rgba(0,0,0,.45)"
              : "0 15px 40px rgba(0,0,0,.12)",
          },
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleCloseRegister();
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(245,158,11,.12)",
              }}
            >
              <Wallet size={20} color="#d97706" />
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
              }}
            >
              Cerrar caja
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              fontSize: ".8rem",
            }}
          >
            Ingresa el efectivo final y los gastos del día para realizar el
            cierre.
          </Typography>
        </DialogTitle>

        <Divider />

        <DialogContent
          sx={{
            px: 3,
            py: 2.5,
          }}
        >
          <Stack spacing={2}>
            <Box>
              <FieldLabel>Nombre de la caja</FieldLabel>

              <TextField
                value={registerName}
                fullWidth
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="Ej: Caja mañana..."
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Store size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box>
              <FieldLabel>Efectivo declarado</FieldLabel>

              <TextField
                type="number"
                value={declaredClose}
                fullWidth
                autoFocus
                onChange={(e) => setDeclaredClose(e.target.value)}
                placeholder="0.00"
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Banknote size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
                inputProps={{
                  min: 0,
                  step: 0.01,
                }}
              />
            </Box>

          </Stack>

          {/* CLOSE SUMMARY */}
          <Box
            sx={{
              mt: 2.5,
              p: 2,
              borderRadius: "4px",
              bgcolor: isDark ? "rgba(245,158,11,.07)" : "#fffbeb",
              border: "1px solid",
              borderColor: isDark
                ? "rgba(245,158,11,.25)"
                : "rgba(245,158,11,.3)",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mb: 1.5,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "text.secondary",
              }}
            >
              Resumen del cierre
            </Typography>

            <Stack spacing={0.75}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Cierre esperado
                </Typography>

                <Typography variant="body2" fontWeight={700}>
                  $
                  {(
                    Number(register?.opening_balance || 0) +
                    totalCash -
                    Number(register?.expenses || 0) -
                    (parseFloat(expenses) || 0)
                  ).toFixed(2)}
                </Typography>
              </Box>

              {baseExpected < 0 && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ display: "block", mt: -0.25 }}
                >
                  Los gastos/retiros superaron el efectivo disponible; el
                  esperado quedó negativo.
                </Typography>
              )}

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Efectivo declarado
                </Typography>

                <Typography variant="body2" fontWeight={700}>
                  ${(parseFloat(declaredClose) || 0).toFixed(2)}
                </Typography>
              </Box>

              <Divider
                sx={{
                  my: 1,
                }}
              />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    Diferencia
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    {openCloseDifference === 0
                      ? "Caja cuadrada"
                      : openCloseDifference > 0
                        ? "Sobrante de efectivo"
                        : "Faltante de efectivo"}
                  </Typography>
                </Box>

                <Typography
                  sx={{
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color:
                      openCloseDifference === 0
                        ? "success.main"
                        : openCloseDifference > 0
                          ? "info.main"
                          : "error.main",
                  }}
                >
                  {openCloseDifference > 0
                    ? "+"
                    : openCloseDifference < 0
                      ? "−"
                      : ""}
                  ${Math.abs(openCloseDifference).toFixed(2)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            justifyContent: "space-between",
          }}
        >
          <Button
            onClick={() => setCloseRegisterModal(false)}
            sx={{
              border: "1px solid rgba(100,116,139,.5)",
              color: "#64748b",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "rgba(100,116,139,0.08)",
                borderColor: "#64748b",
              },
            }}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleCloseRegister}
            variant="outlined"
            startIcon={<CircleCheck size={18} />}
            sx={{
              borderColor: "#d97706",
              color: "#d97706",
              backgroundColor: "rgba(245,158,11,0.08)",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": {
                backgroundColor: "rgba(245,158,11,0.14)",
                borderColor: "#d97706",
              },
            }}
          >
            Cerrar caja
          </Button>
        </DialogActions>
      </Dialog>

      {/* WITHDRAW */}
      <Dialog
        open={withdrawDialogOpen}
        onClose={() => !withdrawLoading && setWithdrawDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "6px",
            boxShadow: isDark
              ? "0 20px 50px rgba(0,0,0,.45)"
              : "0 15px 40px rgba(0,0,0,.12)",
          },
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) handleRegisterExpense();
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(239,68,68,.12)",
              }}
            >
              <Wallet size={20} color="#ef4444" />
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
              }}
            >
              Retirar dinero
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              fontSize: ".8rem",
            }}
          >
            Registra una salida de efectivo. Se agregará a los gastos del día.
          </Typography>
        </DialogTitle>

        <Divider />

        <DialogContent
          sx={{
            px: 3,
            py: 2.5,
          }}
        >
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: "6px", py: 0.75 }}>
            Aquí solo retiros por otras salidas.
          </Alert>
          <Stack spacing={2}>
            <Box>
              <FieldLabel>Motivo del retiro</FieldLabel>

              <TextField
                value={withdrawReason}
                fullWidth
                autoFocus
                disabled={withdrawLoading}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Ej: Pago a proveedor..."
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Receipt size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box>
              <FieldLabel>Monto a retirar</FieldLabel>

              <TextField
                type="number"
                value={withdrawAmount}
                fullWidth
                disabled={withdrawLoading}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Banknote size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
                inputProps={{
                  min: 0,
                  step: 0.01,
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "4px",
              }}
            >
              <Banknote size={15} color="#64748b" />

              <Typography variant="body2" color="text.secondary">
                Disponible en caja: <b>${cashInRegister.toFixed(2)}</b>
              </Typography>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            justifyContent: "space-between",
          }}
        >
          <Button
            onClick={() => setWithdrawDialogOpen(false)}
            disabled={withdrawLoading}
            sx={{
              border: "1px solid rgba(100,116,139,0.5)",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                backgroundColor: "rgba(100,116,139,0.08)",
                borderColor: "#64748b",
              },
            }}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleRegisterExpense}
            variant="outlined"
            disabled={withdrawLoading}
            startIcon={
              withdrawLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CircleCheck size={18} />
              )
            }
            sx={{
              borderColor: "#ef4444",
              color: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.08)",
              "&:hover": {
                backgroundColor: "rgba(239,68,68,0.14)",
                borderColor: "#ef4444",
              },
            }}
          >
            {withdrawLoading ? "Registrando..." : "Confirmar retiro"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* OUTSIDE SALES */}
      <Dialog
        open={outsideDialogOpen}
        onClose={() => setOutsideDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ShoppingCart size={22} color="#0d9488" />

            <Typography variant="h6" fontWeight={700}>
              Ventas fuera de caja
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Estas ventas se registraron sin una caja abierta (hoy o ayer).
            Solo el administrador puede cancelarlas y solo si son de hoy.
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Venta</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Método</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Monto
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Acción
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {outsideSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                        Sin ventas fuera de caja
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {outsideSales.map((sale) => {
                  const method =
                    sale.payment_method === "cash"
                      ? "Efectivo"
                      : sale.payment_method === "card"
                        ? "Tarjeta"
                        : "Transferencia";

                  const productsText = (sale.products || [])
                    .map(
                      (p) =>
                        `${p.name}${p.qty > 1 ? ` x${p.qty}` : ""}`,
                    )
                    .join(", ");

                  return (
                    <TableRow key={sale.id} hover>
                      <TableCell>{formatMXTime(sale.created_at)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          #{sale.id}
                        </Typography>
                        {productsText && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", maxWidth: 300 }}
                          >
                            {productsText}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{method}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ${Number(sale.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <CancelButton
                          size="small"
                          onClick={() =>
                            setCancelSaleData({ id: sale.id })
                          }
                        >
                          Cancelar
                        </CancelButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setOutsideDialogOpen(false)}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* RECOVERY: corte pendiente tras corte de luz */}
      <Dialog
        open={recoveryOpen && !!recoveryTarget}
        onClose={() => !recoveryLoading && setRecoveryOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TriangleAlert size={22} color="#d97706" />
            <Typography variant="h6" fontWeight={700}>
              Corte pendiente del {recoveryTarget?.date}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {wasUnclean
              ? "El sistema se apagó de forma inesperada (corte de luz). Se encontró una caja sin cerrar."
              : "Hay una caja abierta de un día anterior."}{" "}
            Todas sus ventas están guardadas. Realiza ahora el corte
            correspondiente al día/horario {recoveryTarget?.date} antes de
            abrir una caja nueva.
          </Alert>
          {recoveryTarget && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Apertura:{" "}
                <b>${Number(recoveryTarget.opening_balance || 0).toFixed(2)}</b>{" "}
                · Efectivo:{" "}
                <b>${Number(recoveryTarget.cash_sales || 0).toFixed(2)}</b> ·
                Tarjeta:{" "}
                <b>${Number(recoveryTarget.card_sales || 0).toFixed(2)}</b> ·
                Transferencia:{" "}
                <b>${Number(recoveryTarget.transfer_sales || 0).toFixed(2)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ventas: <b>{recoveryTarget.sale_count || 0}</b> · Gastos:{" "}
                <b>${Number(recoveryTarget.expenses || 0).toFixed(2)}</b> ·
                Esperado en caja:{" "}
                <b>
                  $
                  {Number(
                    recoveryTarget.expected_close_computed || 0,
                  ).toFixed(2)}
                </b>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Abierta: {formatMXDateTime(recoveryTarget.opened_at)} por{" "}
                {recoveryTarget.opener_name || "cajero"}
              </Typography>
            </Box>
          )}
          <FieldLabel>Efectivo contado para este corte</FieldLabel>
          <TextField
            type="number"
            fullWidth
            autoFocus
            value={recoveryDeclared}
            disabled={recoveryLoading}
            onChange={(e) => setRecoveryDeclared(e.target.value)}
            placeholder="0.00"
            sx={inputSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Banknote size={18} color="#64748b" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <Button
            onClick={() => setRecoveryOpen(false)}
            disabled={recoveryLoading}
            sx={{ textTransform: "none" }}
          >
            Hacerlo después
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={recoveryLoading}
            onClick={handleRecoveryClose}
            startIcon={
              recoveryLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CircleCheck size={18} />
              )
            }
          >
            {recoveryLoading
              ? "Cerrando..."
              : `Cerrar corte del ${recoveryTarget?.date}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL SALE */}
      <Dialog
        open={!!cancelSaleData}
        onClose={() => !cancelLoading && setCancelSaleData(null)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !cancelLoading) {
            e.preventDefault();
            handleCancelSale();
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TriangleAlert size={22} color="#ef4444" />

            <Typography variant="h6" fontWeight={700}>
              Cancelar venta #{cancelSaleData?.id}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se revertirá el stock de los productos y esta venta dejará de contar
            en la caja y en las ganancias. Esta acción no se puede deshacer.
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
            {cancelLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Sí, cancelar"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SALE DETAIL */}
      <Dialog
        open={!!saleDetailData}
        onClose={() => setSaleDetailData(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Receipt size={22} color={theme.palette.primary.main} />

            <Typography variant="h6" fontWeight={700}>
              Detalle de venta #{saleDetailData?.id}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          {saleDetailData && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {formatMXDateTime(saleDetailData.time)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {saleDetailData.method}
                </Typography>
              </Stack>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Cant
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Subtotal
                      </TableCell>
                      {canManageRegister && (
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          Acción
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saleDetailData.items.map((it) => {
                      const isItemCancelled = it.status === "cancelado";
                      return (
                        <TableRow key={it.id}>
                          <TableCell
                            sx={{
                              textDecoration: isItemCancelled
                                ? "line-through"
                                : "none",
                              color: isItemCancelled
                                ? "text.secondary"
                                : "text.primary",
                            }}
                          >
                            {it.product_name}
                          </TableCell>
                          <TableCell align="right">x{it.quantity}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            $
                            {(
                              Number(it.price_at_sale || 0) *
                              Number(it.quantity || 0)
                            ).toFixed(2)}
                          </TableCell>
                          {canManageRegister && (
                            <TableCell align="center">
                              {!isItemCancelled && (
                                <CancelButton
                                  size="small"
                                  sx={{
                                    py: 0.5,
                                    px: 1.5,
                                    fontSize: ".65rem",
                                    textTransform: "none",
                                    minWidth: 0,
                                  }}
                                  onClick={() =>
                                    setCancelItemData({
                                      saleId: saleDetailData.id,
                                      itemId: it.id,
                                      itemName: it.product_name,
                                    })
                                  }
                                >
                                  Cancelar
                                </CancelButton>
                              )}

                              {isItemCancelled && (
                                <Chip
                                  label="CANCELADO"
                                  size="small"
                                  sx={{
                                    fontSize: ".55rem",
                                    fontWeight: 700,
                                    height: 18,
                                    bgcolor: isDark
                                      ? "rgba(239,68,68,.15)"
                                      : "#fef2f2",
                                    color: "#dc2626",
                                    border: "1px solid",
                                    borderColor: "rgba(239,68,68,.25)",
                                  }}
                                />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {saleDetailData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ py: 3 }}
                          >
                            Sin productos en esta venta
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography
                variant="h6"
                sx={{
                  textAlign: "right",
                  mt: 2,
                  fontWeight: 700,
                  color: theme.palette.success.main,
                }}
              >
                Total: ${Number(saleDetailData.total || 0).toFixed(2)}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const id = saleDetailData.id;
              setSaleDetailData(null);
              setCancelSaleData({ id });
            }}
          >
            Cancelar toda la venta
          </Button>

          <Button variant="outlined" onClick={() => setSaleDetailData(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL SALE ITEM */}
      <Dialog
        open={!!cancelItemData}
        onClose={() => !cancelItemLoading && setCancelItemData(null)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !cancelItemLoading) {
            e.preventDefault();
            handleCancelSaleItem();
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TriangleAlert size={22} color="#ef4444" />

            <Typography variant="h6" fontWeight={700}>
              Cancelar producto
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se cancelará el producto{" "}
            <strong>{cancelItemData?.itemName}</strong> de la venta #
            {cancelItemData?.saleId}. Se revertirá su stock y se restará su
            importe del total de la venta. Esta acción no se puede deshacer.
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
            onClick={() => !cancelItemLoading && setCancelItemData(null)}
          >
            No
          </CancelButton>

          <Button
            variant="contained"
            color="error"
            disabled={cancelItemLoading}
            onClick={handleCancelSaleItem}
          >
            {cancelItemLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Sí, cancelar"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL EXPENSE */}
      <Dialog
        open={!!cancelExpenseData}
        onClose={() => !cancelExpenseLoading && setCancelExpenseData(null)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !cancelExpenseLoading) {
            e.preventDefault();
            handleCancelExpense();
          }
        }}
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
            Se quitará el gasto{" "}
            {cancelExpenseData?.reason ? (
              <strong>"{cancelExpenseData.reason}"</strong>
            ) : null}{" "}
            por ${Number(cancelExpenseData?.amount || 0).toFixed(2)} de la caja.
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
            onClick={() => !cancelExpenseLoading && setCancelExpenseData(null)}
          >
            No
          </CancelButton>

          <Button
            variant="contained"
            color="error"
            disabled={cancelExpenseLoading}
            onClick={handleCancelExpense}
          >
            {cancelExpenseLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Sí, cancelar"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EndOfDay;
