import React, { useState, useEffect, useRef } from "react";
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
  DeleteOutlined,
  Add,
  Remove,
  CheckCircle,
  CreditCard,
  Search,
  AttachMoney,
  AddCircleOutline,
  QrCode,
  AccountBalance,
  QrCodeScanner,
  DeleteSweep,
  PointOfSale,
  Store,
  MonitorWeight,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";

const scanMove = keyframes`
  0% { left: -30%; }
  50% { left: 100%; }
  100% { left: -30%; }
`;

const SalesTerminal = () => {
  const { cashier } = useCashier();
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [change, setChange] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [manualProductModalOpen, setManualProductModalOpen] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: "", price: "" });
  const [storeSettings, setStoreSettings] = useState({
    name: "MI TIENDA POS",
    website: "www.mitienda.com",
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
  });
  const [printing, setPrinting] = useState(false);
  const searchTimeoutRef = useRef(null);
  const cartRef = useRef(cart);
  const lastEscRef = useRef(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
  const DRAWER_WIDTH = isLargeScreen ? 460 : 380;
  const hasCart = cart.length > 0;

  const processSaleRef = useRef(null);
  const discountTotal = cart.reduce((sum, item) => {
    const itemSubtotal = item.price * (item.quantity || 1);
    const itemDiscount =
      item.discount_percent > 0
        ? itemSubtotal * (item.discount_percent / 100)
        : item.discount || 0;
    return sum + itemDiscount;
  }, 0);

  const processSale = async (method) => {
    const result = await window.api.invoke("record-sale", {
      cart,
      total: total,
      paymentMethod: method,
      discountTotal,
      cashierName: cashier?.name || "Usuario Principal",
    });
    if (result.success) {
      setCart([]);
      setPaymentMethod("");
      setCashDialogOpen(false);
      setCashAmount("");
      setChange(0);
      setBarcode("");
      showNotification("Venta registrada exitosamente", "success");
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
    } else {
      showNotification(result.error || "Error al registrar la venta", "error");
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const name = await window.api.invoke("get-setting", "store_name");
        const website = await window.api.invoke("get-setting", "store_website");
        if (name)
          setStoreSettings((prev) => ({ ...prev, name: name.toUpperCase() }));
        if (website) setStoreSettings((prev) => ({ ...prev, website }));
      } catch (e) {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    cartRef.current = cart;
    processSaleRef.current = processSale;
  }, [cart, processSale]);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
          updateQuantity(lastItem.id, 1, false);
        }
      }
      if (e.key === "F3") {
        e.preventDefault();
        const lastItem = cartRef.current?.[cartRef.current.length - 1];
        if (lastItem && !lastItem.isWeightItem) {
          updateQuantity(lastItem.id, -1, false);
        }
      }
      if (e.key === "q" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById("barcode-input")?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        setManualProductModalOpen(true);
      }
      if (e.key === "F7") {
        e.preventDefault();
        const cart = cartRef.current;
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          removeFromCart(lastItem.id);
        }
      }
      if (e.key === "Escape" && document.activeElement?.id !== "barcode-input") {
        e.preventDefault();
        const now = Date.now();
        if (now - lastEscRef.current < 400) {
          setCart([]);
          setPaymentMethod("");
          showNotification("Carrito limpiado", "success");
        }
        lastEscRef.current = now;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paymentMethod]);

  useEffect(() => {
    const sub = cart.reduce((s, item) => s + item.price * item.quantity, 0);
    setSubtotal(sub);
    setTotal(sub - discountTotal);
  }, [cart]);

  useEffect(() => {
    if (!weightDialog.open || !weightDialog.product) return;
    let cancelled = false;

    const unsub = window.api.on("weight-update", (data) => {
      if (!cancelled && data.weight >= 0) {
        setWeightAmount(data.weight.toString());
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
      const isNumeric = /^\d+$/.test(barcode);
      const minChars = isNumeric ? 5 : 3;
      if (barcode.length >= minChars) {
        setIsSearching(true);
        setSearchTimedOut(false);
        setShowSuggestions(false);
        searchTimeoutRef.current = setTimeout(() => {
          setIsSearching(false);
          setSearchTimedOut(true);
        }, 8000);
        try {
          const products = await window.api.invoke("search-products", barcode);
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
        setSearchTimedOut(false);
      }
    }, 300);
    return () => {
      clearTimeout(debounceTimer);
      clearTimeout(searchTimeoutRef.current);
    };
  }, [barcode]);

  const showNotification = (message, severity = "info") => {
    setNotification({ open: true, message, severity });
  };

  const calcFinalPrice = (price, discount) =>
    price * (1 - (discount || 0) / 100);

  const addProductToCart = (product) => {
    if (product.sale_unit === "weight" && !product.isManual) {
      setWeightAmount("");
      setWeightDialog({ open: true, product });
      return;
    }
    if (product.sale_unit === "box" && !product.isManual) {
      setBoxChoiceDialog({ open: true, product });
      return;
    }
    const effectivePrice = calcFinalPrice(
      product.price,
      product.discount_percent,
    );
    const productWithDiscount = { ...product, finalPrice: effectivePrice };

    if (product.stock > 0 || product.isManual) {
      const existingIndex = cart.findIndex(
        (item) =>
          item.id === product.id ||
          (product.isManual && item.name === product.name),
      );
      if (existingIndex !== -1) {
        const updatedCart = [...cart];
        if (
          product.isManual ||
          updatedCart[existingIndex].quantity < product.stock
        ) {
          updatedCart[existingIndex].quantity += 1;
          setCart(updatedCart);
          showNotification(`${product.name} agregado al carrito`, "success");
        } else {
          showNotification("Stock insuficiente", "warning");
        }
      } else {
        setCart([...cart, { ...productWithDiscount, quantity: 1 }]);
        showNotification(`${product.name} agregado al carrito`, "success");
      }
    } else {
      showNotification("Producto sin stock", "error");
    }
  };

  const confirmWeightProduct = () => {
    const { product } = weightDialog;
    const kg = parseFloat(weightAmount) || 0;
    if (kg <= 0) return;
    const effectivePrice = calcFinalPrice(
      product.price,
      product.discount_percent,
    );
    const productWithWeight = {
      ...product,
      finalPrice: effectivePrice,
      quantity: kg,
      isWeightItem: true,
    };
    const existingIndex = cart.findIndex(
      (item) => item.id === product.id && item.isWeightItem,
    );
    if (existingIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += kg;
      setCart(updatedCart);
    } else {
      setCart([...cart, productWithWeight]);
    }
    setWeightDialog({ open: false, product: null });
    setWeightAmount("");
    showNotification(
      `${kg.toFixed(3)} kg de ${product.name} agregado`,
      "success",
    );
  };

  const confirmBoxChoice = (choice) => {
    const { product } = boxChoiceDialog;
    const isBox = choice === "box";
    const unitPrice = isBox ? product.box_price : product.price;
    const effectivePrice = calcFinalPrice(unitPrice, product.discount_percent);
    const item = {
      ...product,
      finalPrice: effectivePrice,
      quantity: 1,
      isBoxItem: isBox,
      price: unitPrice,
    };
    const existingIndex = cart.findIndex(
      (i) => i.id === product.id && i.isBoxItem === isBox,
    );
    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, item]);
    }
    setBoxChoiceDialog({ open: false, product: null });
    showNotification(
      `${isBox ? "Caja" : "Pieza"} de ${product.name} agregado`,
      "success",
    );
  };

  const handleBarcodeSubmit = async (event) => {
    const rawValue = event.target?.value ?? barcode;
    const trimmedValue = rawValue.trim();
    if (event.key === "Enter" && trimmedValue !== "") {
      event.preventDefault();
      setShowSuggestions(false);
      if (
        selectedSuggestionIndex >= 0 &&
        searchResults[selectedSuggestionIndex]
      ) {
        addProductToCart(searchResults[selectedSuggestionIndex]);
        setBarcode("");
        setSelectedSuggestionIndex(-1);
        return;
      }
      const { success, product } = await window.api.invoke(
        "get-product-by-barcode",
        trimmedValue,
      );
      if (success && product) {
        addProductToCart(product);
      } else {
        showNotification("Producto no encontrado", "error");
      }
      setBarcode("");
      setSelectedSuggestionIndex(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (showSuggestions && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev < Math.min(searchResults.length - 1, 4) ? prev + 1 : 0,
        );
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (showSuggestions && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : Math.min(searchResults.length - 1, 4),
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
        barcode: "SIN CÓDIGO",
        stock: 999,
        isManual: true,
      };
      addProductToCart(newProduct);
      setManualProduct({ name: "", price: "" });
      setManualProductModalOpen(false);
    }
  };

  const updateQuantity = (productId, delta, isWeight) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const step = isWeight ? 0.1 : item.isBoxItem ? 1 : 1;
            const newQty = item.quantity + delta * step;
            return newQty <= 0
              ? null
              : { ...item, quantity: Math.min(newQty, item.stock || 999) };
          }
          return item;
        })
        .filter(Boolean),
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
    showNotification("Producto eliminado del carrito", "info");
  };

  const handlePayClick = (method) => {
    setPaymentMethod(method === paymentMethod ? "" : method);
  };

  const handleCashConfirm = () => {
    processSale("cash");
  };

  const generateReceiptHTML = (method) => {
    const now = new Date();
    const ticketNum = Date.now().toString().slice(-6);
    const lines = [];

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
      const fp = item.finalPrice || item.price;
      const lineTotal = fp * item.quantity;
      const unit = item.isWeightItem ? "kg" : item.isBoxItem ? "cj" : "pza";
      const qtyDisplay = item.isWeightItem
        ? item.quantity.toFixed(3)
        : item.quantity;
      const name =
        item.name.length > 24 ? item.name.substring(0, 22) + ".." : item.name;
      lines.push(`<div style="font-weight:bold;font-size:12px">${name}</div>`);
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:10px"><span>${qtyDisplay} ${unit} x $${fp.toFixed(2)}</span><span>$${lineTotal.toFixed(2)}</span></div>`,
      );
      if (item.discount_percent > 0)
        lines.push(
          `<div style="text-align:center;font-size:10px;color:red">Descuento: -${item.discount_percent}%</div>`,
        );
      lines.push(
        `<div style="border-bottom:1px dotted #ccc;margin:3px 0"></div>`,
      );
    });

    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>`,
    );
    if (cart.some((i) => i.discount_percent > 0))
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Descuentos:</span><span>-$${(subtotal - total).toFixed(2)}</span></div>`,
      );
    lines.push(`<div class="sep"></div>`);
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>`,
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
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Recibido:</span><span>$${parseFloat(cashAmount).toFixed(2)}</span></div>`,
      );
      lines.push(
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Cambio:</span><span>$${change.toFixed(2)}</span></div>`,
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
      sx={{
        display: "flex",
        height: "calc(100vh - 120px)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: hasCart ? DRAWER_WIDTH : 0,
          minWidth: hasCart ? DRAWER_WIDTH : 0,
          overflow: "hidden",
          flexShrink: 0,
          transition: "width 0.35s ease, min-width 0.35s ease",
          background: (t) => t.palette.background.paper,
          borderLeft: hasCart ? "1px solid" : "none",
          borderColor: "divider",
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
            }}
          >
            <ShoppingCart
              sx={{ fontSize: 20, color: theme.palette.primary.main }}
            />
            Carrito ({cart.length})
          </Typography>
          <IconButton
            size="small"
            onClick={() => setCart([])}
            sx={{ color: "error.main" }}
          >
            <DeleteSweep fontSize="small" />
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
              <ShoppingCart sx={{ fontSize: 56, color: "text.secondary" }} />
              <Typography variant="body2" color="textSecondary">
                Sin productos
              </Typography>
            </Box>
          ) : (
            cart.map((item) => {
              const fp = item.finalPrice || item.price;
              return (
                <Paper
                  key={item.id}
                  elevation={0}
                  sx={{
                    mb: 1,
                    p: 1.5,
                    background: isDark
                      ? "rgba(59,130,246,0.04)"
                      : "rgba(37,99,235,0.03)",
                    border: `1px solid ${isDark ? "rgba(59,130,246,0.1)" : "rgba(37,99,235,0.08)"}`,
                    borderRadius: 2,
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
                          sx={{ fontWeight: 600, fontSize: "0.85rem" }}
                        >
                          {item.name}
                        </Typography>
                        {item.isWeightItem && (
                          <Chip
                            label="kg"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: "0.55rem",
                              bgcolor: "rgba(59,130,246,0.12)",
                              color: theme.palette.primary.main,
                              fontWeight: 700,
                            }}
                          />
                        )}
                        {item.isBoxItem && (
                          <Chip
                            label="caja"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: "0.55rem",
                              bgcolor: "rgba(16,185,129,0.12)",
                              color: theme.palette.success.main,
                              fontWeight: 700,
                            }}
                          />
                        )}
                        {item.discount_percent > 0 && (
                          <Chip
                            label={`-${item.discount_percent}%`}
                            color="error"
                            size="small"
                            sx={{ ml: 0.5, height: 16, fontSize: "0.55rem" }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {item.discount_percent > 0 ? (
                          <>
                            <span style={{ textDecoration: "line-through" }}>
                              ${item.price.toFixed(2)}
                            </span>{" "}
                            ${fp.toFixed(2)}
                          </>
                        ) : (
                          `$${item.price.toFixed(2)}`
                        )}{" "}
                        {item.isWeightItem
                          ? "/ kg"
                          : item.isBoxItem
                            ? "/ caja"
                            : "c/u"}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.3}>
                      <IconButton
                        size="small"
                        onClick={() =>
                          updateQuantity(item.id, -1, item.isWeightItem)
                        }
                        sx={{ width: 24, height: 24 }}
                      >
                        <Remove sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          minWidth: item.isWeightItem ? 46 : 26,
                          textAlign: "center",
                          fontSize: "0.85rem",
                        }}
                      >
                        {item.isWeightItem
                          ? `${item.quantity.toFixed(3)}`
                          : item.quantity}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() =>
                          updateQuantity(item.id, 1, item.isWeightItem)
                        }
                        sx={{ width: 24, height: 24 }}
                      >
                        <Add sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        minWidth: 70,
                        textAlign: "right",
                        color: theme.palette.success.main,
                        fontSize: "0.85rem",
                      }}
                    >
                      ${(fp * item.quantity).toFixed(2)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => removeFromCart(item.id)}
                      sx={{ color: "error.main", width: 28, height: 28 }}
                    >
                      <DeleteOutlined sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Paper>
              );
            })
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
                ${subtotal.toFixed(2)}
              </Typography>
            </Box>
            {discountTotal > 0 && (
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
                  -${discountTotal.toFixed(2)}
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
                ${total.toFixed(2)}
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Button
              variant={paymentMethod === "cash" ? "contained" : "outlined"}
              color={paymentMethod === "cash" ? "success" : "inherit"}
              size="small"
              startIcon={<AttachMoney />}
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
              startIcon={<AccountBalance />}
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
              startIcon={<PointOfSale />}
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

      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          p: 2,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: hasCart ? 700 : 900,
            display: "flex",
            flexDirection: "column",
            transition: "max-width 0.35s ease",
          }}
        >
          <Card
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              p: 3,
              background: isDark
                ? `linear-gradient(145deg, ${theme.palette.background.paper} 0%, rgba(30,41,59,0.7) 100%)`
                : `linear-gradient(145deg, ${theme.palette.background.paper} 0%, rgba(241,245,249,0.7) 100%)`,
              border: `1px solid ${isDark ? "rgba(148,163,184,0.08)" : "rgba(37,99,235,0.08)"}`,
              borderRadius: 3,
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
                    borderRadius: 4,
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
                      borderRadius: 4,
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
                placeholder={
                  /^\d/.test(barcode)
                    ? "Código de barras (mín. 5 dígitos)"
                    : "Nombre del producto (mín. 3 caracteres)"
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: "text.secondary", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 2,
                    background: isDark
                      ? "rgba(30,41,59,0.4)"
                      : "rgba(241,245,249,0.7)",
                    fontSize: "0.9rem",
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-input": { py: 1.2, textAlign: "center" },
                }}
              />

              <Stack
                direction="row"
                spacing={0.5}
                justifyContent="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: 1.5 }}
              >
                {[
                  ["F1", "Ayuda"],
                  ["F2", "Sin código"],
                  ["F8", "Vender"],
                ].map(([key, label]) => (
                  <Chip
                    key={key}
                    label={`${key} ${label}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 20,
                      fontSize: "0.55rem",
                      color: "text.secondary",
                      borderColor: isDark
                        ? "rgba(148,163,184,0.12)"
                        : "rgba(148,163,184,0.25)",
                    }}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", mt: 2 }}>
              {showSuggestions && searchResults.length > 0 && (
                <Box sx={{ animation: "fadeIn 0.2s ease-out" }}>
                  {searchResults.slice(0, 8).map((product, index) => (
                    <ListItemButton
                      key={product.id}
                      selected={index === selectedSuggestionIndex}
                      onClick={() => {
                        addProductToCart(product);
                        setBarcode("");
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                      sx={{
                        py: 1.2,
                        px: 2,
                        borderRadius: 1,
                        mb: 0.5,
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
                            sx={{ fontWeight: 500, fontSize: "0.85rem" }}
                          >
                            {product.name}
                            {product.sale_unit === "weight" && (
                              <Chip
                                label="kg"
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  height: 16,
                                  fontSize: "0.5rem",
                                  bgcolor: "rgba(59,130,246,0.12)",
                                  color: theme.palette.primary.main,
                                  fontWeight: 700,
                                }}
                              />
                            )}
                            {product.sale_unit === "box" && (
                              <Chip
                                label="caja"
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  height: 16,
                                  fontSize: "0.5rem",
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
                              fontSize: "0.85rem",
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
                    sx={{ fontSize: 40, color: "text.secondary", mb: 1 }}
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
                      sx={{ fontSize: 40, color: "text.secondary", mb: 1 }}
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
        onClose={() => setWeightDialog({ open: false, product: null })}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && parseFloat(weightAmount) > 0)
            confirmWeightProduct();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MonitorWeight sx={{ color: theme.palette.primary.main }} />
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
                  <strong>${weightDialog.product.price.toFixed(2)} / kg</strong>
                </Typography>
                {weightDialog.product.discount_percent > 0 && (
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
                type="number"
                value={weightAmount}
                onChange={(e) => setWeightAmount(e.target.value)}
                autoFocus
                inputProps={{ step: 0.001, min: 0.001 }}
                sx={{ mb: 2 }}
              />
              {parseFloat(weightAmount) > 0 && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
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
                    {(
                      (weightDialog.product.discount_percent > 0
                        ? calcFinalPrice(
                            weightDialog.product.price,
                            weightDialog.product.discount_percent,
                          )
                        : weightDialog.product.price) * parseFloat(weightAmount)
                    ).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${weightDialog.product.price.toFixed(2)} ×{" "}
                    {parseFloat(weightAmount).toFixed(3)} kg
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
            startIcon={<MonitorWeight />}
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
        open={boxChoiceDialog.open}
        onClose={() => setBoxChoiceDialog({ open: false, product: null })}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleBoxChoice(false);
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
            <Store sx={{ color: theme.palette.primary.main }} />
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
                  sx={{ mt: 1 }}
                >
                  <Chip
                    label={`Caja: $${boxChoiceDialog.product.box_price?.toFixed(2)}`}
                    variant="outlined"
                    size="small"
                    color="primary"
                  />
                  <Chip
                    label={`Pieza: $${boxChoiceDialog.product.price.toFixed(2)}`}
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
                    {boxChoiceDialog.product.box_qty} piezas por caja
                  </Typography>
                )}
              </Box>
              <Stack direction="column" spacing={1.5}>
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
                    <span>Caja</span>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 400, opacity: 0.7 }}
                    >
                      ${boxChoiceDialog.product.box_price?.toFixed(2)}
                    </Typography>
                  </Stack>
                </Button>
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
                      ${boxChoiceDialog.product.price.toFixed(2)}
                    </Typography>
                  </Stack>
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton
            onClick={() => setBoxChoiceDialog({ open: false, product: null })}
          >
            Cancelar
          </CancelButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cashDialogOpen}
        onClose={() => setCashDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && cashAmount && change >= 0)
            handleCashConfirm();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AttachMoney sx={{ color: theme.palette.success.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Pago en Efectivo
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 1 }}>
            <Typography
              variant="h4"
              sx={{
                textAlign: "center",
                mb: 2,
                color: theme.palette.success.main,
                fontWeight: 800,
              }}
            >
              Total: ${total.toFixed(2)}
            </Typography>
            {discountTotal > 0 && (
              <Typography
                variant="body2"
                color="error"
                textAlign="center"
                sx={{ mb: 2 }}
              >
                Descuento aplicado: -${discountTotal.toFixed(2)}
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
                setChange(a - total);
              }}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
                sx: { fontSize: "1.5rem", fontWeight: 700 },
              }}
              inputProps={{ step: "0.01", min: "0" }}
              sx={{ mt: 1 }}
            />
            {cashAmount && (
              <Alert
                severity={change >= 0 ? "success" : "error"}
                sx={{ mt: 2 }}
              >
                {change >= 0 ? (
                  <>
                    Cambio: <strong>${change.toFixed(2)}</strong>
                  </>
                ) : (
                  <>
                    Falta: <strong>${Math.abs(change).toFixed(2)}</strong>
                  </>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setCashDialogOpen(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={handleCashConfirm}
            variant="outlined"
            disabled={!cashAmount || change < 0}
            startIcon={<CheckCircle />}
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
        </DialogActions>
      </Dialog>

      <Dialog
        open={manualProductModalOpen}
        onClose={() => setManualProductModalOpen(false)}
        maxWidth="sm"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && manualProduct.name && manualProduct.price)
            handleManualProduct();
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QrCode sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Producto Sin Código
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 1 }}>
            <TextField
              label="Nombre del producto"
              value={manualProduct.name}
              onChange={(e) =>
                setManualProduct({ ...manualProduct, name: e.target.value })
              }
              autoFocus
            />
            <TextField
              label="Precio"
              type="number"
              value={manualProduct.price}
              onChange={(e) =>
                setManualProduct({ ...manualProduct, price: e.target.value })
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              inputProps={{ step: "0.01", min: "0" }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setManualProductModalOpen(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={handleManualProduct}
            variant="outlined"
            disabled={!manualProduct.name || !manualProduct.price}
            startIcon={<AddCircleOutline />}
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
