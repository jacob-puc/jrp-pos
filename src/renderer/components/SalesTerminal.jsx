import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { keyframes } from "@emotion/react";
import { createPortal } from "react-dom";
import { useCashier } from "../contexts/CashierContext";
import {
  Box,
  TextField,
  Typography,
  Paper,
  IconButton,
  Chip,
  Stack,
  Alert,
  Snackbar,
  Fade,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  ListItemButton,
  Button,
  Backdrop,
  CircularProgress,
  Skeleton,
  Divider,
  Card,
  useMediaQuery,
} from "@mui/material";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  CreditCard,
  Search,
  DollarSign,
  PlusCircle,
  QrCode,
  Landmark,
  Banknote,
  Store,
  Scale,
  Percent,
  Smartphone,
  TriangleAlert,
  Carrot,
  Package,
  Layers,
  Circle,
} from "lucide-react";
import { QrCodeScanner } from "@mui/icons-material";
import CancelButton from "./CancelButton";
import { useNavigate } from "react-router-dom";
import { isContainerUnit, unitLabels } from "../utils/unitLabels";

const scanMove = keyframes`
  0% { left: -30%; }
  50% { left: 100%; }
  100% { left: -30%; }
`;

const safeNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const fmtMoney = (v) => safeNum(v, 0).toFixed(2);
const fmtKg = (v) => safeNum(v, 0).toFixed(3);

const roundCash = (amount) => {
  const a = safeNum(amount, 0);
  const base = Math.floor(a);
  const cents = Math.round((a - base) * 100);
  if (cents <= 29) return base;
  if (cents <= 79) return base + 0.5;
  return base + 1;
};

const calcFinalPrice = (price, discount) => {
  const p = safeNum(price, 0);
  const d = safeNum(discount, 0);
  return p * (1 - d / 100);
};

const parseQtyPrefix = (str) => {
  const m = /^(\d+)\*(.+)$/.exec(String(str || ""));
  if (m) {
    const qty = parseInt(m[1], 10);
    return { qty: qty >= 1 ? qty : 1, rest: m[2].trim() };
  }
  return { qty: null, rest: String(str || "").trim() };
};

const inputSx = {
  "& .MuiOutlinedInput-root.MuiOutlinedInput-root": {
    borderRadius: "6px",
    "& fieldset": { borderRadius: "6px" },
  },
  "& .MuiInputBase-input::placeholder": { fontSize: "0.85rem" },
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

const PRESET_RECHARGES = [12, 22, 32, 52, 62, 100];

const lineKeyOf = (item) =>
  `${item?.id ?? "unknown"}:${item?.isWeightItem ? "w" : item?.isBoxItem ? "b" : item?.isPackItem ? "p" : "s"}`;

const packPriceOf = (p) => (p?.sale_unit === "boxpack" ? safeNum(p?.price) : safeNum(p?.pack_price));
const piecePriceOf = (p) => (p?.sale_unit === "boxpack" ? safeNum(p?.pack_price) : safeNum(p?.price));

const canManualDiscount = (i) =>
  !!i?.has_discount && safeNum(i?.discount_percent) <= 0 && !(i?.prices && Array.isArray(i.prices) && i.prices.length > 0);

const promoInfo = (it, qty) => {
  const nQty = safeNum(qty, 1);
  const baseUnit = calcFinalPrice(it?.price, it?.discount_percent);
  const baseTotal = baseUnit * nQty;
  if (
    !it ||
    it.isBoxItem ||
    it.isPackItem ||
    it.isWeightItem ||
    !it.prices ||
    !Array.isArray(it.prices) ||
    it.prices.length === 0
  ) {
    return { total: baseTotal, unit: baseUnit, applied: null };
  }
  let best = { total: baseTotal, unit: baseUnit, applied: null };
  for (const e of it.prices) {
    const eQty = parseInt(e?.qty, 10) || 0;
    const ePrice = safeNum(e?.price, 0);
    if (eQty <= 0 || ePrice <= 0) continue;
    let t;
    if (e.type === "mayoreo") {
      if (nQty < eQty) continue;
      t = nQty * ePrice;
    } else {
      if (nQty < eQty) continue;
      const combos = Math.floor(nQty / eQty);
      const rest = nQty % eQty;
      t = combos * ePrice + rest * baseUnit;
    }
    if (t < best.total - 1e-9) {
      best = { total: t, unit: nQty > 0 ? t / nQty : t, applied: e };
    }
  }
  return best;
};

const lineTotal = (it, qty) => {
  const nQty = safeNum(qty, 1);
  const discount = safeNum(it?.discount, 0);
  return Math.max(0, promoInfo(it, nQty).total - discount);
};

const lineUnitPrice = (it, qty) => {
  const nQty = safeNum(qty, 1);
  return nQty > 0 ? lineTotal(it, nQty) / nQty : 0;
};

const CartItem = React.memo(
  ({
    item,
    index,
    isSelected,
    onSelect,
    onQuantityChange,
    onRemove,
    onDiscount,
  }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const promo = promoInfo(item, item.quantity).applied;
    const fp = lineUnitPrice(item, item.quantity);
    const itemDiscount = safeNum(item.discount, 0);
    const itemPrice = safeNum(item.price, 0);
    const itemQty = safeNum(item.quantity, 1);

    return (
      <Paper
        elevation={0}
        onClick={() => onSelect(index)}
        sx={{
          mb: 1,
          p: 1.5,
          cursor: "pointer",
          background: isSelected
            ? isDark
              ? "rgba(59,130,246,0.15)"
              : "rgba(37,99,235,0.1)"
            : isDark
              ? "rgba(59,130,246,0.04)"
              : "rgba(37,99,235,0.03)",
          border: `1px solid ${isSelected ? theme.palette.primary.main : isDark ? "rgba(59,130,246,0.1)" : "rgba(37,99,235,0.08)"}`,
          borderRadius: "8px",
          transition: "all 0.15s ease",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: "0.95rem" }}
              >
                {item.name}
              </Typography>
              {item.isWeightItem && (
                <Chip
                  icon={<Carrot size={12} />}
                  label="kg"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    bgcolor: "rgba(59,130,246,0.12)",
                    color: theme.palette.primary.main,
                    fontWeight: 700,
                  }}
                />
              )}
              {item.isBoxItem && (
                <Chip
                  icon={<Package size={12} />}
                  label={unitLabels(item.sale_unit)?.badge || "caja"}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    bgcolor: "rgba(16,185,129,0.12)",
                    color: theme.palette.success.main,
                    fontWeight: 700,
                  }}
                />
              )}
              {item.isPackItem && (
                <Chip
                  icon={<Layers size={12} />}
                  label="paquete"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    bgcolor: "rgba(245,158,11,0.12)",
                    color: "#d97706",
                    fontWeight: 700,
                  }}
                />
              )}
              {!item.isWeightItem &&
                !item.isBoxItem &&
                !item.isPackItem &&
                (item.sale_unit === "boxpack" ||
                  item.sale_unit === "box" ||
                  item.sale_unit === "package") && (
                  <Chip
                    icon={<Circle size={12} />}
                    label="pieza"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      bgcolor: "rgba(100,116,139,0.12)",
                      color: theme.palette.text.secondary,
                      fontWeight: 700,
                    }}
                  />
                )}
              {safeNum(item.discount_percent) > 0 && (
                <Chip
                  label={`-${item.discount_percent}%`}
                  color="error"
                  size="small"
                  sx={{ ml: 0.5, height: 18, fontSize: "0.6rem" }}
                />
              )}
              {itemDiscount > 0 && (
                <Chip
                  label={`-$${fmtMoney(itemDiscount)}`}
                  color="error"
                  size="small"
                  sx={{ ml: 0.5, height: 18, fontSize: "0.6rem" }}
                />
              )}
              {promo && (
                <Chip
                  label={
                    promo.type === "mayoreo"
                      ? `Mayoreo desde ${promo.qty} pz`
                      : `Oferta ${promo.qty}×$${fmtMoney(promo.price)}`
                  }
                  color="secondary"
                  size="small"
                  sx={{ ml: 0.5, height: 18, fontSize: "0.6rem" }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ fontSize: "0.85rem" }}
            >
              {safeNum(item.discount_percent) > 0 || itemDiscount > 0 || promo ? (
                <>
                  <span style={{ textDecoration: "line-through" }}>
                    ${fmtMoney(itemPrice)}
                  </span>{" "}
                  ${fmtMoney(fp)}
                </>
              ) : (
                `$${fmtMoney(itemPrice)}`
              )}{" "}
              {item.isWeightItem
                ? "/ kg"
                : item.isBoxItem
                  ? (unitLabels(item.sale_unit)?.perSlash || "/ caja")
                  : item.isPackItem
                    ? "/ paquete"
                    : "c/u"}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.3}>
            <IconButton
              size="small"
              onClick={() => onQuantityChange(item, -1)}
              sx={{ width: 32, height: 32 }}
            >
              <Minus size={18} />
            </IconButton>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                minWidth: item.isWeightItem ? 52 : 30,
                textAlign: "center",
                fontSize: "1.05rem",
              }}
            >
              {item.isWeightItem
                ? `${fmtKg(itemQty)}`
                : itemQty}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onQuantityChange(item, 1)}
              sx={{ width: 32, height: 32 }}
            >
              <Plus size={18} />
            </IconButton>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              minWidth: 80,
              textAlign: "right",
              color: theme.palette.success.main,
              fontSize: "1.05rem",
            }}
          >
            ${fmtMoney(fp * itemQty)}
          </Typography>
          {canManualDiscount(item) && (
            <IconButton
              size="small"
              onClick={() => onDiscount(item)}
              sx={{
                width: 32,
                height: 32,
                color: itemDiscount > 0 ? "error.main" : "text.secondary",
                bgcolor:
                  itemDiscount > 0
                    ? "rgba(239,68,68,0.1)"
                    : "transparent",
              }}
              title="Descuento del producto"
            >
              <Percent size={20} />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => onRemove(item)}
            sx={{ color: "error.main", width: 32, height: 32 }}
          >
            <Trash2 size={20} />
          </IconButton>
        </Box>
      </Paper>
    );
  },
);

const SalesTerminal = () => {
  const { cashier } = useCashier();
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState("");
  // Caché del carrito en curso: si se va la luz a media venta, al volver
  // el sistema restaura lo que aún no se había cobrado.
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem("pos_pending_cart");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem("pos_pending_cart", JSON.stringify(cart));
      } else {
        localStorage.removeItem("pos_pending_cart");
      }
    } catch {}
  }, [cart]);
  const [total, setTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [registerWarn, setRegisterWarn] = useState(false);
  const lastRegisterWarnRef = useRef(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [change, setChange] = useState(0);
  const [waitingDrawer, setWaitingDrawer] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [manualProductModalOpen, setManualProductModalOpen] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: "", price: "" });
  const [pendingQty, setPendingQty] = useState(1);
  const [qtyDialogOpen, setQtyDialogOpen] = useState(false);
  const [qtyInput, setQtyInput] = useState("");
  const [recargaDialogOpen, setRecargaDialogOpen] = useState(false);
  const [recargaAmount, setRecargaAmount] = useState("");
  const [storeSettings, setStoreSettings] = useState({
    name: "MI TIENDA POS",
    website: "www.mitienda.com",
    logo: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimedOut, setSearchTimedOut] = useState(false);
  const [weightDialog, setWeightDialog] = useState({
    open: false,
    product: null,
  });
  const [weightAmount, setWeightAmount] = useState("");
  const [boxChoiceDialog, setBoxChoiceDialog] = useState({
    open: false,
    product: null,
    qty: 1,
  });
  const [discountDialog, setDiscountDialog] = useState({
    open: false,
    item: null,
  });
  const [discountValue, setDiscountValue] = useState("");
  const [printing, setPrinting] = useState(false);
  const searchTimeoutRef = useRef(null);
  const suggestionListRef = useRef(null);
  const cartRef = useRef(cart);
  const lastEscRef = useRef(0);
  const lastDiscountItemKeyRef = useRef(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
  const isXLargeScreen = useMediaQuery(theme.breakpoints.up("xl"));
  const isMediumScreen = useMediaQuery(theme.breakpoints.up("md"));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const DRAWER_WIDTH = isXLargeScreen ? 490 : isLargeScreen ? 430 : isMediumScreen ? 350 : isSmallScreen ? 270 : 310;
  const hasCart = cart.length > 0;
  const layoutRef = useRef(null);
  const [cartWidth, setCartWidth] = useState(() => {
    const saved = localStorage.getItem("cartWidth");
    return saved ? parseInt(saved, 10) : 0;
  });
  const effectiveCartWidth = cartWidth || DRAWER_WIDTH;
  useEffect(() => {
    if (cartWidth > 0) localStorage.setItem("cartWidth", String(cartWidth));
  }, [cartWidth]);
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = effectiveCartWidth;
    const onMove = (ev) => {
      const container = layoutRef.current;
      const maxW = container ? container.clientWidth * 0.55 : 900;
      const minW = 240;
      setCartWidth(Math.min(Math.max(startWidth + ev.clientX - startX, minW), maxW));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState(-1);
  const [focusZone, setFocusZone] = useState("search");
const processSaleRef = useRef(null);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce(
      (s, item) => s + item.price * (item.quantity || 1),
      0,
    );
    const total = cart.reduce(
      (s, item) => s + lineTotal(item, item.quantity || 1),
      0,
    );
    const discountTotal = Math.max(0, subtotal - total);

    return {
      subtotal,
      total,
      discountTotal
    };
  }, [cart]);

  const isCashPayment = paymentMethod === "cash";
  const displaySubtotal = isCashPayment
    ? roundCash(cartSummary.subtotal)
    : cartSummary.subtotal;
  const displayTotal = isCashPayment
    ? roundCash(cartSummary.total)
    : cartSummary.total;
  const displayDiscountTotal = displaySubtotal - displayTotal;

  const processSale = async (method) => {
    const registerOpen = await checkRegisterOpen();
    if (!registerOpen) {
      warnRegisterClosed();
      return;
    }
    const cartForSale = cart.map((it) => ({
      ...it,
      finalPrice: lineUnitPrice(it, it.quantity),
    }));
    const result = await window.api.invoke("record-sale", {
      cart: cartForSale,
      total: method === "cash" ? roundCash(cartSummary.total) : cartSummary.total,
      paymentMethod: method,
      discountTotal: cartSummary.discountTotal,
      cashierName: cashier?.name || "Usuario Principal",
    });
    if (result.success) {
      if (method === "cash") {
        setWaitingDrawer(true);
      } else {
        setCart([]);
        setPaymentMethod("");
        setCashDialogOpen(false);
        setCashAmount("");
        setChange(0);
        setBarcode("");
      }
      window.dispatchEvent(new CustomEvent("sale-registered"));
      showNotification("Venta registrada exitosamente", "success");
      try {
        const printEnabled = await window.api.invoke("get-setting", "print_enabled");
        if (printEnabled === "false") {
          window.api
            .invoke("open-cash-drawer")
            .catch((e) => console.error("[DRAWER]", e));
          return;
        }
        setPrinting(true);
        try {
          const text = generateReceiptHTML(method);
          const printResult = await window.api.invoke("print-receipt", text);
          if (printResult.success && (method === "card" || method === "transfer")) {
            const setting = await window.api.invoke("get-setting", "print_two_tickets");
            if (setting === "true") {
              await window.api.invoke("print-receipt", generateReceiptHTML(method));
            }
          }
          if (!printResult.success) {
            console.error("[PRINT]", printResult.error);
          }
        } catch (e) {
          console.error("[PRINT]", e);
        }
        setPrinting(false);
      } catch (e) {
        console.error("[PRINT]", e);
      }
    } else {
      showNotification(result.error || "Error al registrar la venta", "error");
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const name = await window.api.invoke("get-setting", "store_name");
        const website = await window.api.invoke("get-setting", "store_website");
        const logo = await window.api.invoke("get-setting", "store_logo");
        if (name)
          setStoreSettings((prev) => ({ ...prev, name: name.toUpperCase() }));
        if (website) setStoreSettings((prev) => ({ ...prev, website }));
        if (logo) setStoreSettings((prev) => ({ ...prev, logo }));
      } catch (e) {}
    };
    loadSettings();

    const handleSettingsUpdated = (event) => {
      const { storeName, storeLogo } = event.detail || {};
      if (storeName) setStoreSettings((prev) => ({ ...prev, name: storeName.toUpperCase() }));
      if (typeof storeLogo === "string") setStoreSettings((prev) => ({ ...prev, logo: storeLogo }));
    };
    window.addEventListener("storeSettingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("storeSettingsUpdated", handleSettingsUpdated);
  }, []);

  useEffect(() => {
    cartRef.current = cart;
    processSaleRef.current = processSale;
  }, [cart, processSale]);

  useEffect(() => {
    setSubtotal(cartSummary.subtotal);
    setTotal(cartSummary.total);
  }, [cart, cartSummary]);

  useEffect(() => {
    if (cart.length === 0) {
      setSelectedCartItemIndex(-1);
      setFocusZone("search");
    }
  }, [cart.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const barcodeInput = document.getElementById("barcode-input");
      const isBarcodeFocused = document.activeElement?.id === "barcode-input";
      const el = e.target;
      const isEditable =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.tagName === "SELECT" ||
        el?.isContentEditable;

      if (
        cashDialogOpen ||
        discountDialog.open ||
        boxChoiceDialog.open ||
        weightDialog.open ||
        manualProductModalOpen ||
        qtyDialogOpen ||
        recargaDialogOpen
      )
        return;

      if (!isBarcodeFocused && !isEditable && !e.ctrlKey && !e.metaKey) {
        if (e.key === "F5") {
          e.preventDefault();
          barcodeInput?.focus();
          return;
        }
        if (e.key.length === 1 && /[\w\d]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          barcodeInput?.focus();
          setBarcode((prev) => prev + e.key);
          return;
        }
      }

      if (e.key === "F8" && cartRef.current.length > 0) {
        e.preventDefault();
        if (paymentMethod === "cash") {
          setCashDialogOpen(true);
        } else if (paymentMethod) {
          processSaleRef.current(paymentMethod);
        } else {
          showNotification(
            "Seleccione un método de pago en el carrito",
            "warning",
          );
        }
      }
      if (e.key === "F4") {
        e.preventDefault();
        const lastItem = cartRef.current?.[cartRef.current.length - 1];
        if (lastItem && !lastItem.isWeightItem) {
          updateQuantity(lastItem, 1);
        }
      }
      if (e.key === "F3") {
        e.preventDefault();
        const lastItem = cartRef.current?.[cartRef.current.length - 1];
        if (lastItem && !lastItem.isWeightItem) {
          updateQuantity(lastItem, -1);
        }
      }
      if (e.key === "q" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById("barcode-input")?.focus();
        setFocusZone("search");
      }
      if (e.key === "r" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setRecargaDialogOpen(true);
      }
      if (e.key === "F2") {
        e.preventDefault();
        setManualProductModalOpen(true);
      }
      if (e.key === "F9") {
        e.preventDefault();
        setQtyInput(pendingQty === 1 ? "" : String(pendingQty));
        setQtyDialogOpen(true);
      }
      if (e.key === "F7") {
        e.preventDefault();
        const cart = cartRef.current;
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          removeFromCart(lastItem);
        }
      }
      if (e.key === "F6") {
        e.preventDefault();
        const eligible = cartRef.current.filter(canManualDiscount);
        if (eligible.length === 0) {
          showNotification(
            "No hay productos con descuento manual en el carrito",
            "info",
          );
          return;
        }
        const currentIdx = eligible.findIndex(
          (i) => lineKeyOf(i) === lastDiscountItemKeyRef.current,
        );
        const next = currentIdx === -1 ? 0 : (currentIdx + 1) % eligible.length;
        const target = eligible[next];
        lastDiscountItemKeyRef.current = lineKeyOf(target);
        setDiscountValue(
          target.discount > 0 ? String(target.discount.toFixed(2)) : "",
        );
        setDiscountDialog({ open: true, item: target });
      }
      if (e.key === "F11") {
        e.preventDefault();
        if (cartRef.current.length > 0) {
          showNotification(
            "Termina la venta actual antes de cerrar la caja",
            "warning",
          );
          return;
        }
        localStorage.setItem("eodPendingAction", "close-register");
        navigate("/end-of-day");
      }
      if (e.key === "F10") {
        e.preventDefault();
        localStorage.setItem("eodPendingAction", "withdraw");
        navigate("/end-of-day");
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (focusZone === "search" && cartRef.current.length > 0) {
          setFocusZone("cart");
          setSelectedCartItemIndex(0);
          document.getElementById("barcode-input")?.blur();
        } else if (focusZone === "cart" || focusZone === "payment") {
          setSelectedCartItemIndex(-1);
          setFocusZone("search");
          document.getElementById("barcode-input")?.focus();
        }
      }

      if (e.key === "Escape" && !isEditable) {
        if (focusZone === "cart" || focusZone === "payment") {
          e.preventDefault();
          setSelectedCartItemIndex(-1);
          setFocusZone("search");
          document.getElementById("barcode-input")?.focus();
        } else if (document.activeElement?.id !== "barcode-input") {
          e.preventDefault();
          const now = Date.now();
          if (now - lastEscRef.current < 400) {
            setCart([]);
            setPaymentMethod("");
            showNotification("Carrito limpiado", "success");
          }
          lastEscRef.current = now;
        }
      }

      if (focusZone === "cart" && cartRef.current.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (selectedCartItemIndex >= cartRef.current.length - 1) {
            setFocusZone("payment");
          } else {
            setSelectedCartItemIndex((prev) => prev + 1);
          }
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCartItemIndex((prev) =>
            prev > 0 ? prev - 1 : cartRef.current.length - 1,
          );
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const item = cartRef.current[selectedCartItemIndex];
          if (item && !item.isWeightItem) {
            updateQuantity(item, 1);
          }
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const item = cartRef.current[selectedCartItemIndex];
          if (item && !item.isWeightItem) {
            updateQuantity(item, -1);
          }
        }
        if (e.key === "Enter" && !isBarcodeFocused && paymentMethod) {
          e.preventDefault();
          if (paymentMethod === "cash") {
            setCashDialogOpen(true);
          } else {
            processSaleRef.current(paymentMethod);
          }
        }
      }

      if (focusZone === "payment") {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setFocusZone("cart");
          setSelectedCartItemIndex(cartRef.current.length - 1);
        }
if (e.key === "Tab" && !isEditable) {
          e.preventDefault();
          setFocusZone("search");
          document.getElementById("barcode-input")?.focus();
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setPaymentMethod((prev) =>
            prev === "cash" ? "card" : prev === "card" ? "transfer" : "cash",
          );
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setPaymentMethod((prev) =>
            prev === "cash" ? "transfer" : prev === "transfer" ? "card" : "cash",
          );
        }
        if (e.key === "Enter" && !isBarcodeFocused) {
          e.preventDefault();
          if (paymentMethod === "cash") {
            setCashDialogOpen(true);
          } else if (paymentMethod) {
            processSaleRef.current(paymentMethod);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    paymentMethod,
    navigate,
    focusZone,
    selectedCartItemIndex,
    cashDialogOpen,
    discountDialog.open,
    boxChoiceDialog.open,
    weightDialog.open,
    manualProductModalOpen,
    qtyDialogOpen,
    pendingQty,
  ]);

  useEffect(() => {
    if (!weightDialog.open || !weightDialog.product) return;
    let cancelled = false;

    const unsub = window.api.on("weight-update", (data) => {
      if (!cancelled && data.weight >= 0) {
        setWeightAmount(data.weight.toFixed(3));
      }
    });

    (async () => {
      try {
        const port = localStorage.getItem("scalePort");
        const baud = localStorage.getItem("scaleBaud") || "115200";
        if (!port) return;
        await window.api.invoke("start-weight-stream", port, parseInt(baud));
      } catch (e) {}
    })();

    return () => {
      cancelled = true;
      unsub();
      window.api.invoke("stop-weight-stream");
    };
  }, [weightDialog.open, weightDialog.product]);

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      const searchQuery = barcode.replace(/^\d+\*/g, "");
      const isNumeric = /^\d+$/.test(searchQuery);
      const minChars = isNumeric ? 5 : 3;
      if (searchQuery.length >= minChars) {
        setIsSearching(true);
        setSearchTimedOut(false);
        setShowSuggestions(false);
        searchTimeoutRef.current = setTimeout(() => {
          setIsSearching(false);
          setSearchTimedOut(true);
        }, 3000);
        try {
          const products = await window.api.invoke("search-products", searchQuery);
          clearTimeout(searchTimeoutRef.current);
          setSearchResults(products);
          setShowSuggestions(products.length > 0);
          setIsSearching(false);
        } catch (e) {
          clearTimeout(searchTimeoutRef.current);
          setSearchResults([]);
          setShowSuggestions(false);
          setIsSearching(false);
        }
      } else {
        clearTimeout(searchTimeoutRef.current);
        setSearchResults([]);
        setShowSuggestions(false);
        setIsSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(searchTimeoutRef.current);
    };
  }, [barcode]);

  useEffect(() => {
    if (selectedSuggestionIndex < 0) return;
    const el =
      suggestionListRef.current?.querySelectorAll("[data-suggestion-idx]")[
        selectedSuggestionIndex
      ];
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedSuggestionIndex, searchResults]);

  const showNotification = useCallback((message, severity = "info") => {
    setNotification({ open: true, message, severity });
  }, []);

  const checkRegisterOpen = async () => {
    try {
      const res = await window.api.invoke("get-cash-register-status", {
        cashierId: cashier?.id,
        role: cashier?.role,
      });
      return !!(res.success && res.register && res.register.status === "open");
    } catch {
      return false;
    }
  };

  const warnRegisterClosed = () => {
    const now = Date.now();
    if (now - lastRegisterWarnRef.current < 5000) return;
    lastRegisterWarnRef.current = now;
    setRegisterWarn(true);
  };

  const clearSearch = () => {
    setBarcode("");
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    refocusBarcode();
  };

  const committedStockInCart = (items, product) =>
    (items || [])
      .filter((it) => it && it.id === product?.id)
      .reduce((sum, it) => {
        const q = safeNum(it.quantity, 0);
        if (it.isWeightItem) return sum + q;
        if (it.isBoxItem) return sum + q * (parseInt(it.box_qty, 10) || 1);
        if (it.isPackItem) return sum + q * (parseInt(it.pack_qty, 10) || 1);
        return sum + q;
      }, 0);

  const committedStock = (product) => committedStockInCart(cart, product);

  const addProductToCart = useCallback((product, qtyOverride) => {
    if (!product) return;
    checkRegisterOpen().then((open) => {
      if (!open) warnRegisterClosed();
    });
    const qty = safeNum(qtyOverride ?? pendingQty, 1);
    if (product.sale_unit === "weight" && !product.isManual) {
      setPendingQty(1);
      setWeightAmount("");
      setWeightDialog({ open: true, product });
      return;
    }
    if (
      (isContainerUnit(product.sale_unit) || safeNum(product.pack_qty) > 0) &&
      !product.isManual
    ) {
      setPendingQty(1);
      setBoxChoiceDialog({ open: true, product, qty });
      return;
    }
    const effectivePrice = calcFinalPrice(
      product.price,
      product.discount_percent,
    );
    const productWithDiscount = {
      ...product,
      price: safeNum(product.price, 0),
      finalPrice: effectivePrice,
      prices: Array.isArray(product.prices) ? product.prices : [],
    };

    if (product.isManual) {
      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex(
          (item) => item.id === product.id || item.name === product.name,
        );
        if (existingIndex !== -1) {
          const updatedCart = [...prevCart];
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            quantity: safeNum(updatedCart[existingIndex].quantity, 0) + qty,
          };
          return updatedCart;
        }
        return [...prevCart, { ...productWithDiscount, quantity: qty }];
      });
      if (qty !== 1) setPendingQty(1);
      clearSearch();
      showNotification(`${product.name} agregado al carrito`, "success");
      return;
    }

    const prodStock = safeNum(product.stock, 0);
    if (prodStock <= 0) {
      showNotification("Producto sin stock", "error");
      refocusBarcode();
      return;
    }

    let addedSuccessfully = false;
    let stockError = false;

    setCart((prevCart) => {
      const currentCommitted = committedStockInCart(prevCart, product);
      if (prodStock - currentCommitted < 1) {
        stockError = true;
        return prevCart;
      }
      addedSuccessfully = true;
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex !== -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: safeNum(updatedCart[existingIndex].quantity, 0) + qty,
        };
        return updatedCart;
      }
      return [...prevCart, { ...productWithDiscount, quantity: qty }];
    });

    if (stockError) {
      showNotification("Stock insuficiente", "warning");
    } else if (addedSuccessfully) {
      if (qty !== 1) setPendingQty(1);
      showNotification(`${product.name} agregado al carrito`, "success");
    }
    clearSearch();
  }, [pendingQty, showNotification]);

  const confirmWeightProduct = () => {
    const { product } = weightDialog;
    if (!product) return;
    const kg = parseFloat(weightAmount) || 0;
    if (kg <= 0) return;
    const prodStock = safeNum(product.stock, 0);

    let stockError = false;
    let added = false;

    setCart((prevCart) => {
      const currentCommitted = committedStockInCart(prevCart, product);
      if (prodStock - currentCommitted < kg) {
        stockError = true;
        return prevCart;
      }
      added = true;
      const effectivePrice = calcFinalPrice(
        product.price,
        product.discount_percent,
      );
      const productWithWeight = {
        ...product,
        price: safeNum(product.price, 0),
        finalPrice: effectivePrice,
        quantity: kg,
        isWeightItem: true,
      };
      const existingIndex = prevCart.findIndex(
        (item) => item.id === product.id && item.isWeightItem,
      );
      if (existingIndex !== -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: safeNum(updatedCart[existingIndex].quantity, 0) + kg,
        };
        return updatedCart;
      }
      return [...prevCart, productWithWeight];
    });

    setWeightDialog({ open: false, product: null });
    setWeightAmount("");
    clearSearch();
    if (stockError) {
      showNotification("Stock insuficiente", "warning");
    } else if (added) {
      showNotification(
        `${kg.toFixed(3)} kg de ${product.name} agregado`,
        "success",
      );
    }
  };

  const confirmBoxChoice = (choice) => {
    const { product, qty = 1 } = boxChoiceDialog;
    if (!product) return;
    const isBox = choice === "box";
    const isPack = choice === "pack";
    const containerNoun =
      unitLabels(product.sale_unit)?.containerNoun || "Caja";
    const needPieces = isBox
      ? parseInt(product.box_qty, 10) || 1
      : isPack
        ? parseInt(product.pack_qty, 10) || 1
        : 1;
    const totalPieces = needPieces * qty;
    const prodStock = safeNum(product.stock, 0);

    let stockError = false;
    let added = false;

    setCart((prevCart) => {
      const currentCommitted = committedStockInCart(prevCart, product);
      if (prodStock - currentCommitted < totalPieces) {
        stockError = true;
        return prevCart;
      }
      added = true;
      const unitPrice = isBox
        ? safeNum(product.box_price)
        : isPack
          ? packPriceOf(product)
          : piecePriceOf(product);
      const effectivePrice = calcFinalPrice(unitPrice, product.discount_percent);
      const item = {
        ...product,
        finalPrice: effectivePrice,
        quantity: qty,
        isBoxItem: isBox,
        isPackItem: isPack,
        price: unitPrice,
        prices: Array.isArray(product.prices) ? product.prices : [],
      };
      const existingIndex = prevCart.findIndex(
        (i) =>
          i.id === product.id &&
          i.isBoxItem === isBox &&
          i.isPackItem === isPack,
      );
      if (existingIndex !== -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: safeNum(updated[existingIndex].quantity, 0) + qty,
        };
        return updated;
      }
      return [...prevCart, item];
    });

    setBoxChoiceDialog({ open: false, product: null });
    clearSearch();
    if (stockError) {
      showNotification("Stock insuficiente", "warning");
    } else if (added) {
      showNotification(
        `${isBox ? containerNoun : isPack ? "Paquete" : "Pieza"} de ${product.name} agregado`,
        "success",
      );
    }
  };

  const handleBarcodeSubmit = async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const rawValue = event.target?.value ?? barcode;
      const trimmedValue = String(rawValue || "").trim();

      // Immediately clear barcode state & input DOM to avoid corrupting subsequent scanner strokes
      setBarcode("");
      if (event.target) event.target.value = "";
      clearTimeout(searchTimeoutRef.current);
      setShowSuggestions(false);
      const prevSuggestionIdx = selectedSuggestionIndex;
      setSelectedSuggestionIndex(-1);

      if (!trimmedValue) return;

      const { qty, rest } = parseQtyPrefix(trimmedValue);
      if (rest === "") {
        showNotification("Producto no encontrado", "error");
        return;
      }

      if (
        prevSuggestionIdx >= 0 &&
        searchResults[prevSuggestionIdx]
      ) {
        addProductToCart(searchResults[prevSuggestionIdx], qty ?? undefined);
        return;
      }

      try {
        const res = await window.api.invoke("get-product-by-barcode", rest);
        if (res && res.success && res.product) {
          addProductToCart(res.product, qty ?? undefined);
        } else {
          // Fallback: search by query if not exact barcode match
          const searchList = await window.api.invoke("search-products", rest);
          if (Array.isArray(searchList) && searchList.length > 0) {
            addProductToCart(searchList[0], qty ?? undefined);
          } else {
            showNotification("Producto no encontrado", "error");
          }
        }
      } catch (err) {
        console.error("Error searching barcode:", err);
        showNotification("Error al buscar producto", "error");
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (showSuggestions && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0,
        );
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (showSuggestions && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1,
        );
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleManualProduct = () => {
    if (manualProduct.name && manualProduct.price) {
      const newProduct = {
        id: `manual-${Date.now()}`,
        name: manualProduct.name,
        price: parseFloat(manualProduct.price),
        finalPrice: parseFloat(manualProduct.price),
        discount_percent: 0,
        has_discount: 0,
        barcode: "SIN CÓDIGO",
        stock: 999,
        isManual: true,
      };
      addProductToCart(newProduct);
      setManualProduct({ name: "", price: "" });
      setManualProductModalOpen(false);
      refocusBarcode();
    }
  };

  const refocusBarcode = () => {
    setTimeout(() => {
      document.getElementById("barcode-input")?.focus();
    }, 150);
  };

  const confirmRecharge = () => {
    const amount = parseFloat(recargaAmount);
    if (!amount || amount <= 0) {
      showNotification("Ingresa un monto válido", "warning");
      return;
    }
    const item = {
      id: `recarga-${amount}`,
      name: `Recarga $${amount}`,
      price: amount,
      finalPrice: amount,
      quantity: 1,
      discount_percent: 0,
      has_discount: 0,
      barcode: `RECARGA-${amount}`,
      stock: 999,
      isManual: true,
    };
    setCart((prev) => [...prev, item]);
    setRecargaDialogOpen(false);
    setRecargaAmount("");
    refocusBarcode();
    showNotification(`Recarga $${amount} agregada al carrito`, "success");
  };

  const updateQuantity = useCallback((item, delta) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (
            it.id !== item.id ||
            it.isBoxItem !== item.isBoxItem ||
            it.isPackItem !== item.isPackItem
          )
            return it;
          const step = it.isWeightItem ? 0.1 : 1;
          const newQty = it.quantity + delta * step;
          if (newQty <= 0) return null;
          const qty = Math.min(newQty, it.stock || 999);
          const disc = it.discount || 0;
          const fp =
            disc > 0 && qty > 0
              ? (it.price * qty - disc) / qty
              : it.finalPrice;
          return { ...it, quantity: qty, finalPrice: fp };
        })
        .filter(Boolean),
    );
  }, []);

  const removeFromCart = useCallback(
    (item) => {
      setCart((prev) =>
        prev.filter(
          (it) =>
            it.id !== item.id ||
            it.isBoxItem !== item.isBoxItem ||
            it.isPackItem !== item.isPackItem,
        ),
      );
      showNotification("Producto eliminado del carrito", "info");
    },
    [showNotification],
  );

  const applyDiscount = (item, amount) => {
    setCart((prev) =>
      prev.map((it) => {
        if (lineKeyOf(it) !== lineKeyOf(item)) return it;
        const qty = it.quantity || 1;
        const max = it.price * qty;
        const discount = Math.min(Math.max(parseFloat(amount) || 0, 0), max);
        const fp = discount > 0 ? (it.price * qty - discount) / qty : it.price;
        return { ...it, discount, finalPrice: fp };
      }),
    );
  };

  const clearDiscount = (item) => {
    setCart((prev) =>
      prev.map((it) => {
        if (lineKeyOf(it) !== lineKeyOf(item)) return it;
        const fp =
          it.discount_percent > 0
            ? calcFinalPrice(it.price, it.discount_percent)
            : it.price;
        return { ...it, discount: 0, finalPrice: fp };
      }),
    );
  };

  const openDiscountDialog = useCallback((item) => {
    lastDiscountItemKeyRef.current = lineKeyOf(item);
    setDiscountValue(item.discount > 0 ? String(item.discount.toFixed(2)) : "");
    setDiscountDialog({ open: true, item });
  }, []);

  const onSelectItem = useCallback((i) => {
    setSelectedCartItemIndex(i);
    setFocusZone("cart");
  }, []);

  const handleDiscountApply = () => {
    const item = discountDialog.item;
    if (!item) return;
    const amount = parseFloat(discountValue);
    const max = item.price * item.quantity;
    if (isNaN(amount) || amount <= 0 || amount > max) return;
    applyDiscount(item, discountValue);
    setDiscountDialog({ open: false, item: null });
  };

  const handlePayClick = (method) => {
    setPaymentMethod(method === paymentMethod ? "" : method);
  };

  const handleCashConfirm = () => {
    processSale("cash");
  };

  const handleDrawerDone = () => {
    setWaitingDrawer(false);
    setCashDialogOpen(false);
    setCart([]);
    setPaymentMethod("");
    setCashAmount("");
    setChange(0);
    setBarcode("");
    refocusBarcode();
  };

  const generateReceiptHTML = (method) => {
    const now = new Date();
    const ticketNum = Date.now().toString().slice(-6);
    const lines = [];

    if (storeSettings.logo) {
      lines.push(
        `<div style="text-align:center;margin-bottom:4px"><img src="${storeSettings.logo}" style="height:100px;max-width:48mm;object-fit:contain"/></div>`,
      );
    }
    lines.push(
      `<div style="text-align:center;font-weight:bold;font-size:15px">${storeSettings.name}</div>`,
    );
    lines.push(
      `<div style="text-align:center;font-size:11px">Sistema de Punto de Venta</div>`,
    );
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="text-align:center;font-size:10px">${now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Mexico_City" })}<br>${now.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })}</div>`,
    );
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="font-size:11px;display:flex;justify-content:space-between"><span>Cajero:</span><span>${cashier?.name || "Usuario Principal"}</span></div>`,
    );
    lines.push(
      `<div style="font-size:11px;display:flex;justify-content:space-between"><span>Ticket #:</span><span>${ticketNum}</span></div>`,
    );
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="text-align:center;font-weight:bold;font-size:12px">DETALLE DE COMPRA</div>`,
    );
    lines.push(`<div class="sep"></div>`);

    cart.forEach((item) => {
      const promo = promoInfo(item, item.quantity).applied;
      const fp = lineUnitPrice(item, item.quantity);
      const lt = lineTotal(item, item.quantity);
      const unit = item.isWeightItem
        ? "kg"
        : item.isBoxItem
          ? unitLabels(item.sale_unit)?.short || "cj"
          : item.isPackItem
            ? "pq"
            : "pza";
      const qtyDisplay = item.isWeightItem
        ? fmtKg(item.quantity)
        : item.quantity;
      const name =
        item.name.length > 24 ? item.name.substring(0, 22) + ".." : item.name;
      lines.push(`<div style="font-weight:bold;font-size:12px">${name}</div>`);
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:10px"><span>${qtyDisplay} ${unit} x $${fmtMoney(fp)}</span><span>$${fmtMoney(lt)}</span></div>`,
      );
      if (promo)
        lines.push(
          `<div style="text-align:center;font-size:10px;color:purple">${
            promo.type === "mayoreo"
              ? `Mayoreo desde ${promo.qty} pz`
              : `Oferta ${promo.qty} x $${fmtMoney(promo.price)}`
          }</div>`,
        );
      if (safeNum(item.discount_percent) > 0)
        lines.push(
          `<div style="text-align:center;font-size:10px;color:red">Descuento: -${item.discount_percent}%</div>`,
        );
      if (safeNum(item.discount) > 0)
        lines.push(
          `<div style="text-align:center;font-size:10px;color:red">Descuento: -$${fmtMoney(item.discount)}</div>`,
        );
      lines.push(
        `<div style="border-bottom:1px dotted #ccc;margin:3px 0"></div>`,
      );
    });

    lines.push(`<div class="sep"></div>`);
    const effSubtotal =
      method === "cash" ? roundCash(subtotal) : subtotal;
    const effTotal = method === "cash" ? roundCash(total) : total;
    const effDiscount = effSubtotal - effTotal;
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Subtotal:</span><span>$${fmtMoney(effSubtotal)}</span></div>`,
    );
    if (
      cart.some(
        (i) =>
          safeNum(i.discount_percent) > 0 ||
          safeNum(i.discount) > 0 ||
          promoInfo(i, i.quantity).applied,
      )
    )
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Descuentos:</span><span>-$${fmtMoney(effDiscount)}</span></div>`,
      );
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px"><span>TOTAL:</span><span>$${fmtMoney(effTotal)}</span></div>`,
    );
    lines.push(`<div class="sep"></div>`);
    const metodo =
      method === "card"
        ? "TARJETA"
        : method === "transfer"
          ? "TRANSFERENCIA"
          : "EFECTIVO";
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Metodo:</span><span><strong>${metodo}</strong></span></div>`,
    );
    if (method === "cash") {
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Recibido:</span><span>$${fmtMoney(cashAmount)}</span></div>`,
      );
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Cambio:</span><span>$${fmtMoney(change)}</span></div>`,
      );
    }
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="text-align:center;font-weight:bold;font-size:13px">¡GRACIAS POR SU COMPRA!</div>`,
    );
    lines.push(
      `<div style="text-align:center;font-size:10px">Conserve este ticket</div>`,
    );
    lines.push(
      `<div style="text-align:center;font-size:9px;margin-top:5px">JRP POS</div>`,
    );
    lines.push(`<div style="height:20px"></div>`);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:58mm auto;margin:0}
      *{box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:11px;margin:0 auto;padding:2px 2px;width:48mm;max-width:48mm;background:white;color:black;overflow-wrap:break-word}
      .sep{border-top:1px dashed #333;margin:5px 0}
    </style></head><body>${lines.join("")}</body></html>`;
  };

  return (
    <Box
      ref={layoutRef}
      sx={{
        display: "flex",
        height: "calc(100vh - 120px)",
        overflow: "hidden",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: hasCart ? `min(${effectiveCartWidth}px, 55%)` : 0,
          minWidth: hasCart ? `min(${effectiveCartWidth}px, 55%)` : 0,
          overflow: "hidden",
          flexShrink: 0,
          transition: hasCart ? "none" : "width 0.35s ease, min-width 0.35s ease",
          background: (t) => t.palette.background.paper,
          borderLeft: hasCart ? "1px solid" : "none",
          borderColor: "divider",
          borderRadius: "8px",
          boxShadow: isDark
            ? "0 4px 24px rgba(0, 0, 0, 0.45)"
            : "0 6px 24px rgba(37, 99, 235, 0.10)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            p: 2,
            pb: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: focusZone === "cart" ? theme.palette.primary.main : "text.primary",
            }}
          >
            <ShoppingCart size={20} color={theme.palette.primary.main} />
            Carrito ({cart.length})
            {focusZone === "cart" && (
              <Chip
                label="↑↓ navega · ←→ cantidad"
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.6rem",
                  ml: 0.5,
                  bgcolor: "primary.main",
                  color: "#fff",
                }}
              />
            )}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setCart([])}
            sx={{ color: "error.main" }}
          >
            <Trash2 size={18} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
          {cart.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                opacity: 0.4,
                gap: 1,
              }}
            >
              <ShoppingCart size={56} color={theme.palette.text.secondary} />
              <Typography variant="body2" color="textSecondary">
                Sin productos
              </Typography>
            </Box>
          ) : (
            cart.map((item, index) => (
              <CartItem
                key={lineKeyOf(item)}
                item={item}
                index={index}
                isSelected={selectedCartItemIndex === index && focusZone === "cart"}
                onSelect={onSelectItem}
                onQuantityChange={updateQuantity}
                onRemove={removeFromCart}
                onDiscount={openDiscountDialog}
              />
            ))
          )}
        </Box>

        <Divider />

        <Box sx={{ p: 2, background: (t) => t.palette.background.paper }}>
          <Box sx={{ mb: 1.5 }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
            >
              <Typography variant="caption" color="textSecondary">
                Subtotal
              </Typography>
              <Typography variant="caption" color="textSecondary">
                ${displaySubtotal.toFixed(2)}
              </Typography>
            </Box>
            {displayDiscountTotal > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" color="error">
                  Descuentos
                </Typography>
                <Typography variant="caption" color="error">
                  -${displayDiscountTotal.toFixed(2)}
                </Typography>
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Total
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, color: theme.palette.success.main }}
              >
                ${displayTotal.toFixed(2)}
              </Typography>
            </Box>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              mb: 1.5,
              p: focusZone === "payment" ? 0.5 : 0,
              borderRadius: "6px",
              border: focusZone === "payment" ? "2px solid" : "2px solid transparent",
              borderColor: focusZone === "payment" ? theme.palette.primary.main : "transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Button
              variant={paymentMethod === "cash" ? "contained" : "outlined"}
              color={paymentMethod === "cash" ? "success" : "inherit"}
              size="small"
              startIcon={<DollarSign />}
              onClick={() => handlePayClick("cash")}
              sx={{
                flex: 1,
                fontWeight: 700,
                fontSize: "0.75rem",
                py: 1,
                borderWidth: paymentMethod === "cash" ? 0 : 2,
                "&:hover": { transform: "translateY(-1px)" },
                transition: "all 0.2s",
              }}
            >
              Efectivo
            </Button>
            <Button
              variant={paymentMethod === "card" ? "contained" : "outlined"}
              color={paymentMethod === "card" ? "primary" : "inherit"}
              size="small"
              startIcon={<CreditCard />}
              onClick={() => handlePayClick("card")}
              sx={{
                flex: 1,
                fontWeight: 700,
                fontSize: "0.75rem",
                py: 1,
                borderWidth: paymentMethod === "card" ? 0 : 2,
                "&:hover": { transform: "translateY(-1px)" },
                transition: "all 0.2s",
              }}
            >
              Tarjeta
            </Button>
            <Button
              variant={paymentMethod === "transfer" ? "contained" : "outlined"}
              color={paymentMethod === "transfer" ? "warning" : "inherit"}
              size="small"
              startIcon={<Landmark />}
              onClick={() => handlePayClick("transfer")}
              sx={{
                flex: 1,
                fontWeight: 700,
                fontSize: "0.75rem",
                py: 1,
                borderWidth: paymentMethod === "transfer" ? 0 : 2,
                "&:hover": { transform: "translateY(-1px)" },
                transition: "all 0.2s",
              }}
            >
              Transf.
            </Button>
          </Stack>

          {focusZone === "payment" && (
            <Typography
              variant="caption"
              sx={{ display: "block", textAlign: "center", mb: 0.5, color: "primary.main", fontWeight: 600 }}
            >
              ←→ cambiar método · ↑↓ = carrito · Tab = buscador · Enter = finalizar
            </Typography>
          )}

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setCart([]);
                setPaymentMethod("cash");
              }}
              sx={{
                flex: 1,
                borderColor: "error.main",
                color: "error.main",
                backgroundColor: isDark
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(239,68,68,0.06)",
                "&:hover": {
                  backgroundColor: isDark
                    ? "rgba(239,68,68,0.18)"
                    : "rgba(239,68,68,0.12)",
                  borderColor: "error.main",
                },
              }}
            >
              Limpiar
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={<Banknote />}
              disabled={!paymentMethod}
              onClick={() => {
                if (paymentMethod === "cash") setCashDialogOpen(true);
                else processSale(paymentMethod);
              }}
              sx={{
                flex: 2,
                fontWeight: 800,
                py: 1.4,
                fontSize: "0.9rem",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 8px 25px rgba(37, 99, 235, 0.35)",
                },
                "&:disabled": {
                  background: isDark
                    ? "rgba(59,130,246,0.12)"
                    : "rgba(148,163,184,0.15)",
                },
                transition: "all 0.2s",
              }}
            >
              Finalizar Venta
            </Button>
          </Stack>
        </Box>
      </Box>

      {hasCart && (
        <Box
          onMouseDown={startResize}
          onDoubleClick={() => setCartWidth(0)}
          sx={{
            width: 7,
            position: "relative",
            cursor: "col-resize",
            flexShrink: 0,
            alignSelf: "stretch",
            mx: -1,
            zIndex: 2,
            "&::after": {
              content: '""',
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 3,
              transform: "translateX(-50%)",
              background: (t) =>
                isDark
                  ? "rgba(148,163,184,0.25)"
                  : "rgba(100,116,139,0.2)",
              borderRadius: "2px",
            },
            "&:hover::after": {
              background: theme.palette.primary.main,
            },
          }}
        />
      )}

      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          px: 2,
          minWidth: 0,
        }}
      >
<Box
            sx={{
              width: "100%",
              maxWidth: isXLargeScreen ? 1200 : isLargeScreen ? 950 : isMediumScreen ? 750 : isSmallScreen ? 550 : 700,
display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
              p: 0,
              transition: "max-width 0.35s ease",
              borderRadius: "8px",
            }}
          >
            <Card
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              p: 3,
              background: isDark
                ? `linear-gradient(145deg, ${theme.palette.background.paper} 0%, rgba(30,41,59,0.7) 100%)`
                : `linear-gradient(145deg, ${theme.palette.background.paper} 0%, rgba(241,245,249,0.7) 100%)`,
              border: `1px solid ${isDark ? "rgba(148,163,184,0.08)" : "rgba(37,99,235,0.08)"}`,
              borderRadius: "8px",
              boxShadow: isDark
                ? "0 4px 24px rgba(0, 0, 0, 0.45)"
                : "0 6px 24px rgba(37, 99, 235, 0.10)",
              textAlign: "center",
            }}
          >
            <Box sx={{ flexShrink: 0 }}>
              <Box sx={{ position: "relative", mb: 1.5 }}>
                <QrCodeScanner
                  sx={{
                    fontSize: 56,
                    color: isDark
                      ? "rgba(148,163,184,0.3)"
                      : "rgba(100,116,139,0.25)",
                    mb: 1,
                  }}
                />
                <Box
                  sx={{
                    position: "relative",
                    height: 3,
                    background: isDark
                      ? "rgba(148,163,184,0.06)"
                      : "rgba(100,116,139,0.08)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    mx: "auto",
                    maxWidth: 160,
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      width: "40%",
                      height: "100%",
                      background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
                      animation: `${scanMove} 2s ease-in-out infinite`,
                      borderRadius: "12px",
                    }}
                  />
                </Box>
              </Box>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{
                  mb: 1.5,
                  fontWeight: 500,
                  display: "block",
                  letterSpacing: "0.02em",
                }}
              >
                Escanear código de barras o buscar producto
              </Typography>

<TextField
              fullWidth
              id="barcode-input"
              variant="outlined"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleBarcodeSubmit}
              autoFocus
              sx={{
                borderRadius: "8px",
                background: isDark
                  ? "rgba(30,41,59,0.4)"
                  : "rgba(241,245,249,0.7)",
                padding: "12px 16px",
                fontSize: "1.15rem",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  "&.Mui-focused": {
                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.18)",
                  },
                },
                "& .MuiOutlinedInput-notchedLabel": {
                  left: "14px",
                  top: "8px",
                  fontSize: "0.75rem",
                },
                "& .MuiInputBase-input": {
                  padding: 0,
                },
              }}
              placeholder={
                /^\d/.test(barcode)
                  ? "Código de barras (mín. 5 dígitos)"
                  : "Nombre del producto (mín. 3 caracteres)"
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} color={theme.palette.text.secondary} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: "8px",
                  background: isDark
                    ? "rgba(30,41,59,0.4)"
                    : "rgba(241,245,249,0.7)",
                  fontSize: "1.15rem",
                },
              }}
            />

              <Stack
                direction="row"
                spacing={1}
                justifyContent="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: 1.5 }}
              >
                {[
                  ["F1", "Ayuda"],
                  ["F2", "Sin código"],
                  ["F6", "Descuento"],
                  ["F9", "Cantidad"],
                  ["F8", "Vender"],
                  ["F10", "Retiro"],
                  ["F11", "Cerrar caja"],
                ].map(([key, label]) => (
                  <Chip
                    key={key}
                    label={`${key} ${label}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 28,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: isDark ? "#e2e8f0" : "#0f172a",
                      borderColor: "rgba(100,116,139,0.35)",
                      borderRadius: "4px",
                    }}
                  />
                ))}
                {pendingQty > 1 && (
                  <Chip
                    label={`Próximo: x${pendingQty}`}
                    size="small"
                    color="primary"
                    variant="filled"
                    sx={{
                      height: 28,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      borderRadius: "4px",
                    }}
                  />
                )}
                <Chip
                  icon={<Smartphone size={14} />}
                  label="Recarga · Ctrl+R"
                  onClick={() => setRecargaDialogOpen(true)}
                  sx={{
                    height: 28,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    borderRadius: "4px",
                    cursor: "pointer",
                    bgcolor: "#1e293b",
                    color: "#e2e8f0",
                    "&:hover": { bgcolor: "#334155" },
                  }}
                />
              </Stack>
            </Box>

            <Box ref={suggestionListRef} sx={{ flex: 1, overflow: "auto", mt: 2 }}>
              {showSuggestions && searchResults.length > 0 && (
                <Box sx={{ animation: "fadeIn 0.2s ease-out" }}>
                  {searchResults.map((product, index) => (
                    <ListItemButton
                      key={product.id}
                      data-suggestion-idx={index}
                      selected={index === selectedSuggestionIndex}
                      onClick={() => {
                        const { qty } = parseQtyPrefix(barcode);
                        addProductToCart(product, qty ?? undefined);
                      }}
                      sx={{
                        py: 1.2,
                        px: 2,
                        borderRadius: 1,
                        mb: 0.5,
                        "&.Mui-selected": {
                          backgroundColor: isDark
                            ? "rgba(59,130,246,0.15)"
                            : "rgba(37,99,235,0.1)",
                        },
                        "&:hover": {
                          backgroundColor: isDark
                            ? "rgba(59,130,246,0.08)"
                            : "rgba(37,99,235,0.05)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Box sx={{ textAlign: "left", minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, fontSize: "1rem" }}
                          >
                            {product.name}
                            {product.sale_unit === "weight" && (
                              <Chip
                                icon={<Carrot size={12} />}
                                label="kg"
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  height: 20,
                                  fontSize: "0.65rem",
                                  bgcolor: "rgba(59,130,246,0.12)",
                                  color: theme.palette.primary.main,
                                  fontWeight: 700,
                                }}
                              />
                            )}
                            {isContainerUnit(product.sale_unit) && (
                              <Chip
                                icon={
                                  product.sale_unit === "package" ? (
                                    <Layers size={12} />
                                  ) : (
                                    <Package size={12} />
                                  )
                                }
                                label={unitLabels(product.sale_unit).badge}
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  height: 20,
                                  fontSize: "0.65rem",
                                  bgcolor: "rgba(16,185,129,0.12)",
                                  color: theme.palette.success.main,
                                  fontWeight: 700,
                                }}
                              />
                            )}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ fontSize: "0.7rem" }}
                          >
                            {product.brand}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: theme.palette.success.main,
                              fontSize: "0.95rem",
                            }}
                          >
                            $
                            {calcFinalPrice(
                              product.price,
                              product.discount_percent,
                            ).toFixed(2)}
                          </Typography>
                          {product.discount_percent > 0 && (
                            <Typography
                              variant="caption"
                              color="error"
                              sx={{ fontSize: "0.65rem" }}
                            >
                              -{product.discount_percent}%
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </ListItemButton>
                  ))}
                </Box>
              )}

              {isSearching && !searchTimedOut && (
                <Stack spacing={1} sx={{ p: 1 }}>
                  {[1, 2, 3].map((i) => (
                    <Box
                      key={i}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Box>
                        <Skeleton
                          variant="text"
                          width={120}
                          height={14}
                          sx={{
                            bgcolor: isDark
                              ? "rgba(148,163,184,0.06)"
                              : "rgba(148,163,184,0.15)",
                          }}
                        />
                        <Skeleton
                          variant="text"
                          width={80}
                          height={10}
                          sx={{
                            bgcolor: isDark
                              ? "rgba(148,163,184,0.06)"
                              : "rgba(148,163,184,0.15)",
                          }}
                        />
                      </Box>
                      <Skeleton
                        variant="text"
                        width={60}
                        height={14}
                        sx={{
                          bgcolor: isDark
                            ? "rgba(148,163,184,0.06)"
                            : "rgba(148,163,184,0.15)",
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}

              {searchTimedOut && (
                <Box sx={{ textAlign: "center", py: 4, opacity: 0.6 }}>
                  <Search
                    size={40}
                    color={theme.palette.text.secondary}
                    style={{ marginBottom: 8 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    La búsqueda está tardando demasiado
                  </Typography>
                </Box>
              )}

              {!isSearching &&
                !searchTimedOut &&
                barcode.length >= 3 &&
                searchResults.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 4, opacity: 0.6 }}>
                    <Search
                      size={40}
                      color={theme.palette.text.secondary}
                      style={{ marginBottom: 8 }}
                    />
                    <Typography variant="body2" color="textSecondary">
                      No se encontraron productos
                    </Typography>
                  </Box>
                )}

              {barcode === "" && cart.length === 0 && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textAlign: "center", opacity: 0.5, mt: 2 }}
                >
                  Use el escáner, escriba un código o nombre de producto para
                  comenzar
                </Typography>
              )}
            </Box>
          </Card>
        </Box>
      </Box>

      <Dialog
        open={weightDialog.open}
        onClose={() => {
          setWeightDialog({ open: false, product: null });
          refocusBarcode();
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && parseFloat(weightAmount) > 0)
            confirmWeightProduct();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Scale size={22} color={theme.palette.primary.main} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Peso del Producto
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {weightDialog.product && (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {weightDialog.product.name}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Precio:{" "}
                  <strong>${fmtMoney(weightDialog.product.price)} / kg</strong>
                </Typography>
                {safeNum(weightDialog.product.discount_percent) > 0 && (
                  <Chip
                    label={`-${weightDialog.product.discount_percent}%`}
                    color="error"
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
              <TextField
                fullWidth
                label="Peso (kg)"
                type="text"
                inputMode="decimal"
                value={weightAmount}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  if (/^\d*\.?\d{0,3}$/.test(v)) setWeightAmount(v);
                }}
                autoFocus
                placeholder="Ej: 4.800"
                sx={{ mb: 2 }}
              />
              {parseFloat(weightAmount) > 0 && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "8px",
                    background: isDark
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(16, 185, 129, 0.06)",
                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)"}`,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Total:
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 800, color: theme.palette.success.main }}
                  >
                    $
                    {fmtMoney(
                      (safeNum(weightDialog.product.discount_percent) > 0
                        ? calcFinalPrice(
                            weightDialog.product.price,
                            weightDialog.product.discount_percent,
                          )
                        : safeNum(weightDialog.product.price)) * parseFloat(weightAmount)
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${fmtMoney(weightDialog.product.price)} ×{" "}
                    {fmtKg(weightAmount)} kg
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => setWeightDialog({ open: false, product: null })}
          >
            Cancelar
          </CancelButton>
          <Button
            onClick={confirmWeightProduct}
            variant="outlined"
            disabled={!weightAmount || parseFloat(weightAmount) <= 0}
            startIcon={<Scale />}
            sx={{
              borderColor: "success.main",
              color: "success.main",
              backgroundColor: "rgba(16,185,129,0.06)",
              "&:hover": {
                backgroundColor: "rgba(16,185,129,0.12)",
                borderColor: "success.main",
              },
            }}
          >
            Agregar al Carrito
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discountDialog.open}
        onClose={() => setDiscountDialog({ open: false, item: null })}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
            e.preventDefault();
            handleDiscountApply();
          }
        }}
        PaperProps={{ sx: { borderRadius: "6px" } }}
      >
        <DialogTitle component="div" sx={{ pb: 1 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
            Descuento del producto
          </Typography>
          <Typography component="span" variant="body2" color="textSecondary">
            {discountDialog.item?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {discountDialog.item && (
            <Box sx={{ py: 1 }}>
              <TextField
                fullWidth
                label="Monto a descontar ($)"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                autoFocus
                inputProps={{ min: 0, step: 0.01 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <DollarSign size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 2 }}
              />
              <Box
                sx={{
                  p: 2,
                  borderRadius: "8px",
                  background: isDark
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(16, 185, 129, 0.06)",
                  border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)"}`,
                  textAlign: "center",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Subtotal: $
                  {fmtMoney(safeNum(discountDialog.item.price) * safeNum(discountDialog.item.quantity, 1))}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Precio final:
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 800, color: theme.palette.success.main }}
                >
                  $
                  {fmtMoney(
                    safeNum(discountDialog.item.price) * safeNum(discountDialog.item.quantity, 1) -
                    Math.min(
                      Math.max(parseFloat(discountValue) || 0, 0),
                      safeNum(discountDialog.item.price) * safeNum(discountDialog.item.quantity, 1),
                    )
                  )}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, justifyContent: "space-between" }}>
          <Box>
            {safeNum(discountDialog.item?.discount) > 0 && (
              <Button
                onClick={() => {
                  clearDiscount(discountDialog.item);
                  setDiscountDialog({ open: false, item: null });
                }}
                variant="outlined"
                sx={{ color: "error.main", borderColor: "error.main" }}
              >
                Quitar descuento
              </Button>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CancelButton
              onClick={() => setDiscountDialog({ open: false, item: null })}
            >
              Cancelar
            </CancelButton>
            <Button
              onClick={handleDiscountApply}
              variant="contained"
              disabled={
                !discountDialog.item ||
                !discountValue ||
                parseFloat(discountValue) <= 0 ||
                parseFloat(discountValue) >
                  safeNum(discountDialog.item.price) * safeNum(discountDialog.item.quantity, 1)
              }
            >
              Aplicar
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={boxChoiceDialog.open}
        onClose={() => {
          setBoxChoiceDialog({ open: false, product: null });
          refocusBarcode();
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const active = document.activeElement;
            if (active && typeof active.click === "function") active.click();
            else confirmBoxChoice("box");
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            document.activeElement?.previousElementSibling?.focus?.();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            document.activeElement?.nextElementSibling?.focus?.();
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Store size={22} color={theme.palette.primary.main} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Seleccionar formato
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {boxChoiceDialog.product && (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {boxChoiceDialog.product.name}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="center"
                  sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}
                >
                  {boxChoiceDialog.product.box_qty > 0 && (
                    <Chip
                      label={`${unitLabels(boxChoiceDialog.product.sale_unit)?.containerNoun || "Caja"}: $${fmtMoney(boxChoiceDialog.product.box_price)}`}
                      variant="outlined"
                      size="small"
                      color="primary"
                    />
                  )}
                  {boxChoiceDialog.product.sale_unit === "boxpack" &&
                  boxChoiceDialog.product.pack_qty > 0 && (
                    <Chip
                      label={`Paquete: $${fmtMoney(packPriceOf(boxChoiceDialog.product))}`}
                      variant="outlined"
                      size="small"
                      color="secondary"
                    />
                  )}
                  <Chip
                    label={`Pieza: $${fmtMoney(piecePriceOf(boxChoiceDialog.product))}`}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
                {boxChoiceDialog.product.box_qty > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {boxChoiceDialog.product.box_qty}{" "}
                    {unitLabels(boxChoiceDialog.product.sale_unit)?.piecesPer ||
                      "piezas por caja"}
                  </Typography>
                )}
                {boxChoiceDialog.product.sale_unit === "boxpack" &&
                  boxChoiceDialog.product.pack_qty > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {boxChoiceDialog.product.pack_qty} piezas por paquete
                  </Typography>
                )}
              </Box>
              <Stack direction="column" spacing={1.5}>
                {boxChoiceDialog.product.box_qty > 0 && (
                  <Button
                    fullWidth
                    size="large"
                    variant="outlined"
                    autoFocus
                    onClick={() => confirmBoxChoice("box")}
                    sx={{
                      py: 2,
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    <Stack spacing={0.5} alignItems="center">
                      <span>
                        {unitLabels(boxChoiceDialog.product.sale_unit)
                          ?.containerNoun || "Caja"}
                      </span>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 400, opacity: 0.7 }}
                      >
                        ${fmtMoney(boxChoiceDialog.product.box_price)}
                      </Typography>
                    </Stack>
                  </Button>
                )}
                {boxChoiceDialog.product.sale_unit === "boxpack" &&
                  boxChoiceDialog.product.pack_qty > 0 && (
                  <Button
                    fullWidth
                    size="large"
                    variant="outlined"
                    onClick={() => confirmBoxChoice("pack")}
                    sx={{
                      py: 2,
                      borderColor: theme.palette.secondary.main,
                      color: theme.palette.secondary.main,
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    <Stack spacing={0.5} alignItems="center">
                      <span>Paquete</span>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 400, opacity: 0.7 }}
                      >
                        ${fmtMoney(packPriceOf(boxChoiceDialog.product))}
                      </Typography>
                    </Stack>
                  </Button>
                )}
                <Button
                  fullWidth
                  size="large"
                  variant="outlined"
                  onClick={() => confirmBoxChoice("piece")}
                  sx={{ py: 2, fontWeight: 700, fontSize: "0.9rem" }}
                >
                  <Stack spacing={0.5} alignItems="center">
                    <span>Pieza</span>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 400, opacity: 0.7 }}
                    >
                      ${fmtMoney(piecePriceOf(boxChoiceDialog.product))}
                    </Typography>
                  </Stack>
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => {
              setBoxChoiceDialog({ open: false, product: null });
              refocusBarcode();
            }}
          >
            Cancelar
          </CancelButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cashDialogOpen}
        onClose={() => {
          if (waitingDrawer) {
            handleDrawerDone();
          } else {
            setCashDialogOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (waitingDrawer && e.key === "Enter") {
            e.preventDefault();
            handleDrawerDone();
          } else if (e.key === "Enter" && cashAmount && change >= 0) {
            handleCashConfirm();
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <DollarSign size={22} color={theme.palette.success.main} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Pago en Efectivo
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 1 }}>
            <Typography
              variant="body1"
              sx={{
                textAlign: "center",
                mb: 0.5,
                fontWeight: 700,
                color: "text.secondary",
                fontSize: "1.1rem",
              }}
            >
              Total a pagar
            </Typography>
            <Typography
              variant="h3"
              sx={{
                textAlign: "center",
                mb: 2,
                color: theme.palette.success.main,
                fontWeight: 800,
                fontSize: "2.5rem",
                lineHeight: 1.1,
              }}
            >
              ${displayTotal.toFixed(2)}
            </Typography>
            {displayDiscountTotal > 0 && (
              <Typography
                variant="body2"
                color="error"
                textAlign="center"
                sx={{ mb: 2 }}
              >
                Descuento aplicado: -${displayDiscountTotal.toFixed(2)}
              </Typography>
            )}
            <TextField
              fullWidth
              label="¿Con cuánto pagó?"
              type="number"
              value={cashAmount}
              onChange={(e) => {
                const a = parseFloat(e.target.value) || 0;
                setCashAmount(e.target.value);
                setChange(a - displayTotal);
              }}
              autoFocus={!waitingDrawer}
              disabled={waitingDrawer}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
                sx: { fontSize: "2rem", fontWeight: 700 },
              }}
              inputProps={{ step: "0.01", min: "0" }}
              sx={{ mt: 1 }}
            />
            {cashAmount && (
              <Alert
                severity={change >= 0 ? "success" : "error"}
                sx={{ mt: 2, alignItems: "center", "& .MuiAlert-message": { flex: 1 } }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {change >= 0 ? "Cambio:" : "Falta:"}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    ${(change >= 0 ? change : Math.abs(change)).toFixed(2)}
                  </Typography>
                </Box>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => {
              if (waitingDrawer) {
                handleDrawerDone();
              } else {
                setCashDialogOpen(false);
              }
            }}
          >
            Cancelar
          </CancelButton>
          {waitingDrawer ? (
            <Button
              onClick={handleDrawerDone}
              variant="contained"
              startIcon={<CheckCircle2 />}
              autoFocus
            >
              Listo
            </Button>
          ) : (
            <Button
              onClick={handleCashConfirm}
              variant="outlined"
              disabled={!cashAmount || change < 0}
              startIcon={<CheckCircle2 />}
              sx={{
                borderColor: "success.main",
                color: "success.main",
                backgroundColor: "rgba(16,185,129,0.06)",
                "&:hover": {
                  backgroundColor: "rgba(16,185,129,0.12)",
                  borderColor: "success.main",
                },
              }}
            >
              Confirmar Venta
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={recargaDialogOpen}
        onClose={() => {
          setRecargaDialogOpen(false);
          setRecargaAmount("");
          refocusBarcode();
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmRecharge();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Smartphone size={22} color={theme.palette.primary.main} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Recargas
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            <Box>
              <FieldLabel>Selecciona un monto</FieldLabel>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PRESET_RECHARGES.map((m) => (
                  <Chip
                    key={m}
                    label={`$${m}`}
                    clickable
                    color={recargaAmount === String(m) ? "primary" : "default"}
                    variant={recargaAmount === String(m) ? "filled" : "outlined"}
                    onClick={() => setRecargaAmount(String(m))}
                    sx={{
                      height: 40,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      borderRadius: "6px",
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <Box>
              <FieldLabel>Monto personalizado</FieldLabel>
              <TextField
                fullWidth
                autoFocus
                type="number"
                value={recargaAmount}
                onChange={(e) =>
                  setRecargaAmount(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Ej: 15"
                sx={inputSx}
                inputProps={{ min: 1, step: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => {
              setRecargaDialogOpen(false);
              setRecargaAmount("");
              refocusBarcode();
            }}
          >
            Cancelar
          </CancelButton>
          <Button
            variant="contained"
            disabled={
              !parseFloat(recargaAmount) || parseFloat(recargaAmount) <= 0
            }
            onClick={confirmRecharge}
            endIcon={<CheckCircle2 />}
          >
            Agregar al carrito
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={qtyDialogOpen}
        onClose={() => {
          setQtyDialogOpen(false);
          refocusBarcode();
        }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const qty = parseInt(qtyInput, 10);
            if (qty >= 1) {
              setPendingQty(qty);
              setQtyDialogOpen(false);
              showNotification(`Próxima captura: x${qty}`, "info");
              refocusBarcode();
            } else {
              showNotification("Cantidad inválida", "warning");
            }
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Percent size={22} color={theme.palette.primary.main} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Cantidad para próxima captura
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <FieldLabel>Cantidad (se reinicia a 1 tras usarse)</FieldLabel>
          <TextField
            autoFocus
            fullWidth
            type="number"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value.replace(/\D/g, ""))}
            inputProps={{ min: 1, step: 1 }}
            onFocus={(e) => e.target.select()}
            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">×</InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => {
              setQtyDialogOpen(false);
              refocusBarcode();
            }}
          >
            Cancelar
          </CancelButton>
          <Button
            variant="contained"
            disabled={!qtyInput || parseInt(qtyInput, 10) < 1}
            onClick={() => {
              const qty = parseInt(qtyInput, 10);
              if (qty >= 1) {
                setPendingQty(qty);
                setQtyDialogOpen(false);
                showNotification(`Próxima captura: x${qty}`, "info");
                refocusBarcode();
              }
            }}
            endIcon={<CheckCircle2 />}
          >
            Listo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={manualProductModalOpen}
        onClose={() => {
          setManualProductModalOpen(false);
          refocusBarcode();
        }}
        maxWidth="sm"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && manualProduct.name && manualProduct.price)
            handleManualProduct();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QrCode size={22} color={theme.palette.primary.main} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Producto Sin Código
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            <Box>
              <FieldLabel>Nombre del producto</FieldLabel>
              <TextField
                fullWidth
                value={manualProduct.name}
                onChange={(e) =>
                  setManualProduct({ ...manualProduct, name: e.target.value })
                }
                sx={inputSx}
                autoFocus
              />
            </Box>
            <Box>
              <FieldLabel>Precio</FieldLabel>
              <TextField
                fullWidth
                type="number"
                value={manualProduct.price}
                onChange={(e) =>
                  setManualProduct({ ...manualProduct, price: e.target.value })
                }
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                inputProps={{ step: "0.01", min: "0" }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => {
              setManualProductModalOpen(false);
              refocusBarcode();
            }}
          >
            Cancelar
          </CancelButton>
          <Button
            onClick={handleManualProduct}
            variant="outlined"
            disabled={!manualProduct.name || !manualProduct.price}
            startIcon={<PlusCircle />}
            sx={{
              borderColor: "success.main",
              color: "success.main",
              backgroundColor: "rgba(16,185,129,0.06)",
              "&:hover": {
                backgroundColor: "rgba(16,185,129,0.12)",
                borderColor: "success.main",
              },
            }}
          >
            Agregar al Carrito
          </Button>
        </DialogActions>
      </Dialog>

      {createPortal(
        <Snackbar
          open={notification.open}
          autoHideDuration={3000}
          onClose={() => setNotification({ ...notification, open: false })}
          TransitionComponent={Fade}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          sx={{ zIndex: 9999 }}
        >
          <Alert
            onClose={() => setNotification({ ...notification, open: false })}
            severity={notification.severity}
            sx={{ width: "100%" }}
          >
            {notification.message}
          </Alert>
        </Snackbar>,
        document.body,
      )}

      {createPortal(
        <Snackbar
          open={registerWarn}
          autoHideDuration={4000}
          onClose={() => setRegisterWarn(false)}
          TransitionComponent={Fade}
          anchorOrigin={{ vertical: "center", horizontal: "center" }}
          sx={{ zIndex: 9999 }}
        >
          <Alert
            severity="warning"
            variant="filled"
            onClose={() => setRegisterWarn(false)}
            icon={<TriangleAlert size={22} />}
            sx={{
              fontSize: "1.05rem",
              fontWeight: 700,
              py: 1,
              px: 2,
              boxShadow: 4,
              borderRadius: 2,
              minWidth: 320,
              justifyContent: "center",
            }}
          >
            Abre la caja para completar la venta
          </Alert>
        </Snackbar>,
        document.body,
      )}

      <Backdrop open={printing} sx={{ zIndex: 9998, color: "white" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress color="inherit" size={48} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Imprimiendo ticket...
          </Typography>
        </Stack>
      </Backdrop>
    </Box>
  );
};

export default SalesTerminal;
