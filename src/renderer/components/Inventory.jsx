import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Card,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  useTheme,
  TablePagination,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Avatar,
  Grid,
  Fade,
  Divider,
  MenuItem,
  LinearProgress,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Search,
  Download,
  PlusCircle,
  Eye,
  Pencil,
  Plus,
  Minus,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Store,
  Warehouse,
  Package,
  Banknote,
  TriangleAlert,
  Percent,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import AddProductModal from "./AddProductModal";
import { TableSkeleton, CardSkeleton } from "./Skeletons";
import {
  tableContainerSx,
  darkHeaderCellSx,
  darkHeaderCellSortableSx,
} from "./tableStyles";
import CancelButton from "./CancelButton";
import { useToast } from "./ToastProvider";
import { useCashier } from "../contexts/CashierContext";
import { mxToday, formatMXTime } from "../utils/dateUtils";
import { isContainerUnit, unitLabels } from "../utils/unitLabels";

const Inventory = () => {
  const notify = useToast();
  const { cashier } = useCashier();
  const isAdmin = cashier?.role === "admin";
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalValue: 0,
    lowStockCount: 0,
    discountedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [scrollInfo, setScrollInfo] = useState({ top: 0, height: 600 });
  const tableScrollRef = useRef(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [daySummary, setDaySummary] = useState(null);
  const [showAdds, setShowAdds] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [stockRegisterExpense, setStockRegisterExpense] = useState(
    () => localStorage.getItem("stockRegisterExpense") === "true",
  );
  const [costConfirmOpen, setCostConfirmOpen] = useState(false);
  const [stockCostConfirm, setStockCostConfirm] = useState(null);
  const [reduceModalOpen, setReduceModalOpen] = useState(false);
  const [reduceQty, setReduceQty] = useState("");
  const [reduceNote, setReduceNote] = useState("");
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const PAGE_SIZE = 25;
  const ROW_HEIGHT = 52;
  const isFiltered =
    Boolean(debouncedSearch) ||
    Boolean(selectedCategory) ||
    Boolean(selectedSupplier);
  const pageSize = isFiltered ? PAGE_SIZE : rowsPerPage;
  const scanBufferRef = useRef("");
  const scanTimeoutRef = useRef(null);
  const [initialBarcode, setInitialBarcode] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const [result, cats, sups] = await Promise.all([
      window.api.invoke("get-products", {
        search: debouncedSearch || undefined,
        category_id: selectedCategory || undefined,
        supplier_id: selectedSupplier || undefined,
        sortField,
        sortDir,
        page,
        rowsPerPage: pageSize,
      }),
      window.api.invoke("get-categories"),
      window.api.invoke("get-suppliers"),
    ]);
    setProducts(result.products);
    setTotal(result.total);
    setStats(
      result.stats || {
        totalCount: 0,
        totalValue: 0,
        lowStockCount: 0,
        discountedCount: 0,
      },
    );
    setCategories(cats || []);
    setSuppliers(sups || []);
    setLoading(false);
  }, [
    debouncedSearch,
    selectedCategory,
    selectedSupplier,
    sortField,
    sortDir,
    page,
    rowsPerPage,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (viewDetailsOpen && selectedProduct) {
      setDaySummary(null);
      setShowAdds(false);
      window.api
        .invoke("get-product-day-summary", { productId: selectedProduct.id })
        .then(setDaySummary)
        .catch(() => setDaySummary(null));
    }
  }, [viewDetailsOpen, selectedProduct]);

  useEffect(() => {
    const handler = () => setIsModalOpen(true);
    window.addEventListener("ctrl-n", handler);
    return () => window.removeEventListener("ctrl-n", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.key === "Enter") {
        const code = scanBufferRef.current;
        scanBufferRef.current = "";
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        if (code.length >= 3) {
          (async () => {
            const result = await window.api.invoke(
              "get-product-by-barcode",
              code,
            );
            if (result.success && result.product) {
              setSelectedProduct(result.product);
              setStockQuantity("");
              setStockCost("");
              setStockModalOpen(true);
            } else {
              setInitialBarcode(code);
              setIsModalOpen(true);
            }
          })();
        }
        return;
      }

      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          scanBufferRef.current = "";
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(0);
    setScrollInfo({ top: 0, height: 600 });
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  }, [searchTerm, selectedCategory, selectedSupplier]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    setScrollInfo({ top: el.scrollTop, height: el.clientHeight });
    if (
      isFiltered &&
      !loading &&
      page + 1 < Math.ceil(total / pageSize) &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 80
    ) {
      setPage((p) => p + 1);
      el.scrollTop = 0;
      setScrollInfo({ top: 0, height: el.clientHeight });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    if (isFiltered) {
      setPage(0);
      setScrollInfo({ top: 0, height: 600 });
      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ArrowUp size={14} style={{ marginLeft: 3 }} />
    ) : (
      <ArrowDown size={14} style={{ marginLeft: 3 }} />
    );
  };

  const handleProductAdded = () => {
    fetchProducts();
    notify("Producto guardado correctamente.", "success");
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setViewDetailsOpen(true);
  };
  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setEditModalOpen(true);
  };
  const handleDeleteProduct = (product) => {
    setSelectedProduct(product);
    setDeleteConfirmOpen(true);
  };
  const handleAddStock = (product) => {
    setSelectedProduct(product);
    setStockQuantity("");
    setStockCost("");
    setStockRegisterExpense(false);
    setStockModalOpen(true);
  };
  const handleReduceStock = (product) => {
    setSelectedProduct(product);
    setReduceQty("");
    setReduceNote("");
    setReduceModalOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedProduct) {
      const result = await window.api.invoke(
        "delete-product",
        selectedProduct.id,
      );
      if (!result?.success) {
        notify(result?.error || "No se pudo eliminar el producto", "error");
      } else {
        notify("Producto eliminado correctamente.", "success");
      }
      fetchProducts();
      setDeleteConfirmOpen(false);
      setSelectedProduct(null);
    }
  };

  const doAddStock = async (updateCostPrice) => {
    if (!selectedProduct || stockQuantity <= 0) return;
    const actualQty =
      isContainerUnit(selectedProduct.sale_unit) && selectedProduct.box_qty > 0
        ? stockQuantity * selectedProduct.box_qty
        : stockQuantity;
    const costNum = parseFloat(stockCost) || 0;
    const totalCost =
      costNum > 0
        ? costNum
        : isContainerUnit(selectedProduct.sale_unit) &&
            selectedProduct.box_qty > 0
          ? ((selectedProduct.cost_price || 0) / selectedProduct.box_qty) *
            actualQty
          : (selectedProduct.cost_price || 0) * actualQty;
    const result = await window.api.invoke("add-stock", {
      productId: selectedProduct.id,
      quantity: actualQty,
      cost: costNum,
      cashierId: cashier?.id,
      registerExpense: stockRegisterExpense,
      updateCostPrice,
    });
    if (result.success) {
      setStockModalOpen(false);
      setSelectedProduct(null);
      fetchProducts();
      if (!stockRegisterExpense) {
        notify("Stock agregado. No se registró gasto en caja.", "info");
      } else {
        notify("Stock agregado y gasto registrado.", "success");
      }
    } else {
      notify(result.error, "error");
    }
  };

  const confirmAddStock = async () => {
    if (!selectedProduct || stockQuantity <= 0) return;
    const isBox =
      isContainerUnit(selectedProduct.sale_unit) &&
      selectedProduct.box_qty > 0;
    const costNum = parseFloat(stockCost) || 0;
    if (costNum > 0) {
      const expected = (selectedProduct.cost_price || 0) * stockQuantity;
      const diff = costNum - expected;
      if (Math.abs(diff) >= 1) {
        setStockCostConfirm({
          oldCost: selectedProduct.cost_price || 0,
          newCost: Math.round((costNum / stockQuantity + Number.EPSILON) * 100) / 100,
          direction: diff > 0 ? "subio" : "bajo",
          isBox,
          saleUnit: selectedProduct.sale_unit,
        });
        setCostConfirmOpen(true);
        return;
      }
    }
    await doAddStock(null);
  };

  const handleCostConfirmYes = async () => {
    const confirm = stockCostConfirm;
    setCostConfirmOpen(false);
    setStockCostConfirm(null);
    await doAddStock(confirm?.newCost ?? null);
  };

  const handleCostConfirmNo = async () => {
    setCostConfirmOpen(false);
    setStockCostConfirm(null);
    await doAddStock(null);
  };

  const confirmRemoveStock = async () => {
    if (!selectedProduct || reduceQty <= 0) return;
    const actualQty =
      isContainerUnit(selectedProduct.sale_unit) && selectedProduct.box_qty > 0
        ? reduceQty * selectedProduct.box_qty
        : reduceQty;
    const result = await window.api.invoke("remove-stock", {
      productId: selectedProduct.id,
      quantity: actualQty,
      notes: reduceNote.trim() || "Salida de stock",
      role: cashier?.role,
      cashierId: cashier?.id,
    });
    if (result.success) {
      setReduceModalOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } else {
      notify(result.error, "error");
    }
  };

  const getStockStatus = (stock, minStock) => {
    const min = minStock || 5;
    if (stock === 0) return { label: "Agotado", color: "error" };
    if (stock <= min) return { label: "Stock Bajo", color: "warning" };
    return { label: "En Stock", color: "success" };
  };

  const calcDiscountedPrice = (price, discount) =>
    price * (1 - (discount || 0) / 100);

  const calcMarginPct = (p) => {
    if (!p) return null;
    const isBoxProd = isContainerUnit(p.sale_unit) && p.box_qty > 0;
    const showBox = isBoxProd && p.stock >= p.box_qty;
    const saleBase = isBoxProd ? (showBox ? p.box_price : p.price) : p.price;
    const costBase = isBoxProd
      ? showBox
        ? p.cost_price
        : p.cost_price / p.box_qty
      : p.cost_price;
    if (!costBase) return null;
    return ((saleBase - costBase) / costBase) * 100;
  };
  const fmtKg = (kg) => (Math.round(kg * 1000) / 1000).toFixed(3);
  const stockUnit = (p) => {
    if (p.sale_unit === "weight") return "kg";
    if (isContainerUnit(p.sale_unit)) return unitLabels(p.sale_unit).plural;
    return "pz";
  };
  const stockDisplay = (p) => {
    if (isContainerUnit(p.sale_unit) && p.box_qty > 0 && p.stock >= p.box_qty)
      return `${Math.floor(p.stock / p.box_qty)} ${unitLabels(p.sale_unit).plural} (${p.stock} pz)`;
    if (p.pack_qty > 0 && p.stock >= p.pack_qty)
      return `${Math.floor(p.stock / p.pack_qty)} paquetes (${p.stock} pz)`;
    if (p.sale_unit === "weight") return `${fmtKg(p.stock)} kg`;
    return `${p.stock} pz`;
  };
  const fmtStock = (p, qty) => {
    if (isContainerUnit(p.sale_unit) && p.box_qty > 0 && qty >= p.box_qty)
      return `${Math.floor(qty / p.box_qty)} ${unitLabels(p.sale_unit).plural} (${qty} pz)`;
    if (p.pack_qty > 0 && qty >= p.pack_qty)
      return `${Math.floor(qty / p.pack_qty)} paquetes (${qty} pz)`;
    if (p.sale_unit === "weight") return `${fmtKg(qty)} kg`;
    return `${qty} pz`;
  };
  const fmtStockNumber = (p, qty) => {
    if (isContainerUnit(p.sale_unit) && p.box_qty > 0 && qty >= p.box_qty)
      return Math.floor(qty / p.box_qty);
    if (p.pack_qty > 0 && qty >= p.pack_qty)
      return Math.floor(qty / p.pack_qty);
    if (p.sale_unit === "weight") return fmtKg(qty);
    return qty;
  };
  const stockUnitCompact = (p) => {
    if (isContainerUnit(p.sale_unit) && p.box_qty > 0 && p.stock >= p.box_qty)
      return unitLabels(p.sale_unit).plural;
    if (p.pack_qty > 0 && p.stock >= p.pack_qty) return "paquetes";
    if (p.sale_unit === "weight") return "kg";
    return "pz";
  };
  const fmtDateShort = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };
  const boxPriceDisplay = (p) =>
    isContainerUnit(p.sale_unit) && p.box_qty > 0 && p.stock >= p.box_qty
      ? p.box_price
      : p.price;

  const exportInventoryCSV = async () => {
    const result = await window.api.invoke("get-all-products");
    const allProducts = result.products || [];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header =
      "ID,Nombre,Marca,Categoría,Proveedor,Precio,Rebaja %,Precio Final,Stock,Unidad,Stock Mínimo,Código de Barras\n";
    const rows = allProducts
      .map((p) => {
        const finalPrice = calcDiscountedPrice(p.price, p.discount_percent);
        return [
          p.id,
          esc(p.name),
          esc(p.brand),
          esc(p.category_name),
          esc(p.supplier_name),
          Number(p.price || 0).toFixed(2),
          Number(p.discount_percent || 0),
          finalPrice.toFixed(2),
          p.sale_unit === "weight" ? fmtKg(p.stock) : p.stock,
          stockUnit(p),
          p.min_stock || 5,
          esc(p.barcode),
        ].join(",");
      })
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-completo-${mxToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderProductRow = (product) => {
    const stockStatus = getStockStatus(product.stock, product.min_stock);
    const finalPrice = calcDiscountedPrice(
      product.price,
      product.discount_percent,
    );
    return (
      <TableRow
        key={product.id}
        sx={{
          height: isFiltered ? ROW_HEIGHT : undefined,
          "& .MuiTableCell-root": {
            py: isFiltered ? 0.8 : 1.5,
          },
          "&:hover": {
            backgroundColor: isDark
              ? "rgba(59, 130, 246, 0.06)"
              : "rgba(37, 99, 235, 0.04)",
          },
        }}
      >
        <TableCell>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              overflow: "hidden",
            }}
          >
            <Avatar
              src={product.image_path || undefined}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "2px",
                bgcolor: "rgba(59, 130, 246, 0.12)",
                flexShrink: 0,
              }}
            >
              <Package
                size={18}
                color={theme.palette.primary.main}
              />
            </Avatar>
            <Box sx={{ minWidth: 0, overflow: "hidden" }}>
              <Typography
                variant="body2"
                component="div"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  ...(isFiltered
                    ? {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }
                    : {}),
                }}
              >
                {product.name}
                {product.sale_unit === "weight" && (
                  <Chip
                    label="kg"
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 22,
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      bgcolor: "rgba(59,130,246,0.12)",
                      color: theme.palette.primary.main,
                      fontWeight: 700,
                    }}
                  />
                )}
                {isContainerUnit(product.sale_unit) && (
                  <Chip
                    label={unitLabels(product.sale_unit).badge}
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 18,
                      fontSize: "0.55rem",
                      textTransform: "uppercase",
                      bgcolor: "rgba(16,185,129,0.12)",
                      color: theme.palette.success.main,
                      fontWeight: 700,
                    }}
                  />
                )}
                {product.discount_percent > 0 && (
                  <Chip
                    label={`-${product.discount_percent}%`}
                    color="error"
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 20,
                      fontSize: "0.65rem",
                    }}
                  />
                )}
                {product.pack_qty > 0 && product.sale_unit === "boxpack" && (
                  <Chip
                    label="paquete"
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 18,
                      fontSize: "0.55rem",
                      textTransform: "uppercase",
                      bgcolor: "rgba(168,85,247,0.12)",
                      color: theme.palette.secondary.main,
                      fontWeight: 700,
                    }}
                  />
                )}
                {product.prices?.length > 0 && (
                  <Chip
                    label="Mayoreo"
                    size="small"
                    sx={{
                      ml: 0.5,
                      height: 18,
                      fontSize: "0.55rem",
                      textTransform: "uppercase",
                      bgcolor: "rgba(245,158,11,0.14)",
                      color: "#d97706",
                      fontWeight: 700,
                    }}
                  />
                )}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {product.brand || ""}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell align="right">
          {product.discount_percent > 0 ? (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  textDecoration: "line-through",
                  color: "text.secondary",
                  display: "block",
                }}
              >
                ${product.price.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.error.light,
                }}
              >
                ${finalPrice.toFixed(2)}
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              ${boxPriceDisplay(product).toFixed(2)}
            </Typography>
          )}
        </TableCell>
        <TableCell align="center" sx={{ minWidth: 150 }}>
          <Typography variant="body2">
            {Number.isFinite(product.startOfDay)
              ? `${fmtStockNumber(product, product.stock)} / ${fmtStockNumber(product, product.startOfDay)}`
              : fmtStockNumber(product, product.stock)}{" "}
            <Box
              component="span"
              sx={{ fontWeight: 400, color: "text.secondary" }}
            >
              {stockUnitCompact(product)}
            </Box>
          </Typography>
          {(product.todayIn > 0 || product.todaySold > 0) && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 0.75,
                mt: 0.25,
              }}
            >
              {product.todayIn > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "#10b981",
                    fontWeight: 700,
                    fontSize: "0.65rem",
                  }}
                >
                  +{product.todayIn} hoy
                </Typography>
              )}
              {product.todaySold > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "#ef4444",
                    fontWeight: 700,
                    fontSize: "0.65rem",
                  }}
                >
                  -{product.todaySold} ventas
                </Typography>
              )}
            </Box>
          )}
          <LinearProgress
            variant="determinate"
            value={Math.min(
              (product.startOfDay || 0) > 0
                ? (product.stock / product.startOfDay) * 100
                : 100,
              100,
            )}
            sx={{
              mt: 0.5,
              height: 8,
              borderRadius: "12px",
              bgcolor:
                product.stock <= (product.min_stock || 5)
                  ? "rgba(185,28,28,0.15)"
                  : product.stock <= (product.min_stock || 5) * 2
                    ? "rgba(245,158,11,0.15)"
                    : isDark
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(59,130,246,0.12)",
              "& .MuiLinearProgress-bar": {
                bgcolor:
                  product.stock <= (product.min_stock || 5)
                    ? "#b91c1c"
                    : product.stock <= (product.min_stock || 5) * 2
                      ? "#f59e0b"
                      : "#1E293B",
              },
            }}
          />
        </TableCell>
        <TableCell align="center">
          <Chip
            label={stockStatus.label}
            color={stockStatus.color}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.65rem" }}
          />
        </TableCell>
        <TableCell align="center">
          <Stack
            direction="row"
            spacing={0.3}
            justifyContent="center"
          >
            <Tooltip title="Ver Detalles">
              <IconButton
                size="small"
                onClick={() => handleViewDetails(product)}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0.5,
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  "&:hover": {
                    color: "primary.main",
                    bgcolor: isDark
                      ? "rgba(59,130,246,0.10)"
                      : "rgba(59,130,246,0.08)",
                  },
                }}
              >
                <Eye size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar">
              <IconButton
                size="small"
                onClick={() => handleEditProduct(product)}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0.5,
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  "&:hover": {
                    color: "primary.main",
                    bgcolor: isDark
                      ? "rgba(59,130,246,0.10)"
                      : "rgba(59,130,246,0.08)",
                  },
                }}
              >
                <Pencil size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Agregar Stock">
              <IconButton
                size="small"
                onClick={() => handleAddStock(product)}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0.5,
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  "&:hover": {
                    color: "success.main",
                    bgcolor: isDark
                      ? "rgba(16,185,129,0.10)"
                      : "rgba(16,185,129,0.08)",
                  },
                }}
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title={isAdmin ? "Reducir Stock" : "Solo el propietario puede reducir stock"}>
              <IconButton
                size="small"
                disabled={!isAdmin}
                onClick={() => handleReduceStock(product)}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0.5,
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  "&:hover": {
                    color: "warning.main",
                    bgcolor: isDark
                      ? "rgba(245,158,11,0.10)"
                      : "rgba(245,158,11,0.08)",
                  },
                }}
              >
                <Minus size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteProduct(product)}
                sx={{
                  p: 0.5,
                  width: 32,
                  height: 32,
                  color: "text.secondary",
                  "&:hover": {
                    color: "error.main",
                    bgcolor: isDark
                      ? "rgba(239,68,68,0.10)"
                      : "rgba(239,68,68,0.08)",
                  },
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>
    );
  };

  const startIndex = isFiltered
    ? Math.max(0, Math.floor(scrollInfo.top / ROW_HEIGHT) - 3)
    : 0;
  const visibleRows = Math.ceil(scrollInfo.height / ROW_HEIGHT) + 6;
  const endIndex = isFiltered
    ? Math.min(products.length, startIndex + visibleRows)
    : products.length;

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mb: 2 }}
      >
        <Button
          variant="outlined"
          startIcon={<Download size={16} />}
          onClick={exportInventoryCSV}
          sx={{
            px: 2,
            py: 0.8,
            borderRadius: "4px",
            borderColor: "#9ca3af",
            color: isDark ? "#e2e8f0" : "#0f172a",
            bgcolor: isDark ? "rgba(17,24,39,0.6)" : "#ffffff",
            "&:hover": {
              bgcolor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(15,23,42,0.08)",
            },
          }}
        >
          Exportar
        </Button>
        <Button
          variant="contained"
          startIcon={<PlusCircle size={20} />}
          onClick={() => setIsModalOpen(true)}
          sx={{ px: 2, py: 0.8, borderRadius: "4px" }}
        >
          Nuevo Producto
        </Button>
        <Chip
          label="Ctrl+N"
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
      </Stack>

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              {
                label: "Total Productos",
                value: stats.totalCount,
                icon: Package,
                color: theme.palette.primary.main,
              },
              {
                label: "Stock Bajo",
                value: stats.lowStockCount,
                icon: TriangleAlert,
                color: theme.palette.error.main,
              },
              {
                label: "En Rebaja",
                value: stats.discountedCount,
                icon: Percent,
                color: theme.palette.warning.main,
              },
            ].map((s) => (
              <Grid size={{ xs: 12, md: 4 }} key={s.label}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: "6px",
                    overflow: "hidden",
                    position: "relative",
                    border: "1px solid",
                    borderColor: "divider",
                    background: `linear-gradient(135deg, ${s.color}14 0%, transparent 55%)`,
                    transition: "transform 0.22s ease, box-shadow 0.22s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: (th) => th.shadows[6],
                    },
                  }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          fontSize: "11px",
                          color: "text.secondary",
                        }}
                      >
                        {s.label}
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: "1.75rem", md: "2rem" },
                          color: "text.primary",
                          lineHeight: 1.1,
                          mt: 0.5,
                        }}
                      >
                        {s.value}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `linear-gradient(135deg, ${s.color}22, ${s.color}40)`,
                        boxShadow: `0 4px 14px ${s.color}33`,
                        flexShrink: 0,
                      }}
                    >
                      <s.icon size={22} color={s.color} />
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
          </Fade>
      )}

      <Card
        variant="outlined"
        sx={{
          mb: 2,
          p: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          borderRadius: "6px",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          sx={{ flex: 1, width: "100%" }}
        >
          <TextField
            variant="outlined"
            size="small"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            sx={{ width: 160 }}
          >
            <MenuItem value="">Todas las categorías</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            sx={{ width: 170 }}
          >
            <MenuItem value="">Todos los proveedores</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
))}
          </TextField>
        </Stack>
      </Card>

      {!loading && stats.lowStockCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
          <Typography variant="body2">
            <strong>{stats.lowStockCount}</strong> producto(s) con stock bajo
          </Typography>
        </Alert>
      )}

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Card
            sx={
              isFiltered
                ? {
                    ...tableContainerSx,
                    height: "calc(100vh - 420px)",
                    minHeight: 280,
                    display: "flex",
                    flexDirection: "column",
                  }
                : tableContainerSx
            }
          >
            <TableContainer
              ref={isFiltered ? tableScrollRef : undefined}
              onScroll={isFiltered ? handleScroll : undefined}
              sx={
                isFiltered
                  ? { flex: 1, maxHeight: "100%", overflowY: "auto" }
                  : undefined
              }
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={darkHeaderCellSortableSx}
                      onClick={() => handleSort("name")}
                    >
                      Producto <SortIcon field="name" />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={darkHeaderCellSortableSx}
                      onClick={() => handleSort("price")}
                    >
                      Precio <SortIcon field="price" />
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={darkHeaderCellSortableSx}
                      onClick={() => handleSort("stock")}
                    >
                      Stock <SortIcon field="stock" />
                    </TableCell>
                    <TableCell align="center" sx={darkHeaderCellSx}>
                      Estado
                    </TableCell>
                    <TableCell align="center" sx={darkHeaderCellSx}>
                      Acciones
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Box sx={{ py: 6, textAlign: "center" }}>
                          <Store
                            sx={{
                              fontSize: 48,
                              color: "text.secondary",
                              mb: 1,
                            }}
                          />
                          <Typography
                            variant="body1"
                            color="textSecondary"
                            sx={{ mb: 0.5 }}
                          >
                            No hay productos registrados
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Agrega tu primer producto usando el botón "Añadir
                            Producto"
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  {isFiltered && products.length > 0 ? (
                    <>
                      {startIndex > 0 && (
                        <TableRow sx={{ height: startIndex * ROW_HEIGHT }}>
                          <TableCell
                            colSpan={5}
                            sx={{ borderBottom: "none", py: 0 }}
                          />
                        </TableRow>
                      )}
                      {products.slice(startIndex, endIndex).map(renderProductRow)}
                      {endIndex < products.length && (
                        <TableRow
                          sx={{ height: (products.length - endIndex) * ROW_HEIGHT }}
                        >
                          <TableCell
                            colSpan={5}
                            sx={{ borderBottom: "none", py: 0 }}
                          />
                        </TableRow>
                      )}
                    </>
                  ) : (
                    products.map(renderProductRow)
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={isFiltered ? [PAGE_SIZE] : [5, 10, 25, 50]}
              component="div"
              count={total}
              rowsPerPage={pageSize}
              page={page}
              onPageChange={(e, p) => {
                setPage(p);
                if (isFiltered && tableScrollRef.current) {
                  tableScrollRef.current.scrollTop = 0;
                }
                setScrollInfo({ top: 0, height: 600 });
              }}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Filas:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count}`
              }
            />
          </Card>
        </Fade>
      )}

      <AddProductModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setInitialBarcode("");
        }}
        onProductAdded={() => {
          handleProductAdded();
          setInitialBarcode("");
        }}
        initialBarcode={initialBarcode}
      />
      <AddProductModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedProduct(null);
        }}
        onProductAdded={handleProductAdded}
        editProduct={selectedProduct}
      />

      <Dialog
        open={viewDetailsOpen}
        onClose={() => setViewDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            overflow: "hidden",
            bgcolor: isDark ? "#16181d" : "#f4f4f5",
            maxHeight: "90vh",
          },
        }}
      >
        {selectedProduct && (
          <Box
            sx={{ display: "flex", flexDirection: { xs: "column", md: "row" } }}
          >
            {/* ── Product Visual Area (40%) ── */}
            <Box
              sx={{
                width: { xs: "100%", md: "40%" },
                bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#ececee",
                borderRight: { md: "1px solid" },
                borderBottom: { xs: "1px solid", md: "none" },
                borderColor: "divider",
                p: { xs: 4, md: 5 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Box sx={{ position: "absolute", top: 20, left: 20 }}>
                <Chip
                  size="small"
                  label={
                    getStockStatus(
                      selectedProduct.stock,
                      selectedProduct.min_stock,
                    ).label
                  }
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.62rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    height: 20,
                    bgcolor:
                      getStockStatus(
                        selectedProduct.stock,
                        selectedProduct.min_stock,
                      ).color === "success"
                        ? isDark
                          ? "rgba(16,185,129,0.15)"
                          : "#dcfce7"
                        : getStockStatus(
                              selectedProduct.stock,
                              selectedProduct.min_stock,
                            ).color === "warning"
                          ? isDark
                            ? "rgba(245,158,11,0.15)"
                            : "#fef3c7"
                          : isDark
                            ? "rgba(239,68,68,0.15)"
                            : "#fee2e2",
                    color:
                      getStockStatus(
                        selectedProduct.stock,
                        selectedProduct.min_stock,
                      ).color === "success"
                        ? "#059669"
                        : getStockStatus(
                              selectedProduct.stock,
                              selectedProduct.min_stock,
                            ).color === "warning"
                          ? "#b45309"
                          : "#dc2626",
                  }}
                />
              </Box>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  fontSize: "1.6rem",
                  lineHeight: 1.15,
                  textAlign: "center",
                  mb: 3,
                  wordBreak: "break-word",
                }}
              >
                {selectedProduct.name}
              </Typography>

              <Box
                sx={{
                  width: 140,
                  height: 140,
                  borderRadius: "12px",
                  bgcolor: isDark
                    ? "rgba(59,130,246,0.08)"
                    : "rgba(37,99,235,0.05)",
                  border: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Package size={64} color={isDark ? "#64748b" : "#94a3b8"} />
              </Box>

              <Box sx={{ mt: 5, width: "100%" }}>
                <Box
                  sx={{
                    bgcolor: "background.paper",
                    p: 2,
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box sx={{ textAlign: "center" }}>
                    {/* ── Stock actual: grande y centrado ── */}
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontSize: "0.55rem",
                      }}
                    >
                      Stock Actual
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        mt: 0.5,
                      }}
                    >
                      <Box />
                      <Box sx={{ textAlign: "center" }}>
                        <Typography
                          variant="h4"
                          sx={{
                            fontWeight: 800,
                            color: "primary.main",
                            fontSize: "1.7rem",
                            lineHeight: 1.2,
                          }}
                        >
                          {isContainerUnit(selectedProduct.sale_unit) &&
                          selectedProduct.box_qty > 0
                            ? stockDisplay(selectedProduct)
                            : selectedProduct.sale_unit === "weight"
                              ? fmtKg(selectedProduct.stock)
                              : selectedProduct.stock}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontSize: "1rem" }}
                        >
                          {stockUnit(selectedProduct)}
                        </Typography>
                      </Box>
                      <Box sx={{ pl: 1 }}>
                        {daySummary && daySummary.lastChange && (() => {
                          const badgeDelta = daySummary.lastChange.isToday
                            ? daySummary.lastChange.delta >= 0
                              ? daySummary.todayIn
                              : daySummary.todayOut
                            : daySummary.lastChange.delta;
                          return (
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              px: 1.5,
                              py: 0.5,
                              borderRadius: "4px",
                              bgcolor: isDark
                                ? badgeDelta >= 0
                                  ? "rgba(16,185,129,0.12)"
                                  : "rgba(239,68,68,0.15)"
                                : badgeDelta >= 0
                                  ? "#d1fae5"
                                  : "#fee2e2",
                              color:
                                badgeDelta >= 0
                                  ? "#059669"
                                  : "#dc2626",
                              fontWeight: 700,
                              fontSize: "0.65rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {badgeDelta >= 0 ? (
                              <Plus size={12} strokeWidth={3} />
                            ) : (
                              <Minus size={12} strokeWidth={3} />
                            )}
                            {Math.abs(badgeDelta)}
                            {daySummary.lastChange.isToday && (
                              <Box
                                component="span"
                                sx={{
                                  ml: 0.75,
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  opacity: 0.9,
                                }}
                              >
                                hoy
                              </Box>
                            )}
                          </Box>
                          );
                        })()}
                      </Box>
                    </Box>
                  </Box>

                  {daySummary && daySummary.lastChange && (
                    <Typography
                      variant="body2"
                      sx={{
                        textAlign: "center",
                        color: "text.secondary",
                        fontSize: "0.72rem",
                        mt: 1,
                      }}
                    >
                      Stock previo:{" "}
                      <Typography
                        component="span"
                        sx={{ fontWeight: 700, color: "text.primary" }}
                      >
                        {fmtStock(selectedProduct, daySummary.previo)}
                      </Typography>
                    </Typography>
                  )}

                  {daySummary &&
                    daySummary.lastChange &&
                    daySummary.showHistory &&
                    daySummary.adds.length > 0 && (
                      <Box
                        sx={{
                          mt: 1.5,
                          borderTop: "1px solid",
                          borderColor: "divider",
                          pt: 1,
                          textAlign: "center",
                        }}
                      >
                        <Button
                          size="small"
                          startIcon={<History size={13} />}
                          endIcon={
                            showAdds ? (
                              <ChevronUp size={13} />
                            ) : (
                              <ChevronDown size={13} />
                            )
                          }
                          onClick={() => setShowAdds((v) => !v)}
                          sx={{
                            fontSize: "0.65rem",
                            textTransform: "none",
                            color: "text.secondary",
                            p: 0,
                            minWidth: 0,
                          }}
                        >
                          {showAdds
                            ? "Ocultar cargas"
                            : `Ver cargas ${daySummary.isToday ? "de hoy" : `del ${fmtDateShort(daySummary.lastDay)}`}`}
                        </Button>
                        {showAdds && (
                          <Box sx={{ mt: 0.5 }}>
                            {daySummary.adds.map((a, idx) => (
                              <Stack
                                key={idx}
                                direction="row"
                                spacing={1}
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{ py: 0.25 }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <Clock size={11} color="#94a3b8" />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: "text.secondary",
                                      fontFamily: "monospace",
                                      fontSize: "0.62rem",
                                    }}
                                  >
                                    {formatMXTime(a.created_at)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 700,
                                      color: "#34d399",
                                      fontSize: "0.68rem",
                                    }}
                                  >
                                    +{fmtStock(selectedProduct, a.quantity)}
                                  </Typography>
                                </Stack>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    fontSize: "0.62rem",
                                  }}
                                >
                                  → {fmtStock(selectedProduct, a.stockAfter)}
                                </Typography>
                              </Stack>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                </Box>
              </Box>
            </Box>

            {/* ── Product Details Area (60%) ── */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                p: { xs: 3, md: 5 },
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 4,
                }}
              >
                <Box sx={{ minWidth: 0, pr: 2 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      fontSize: "1.4rem",
                      lineHeight: 1.2,
                      wordBreak: "break-word",
                      mb: 0.75,
                      textAlign: "center",
                    }}
                  >
                    {selectedProduct.barcode || "Sin código"}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontSize: "0.65rem",
                      }}
                    >
                      {selectedProduct.brand || "Sin marca"}
                    </Typography>
                    <Box
                      component="span"
                      sx={{ color: "text.secondary", fontSize: "0.7rem" }}
                    >
                      •
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontSize: "0.75rem" }}
                    >
                      {selectedProduct.category_name || "Sin categoría"}
                    </Typography>
                  </Stack>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setViewDetailsOpen(false)}
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

              {selectedProduct.discount_percent > 0 && (
                <Box
                  sx={{
                    mb: 3,
                    px: 2,
                    py: 1.5,
                    borderRadius: "4px",
                    textAlign: "center",
                    bgcolor: isDark
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(239,68,68,0.06)",
                    border: "1px solid",
                    borderColor: isDark
                      ? "rgba(239,68,68,0.2)"
                      : "rgba(239,68,68,0.15)",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="error"
                    sx={{ fontWeight: 700, fontSize: "0.8rem" }}
                  >
                    REBAJA -{selectedProduct.discount_percent}% — Ahorras $
                    {(
                      selectedProduct.price -
                      calcDiscountedPrice(
                        selectedProduct.price,
                        selectedProduct.discount_percent,
                      )
                    ).toFixed(2)}
                  </Typography>
                </Box>
              )}

              {/* ── Pricing Grid ── */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: { xs: 2, sm: 3 },
                  borderTop: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  py: 3.5,
                  mb: 4,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 600,
                      mb: 0.5,
                      display: "block",
                    }}
                  >
                    Precio Venta
                  </Typography>
                  {isContainerUnit(selectedProduct.sale_unit) &&
                  selectedProduct.box_qty > 0 &&
                  selectedProduct.stock >= selectedProduct.box_qty ? (
                    <>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 800,
                          color: "primary.main",
                          fontSize: "1.35rem",
                        }}
                      >
                        ${(selectedProduct.box_price || 0).toFixed(2)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {unitLabels(selectedProduct.sale_unit).singular} ·
                        Pieza: $
                        {(
                          selectedProduct.sale_unit === "boxpack"
                            ? selectedProduct.pack_price || 0
                            : selectedProduct.price || 0
                        ).toFixed(2)}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 800,
                          color: "primary.main",
                          fontSize: "1.35rem",
                        }}
                      >
                        $
                        {selectedProduct.discount_percent > 0
                          ? calcDiscountedPrice(
                              selectedProduct.price,
                              selectedProduct.discount_percent,
                            ).toFixed(2)
                          : selectedProduct.price.toFixed(2)}
                      </Typography>
                      {selectedProduct.discount_percent > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            textDecoration: "line-through",
                          }}
                        >
                          ${selectedProduct.price.toFixed(2)}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 600,
                      mb: 0.5,
                      display: "block",
                    }}
                  >
                    Precio Costo
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: "text.secondary",
                    }}
                  >
                    ${(selectedProduct.cost_price || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600, mb: 0.5 }}
                  >
                    Margen de Ganancia
                  </Typography>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      width: "fit-content",
                      px: 1.5,
                      py: 0.75,
                      borderRadius: "4px",
                      bgcolor: (() => {
                        const m = calcMarginPct(selectedProduct);
                        return m === null
                          ? isDark
                            ? "rgba(100,116,139,0.12)"
                            : "#e2e8f0"
                          : m >= 0
                            ? isDark
                              ? "rgba(16,185,129,0.12)"
                              : "#d1fae5"
                            : isDark
                              ? "rgba(239,68,68,0.15)"
                              : "#fee2e2";
                      })(),
                      color: (() => {
                        const m = calcMarginPct(selectedProduct);
                        return m === null
                          ? "#64748b"
                          : m >= 0
                            ? "#059669"
                            : "#dc2626";
                      })(),
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                  >
                    <TrendingUp size={15} />
                    {(() => {
                      const m = calcMarginPct(selectedProduct);
                      return m !== null ? `${m.toFixed(0)}%` : "—";
                    })()}
                  </Box>
                </Box>
              </Box>

              {/* ── Pack / Promos ── */}
              {(selectedProduct.sale_unit === "boxpack" &&
                selectedProduct.pack_qty > 0) ||
              selectedProduct.prices?.length > 0 ? (
                <Box
                  sx={{
                    mb: 4,
                    p: 2,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fafaf9",
                  }}
                >
                  {selectedProduct.sale_unit === "boxpack" &&
                  selectedProduct.pack_qty > 0 && (
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ mb: selectedProduct.prices?.length ? 1.5 : 0 }}
                    >
                      <Package size={16} color={theme.palette.secondary.main} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Paquete: $
                        {(
                          selectedProduct.sale_unit === "boxpack"
                            ? selectedProduct.price || 0
                            : selectedProduct.pack_price || 0
                        ).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({selectedProduct.pack_qty} pzas/paquete)
                      </Typography>
                      {(() => {
                        const c = selectedProduct.cost_price || 0;
                        const bq = selectedProduct.box_qty || 0;
                        const pq = selectedProduct.pack_qty || 0;
                        const pp =
                          selectedProduct.sale_unit === "boxpack"
                            ? selectedProduct.price || 0
                            : selectedProduct.pack_price || 0;
                        if (c <= 0 || pq <= 0 || pp <= 0) return null;
                        const pieceCost = bq > 0 ? c / bq : c;
                        const packCost = pieceCost * pq;
                        const m = ((pp - packCost) / packCost) * 100;
                        return (
                          <Typography
                            variant="caption"
                            sx={{
                              color: m >= 0 ? "#059669" : "#dc2626",
                              fontWeight: 700,
                            }}
                          >
                            margen {m.toFixed(0)}%
                          </Typography>
                        );
                      })()}
                    </Stack>
                  )}
                  {selectedProduct.prices?.length > 0 && (
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, mb: 0.5 }}
                      >
                        Promociones por cantidad
                      </Typography>
                      {selectedProduct.prices
                        .slice()
                        .sort((a, b) => a.qty - b.qty)
                        .map((t, i) => (
                          <Typography
                            key={i}
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {t.type === "mayoreo"
                              ? `Mayoreo desde ${t.qty} pzas: $${t.price.toFixed(2)}/pza`
                              : `Combo ${t.qty} por $${t.price.toFixed(2)} (solo al comprar exactamente ${t.qty})`}
                          </Typography>
                        ))}
                    </Box>
                  )}
                </Box>
              ) : null}

              {/* ── Supplier Info ── */}
              <Box
                sx={{
                  bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f4f4f5",
                  p: 2.5,
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "4px",
                    flexShrink: 0,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Store size={20} color={theme.palette.primary.main} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 800, color: "primary.main", mb: 1.5 }}
                  >
                    Información del Proveedor
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          fontSize: "0.55rem",
                          letterSpacing: "0.05em",
                          display: "block",
                        }}
                      >
                        Nombre
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: "0.82rem" }}
                      >
                        {selectedProduct.supplier_name || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          fontSize: "0.55rem",
                          letterSpacing: "0.05em",
                          display: "block",
                        }}
                      >
                        Categoría
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: "0.82rem" }}
                      >
                        {selectedProduct.category_name || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          fontSize: "0.55rem",
                          letterSpacing: "0.05em",
                          display: "block",
                        }}
                      >
                        Stock Mínimo
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: "0.82rem" }}
                      >
                        {selectedProduct.min_stock || 5}{" "}
                        {stockUnit(selectedProduct)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          fontSize: "0.55rem",
                          letterSpacing: "0.05em",
                          display: "block",
                        }}
                      >
                        Costo por Pieza
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: "0.82rem" }}
                      >
                        $
                        {(isContainerUnit(selectedProduct.sale_unit) &&
                        selectedProduct.box_qty > 0
                          ? (selectedProduct.cost_price || 0) /
                            selectedProduct.box_qty
                          : selectedProduct.cost_price || 0
                        ).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar "{selectedProduct?.name}"? El producto se ocultará del
            inventario y no podrá venderse.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setDeleteConfirmOpen(false)}>
            Cancelar
          </CancelButton>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target?.tagName !== "BUTTON") confirmAddStock();
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "14px",
            background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.2)"}`,
            maxHeight: "92vh",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ p: 1.25, borderRadius: "10px", background: "linear-gradient(135deg, #059669 0%, #047857 100%)", display: "flex" }}>
              <Warehouse size={24} color="white" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Agregar Stock
              </Typography>
              {selectedProduct && (
                <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                  Compra de inventario — {selectedProduct.name}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {selectedProduct && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{
                p: 1.5, borderRadius: "10px",
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                border: "1px solid", borderColor: "divider",
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                    Stock actual
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {stockDisplay(selectedProduct)}
                    {selectedProduct.sale_unit === "weight" && (
                      <span style={{ fontWeight: 400, color: "#64748b" }}> — ${selectedProduct.price.toFixed(2)}/kg</span>
                    )}
                  </Typography>
                </Stack>
              </Box>

              <TextField
                label={
                  isContainerUnit(selectedProduct.sale_unit)
                    ? unitLabels(selectedProduct.sale_unit).quantity
                    : selectedProduct.sale_unit === "weight"
                      ? "Cantidad (kg)"
                      : "Cantidad (pzas)"
                }
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                fullWidth
                autoFocus
                inputProps={{ min: 1 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />

              <TextField
                label="Costo total de esta compra"
                type="number"
                value={stockCost}
                onChange={(e) => setStockCost(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Opcional. Si lo dejas vacío se usa el costo del producto × cantidad."
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />

              <Box sx={{
                p: 1.5, borderRadius: "10px",
                bgcolor: stockRegisterExpense ? "rgba(16,185,129,0.08)" : isDark ? "rgba(255,255,255,0.03)" : "#f4f4f5",
                border: "1px solid",
                borderColor: stockRegisterExpense ? "rgba(16,185,129,0.35)" : "divider",
              }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={stockRegisterExpense}
                      onChange={(e) => {
                        setStockRegisterExpense(e.target.checked);
                        localStorage.setItem(
                          "stockRegisterExpense",
                          e.target.checked ? "true" : "false",
                        );
                      }}
                      size="small"
                    />
                  }
                  label={
                    <Stack spacing={0.3}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Descontar de la caja (egreso)
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ lineHeight: 1.3 }}>
                        {stockRegisterExpense
                          ? "Se registra como compra de inventario y descuenta de la caja abierta."
                          : "No se registra gasto en caja; solo se suma el stock."}
                      </Typography>
                    </Stack>
                  }
                  sx={{ alignItems: "flex-start", m: 0 }}
                />
              </Box>

              <Box sx={{
                p: 1.5, borderRadius: "10px",
                border: "1px dashed", borderColor: "divider",
                bgcolor: "background.paper",
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      Nuevo stock
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25 }}>
                      {selectedProduct.stock + (isContainerUnit(selectedProduct.sale_unit) && selectedProduct.box_qty > 0 ? (parseInt(stockQuantity) || 0) * selectedProduct.box_qty : parseInt(stockQuantity) || 0)}{" "}
                      <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>
                        {selectedProduct.sale_unit === "weight" ? "kg" : "pzas"}
                      </span>
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      Costo total
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25, color: "success.main" }}>
                      ${(() => {
                        const aQty =
                          isContainerUnit(selectedProduct.sale_unit) && selectedProduct.box_qty > 0
                            ? (parseInt(stockQuantity) || 0) * selectedProduct.box_qty
                            : parseInt(stockQuantity) || 0;
                        const c = parseFloat(stockCost) || 0;
                        return (c > 0
                          ? c
                          : isContainerUnit(selectedProduct.sale_unit) && selectedProduct.box_qty > 0
                            ? ((selectedProduct.cost_price || 0) / selectedProduct.box_qty) * aQty
                            : (selectedProduct.cost_price || 0) * aQty
                        ).toFixed(2);
                      })()}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, justifyContent: "flex-end", borderTop: "1px solid", borderColor: "divider" }}>
          <CancelButton onClick={() => setStockModalOpen(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={confirmAddStock}
            variant="contained"
            startIcon={<Plus size={20} />}
            disabled={!stockQuantity || stockQuantity <= 0}
            sx={{
              backgroundColor: "#234e8c",
              "&:hover": { backgroundColor: "#1a3b6e" },
              px: 3,
            }}
          >
            Agregar Stock
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={costConfirmOpen}
        onClose={() => setCostConfirmOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target?.tagName !== "BUTTON") handleCostConfirmYes();
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "14px",
            background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
            border: "1px solid",
            borderColor: "divider",
            maxHeight: "92vh",
            overflow: "hidden",
          },
        }}
      >
        <Box sx={{
          height: 6,
          background: stockCostConfirm?.direction === "subio"
            ? "linear-gradient(90deg, #ef4444 0%, #f97316 100%)"
            : "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
        }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              p: 1.25,
              borderRadius: "10px",
              display: "flex",
              background: stockCostConfirm?.direction === "subio"
                ? "linear-gradient(135deg, rgba(239,68,68,0.14), rgba(249,115,22,0.14))"
                : "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(52,211,153,0.14))",
            }}>
              {stockCostConfirm?.direction === "subio"
                ? <TrendingUp size={24} color="#dc2626" />
                : <TrendingDown size={24} color="#059669" />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Actualizar precio de costo
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: "block" }}>
                {stockCostConfirm?.isBox
                  ? unitLabels(stockCostConfirm.saleUnit)?.costPer ||
                    "Costo por caja"
                  : "Costo unitario"}{" "}
                —{" "}
                <strong style={{ color: stockCostConfirm?.direction === "subio" ? "#dc2626" : "#059669" }}>
                  {stockCostConfirm?.direction === "subio" ? "Subió" : "Bajó"}
                </strong>
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {stockCostConfirm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{
                p: 2,
                borderRadius: "12px",
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                border: "1px solid",
                borderColor: stockCostConfirm.direction === "subio"
                  ? "rgba(239,68,68,0.35)"
                  : "rgba(16,185,129,0.35)",
              }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ flex: 1, textAlign: "center" }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      Actual
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "text.secondary", textDecoration: "line-through" }}>
                      ${stockCostConfirm.oldCost.toFixed(2)}
                    </Typography>
                  </Box>
                  <ArrowRight size={20} color={stockCostConfirm.direction === "subio" ? "#ef4444" : "#10b981"} />
                  <Box sx={{ flex: 1, textAlign: "center" }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      Nuevo
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: stockCostConfirm.direction === "subio" ? "#dc2626" : "#059669" }}>
                      ${stockCostConfirm.newCost.toFixed(2)}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: "center" }}>
                El precio de costo{" "}
                <strong style={{ color: stockCostConfirm.direction === "subio" ? "#dc2626" : "#059669" }}>
                  {stockCostConfirm.direction === "subio" ? "subió" : "bajó"}
                </strong>
                . ¿Quieres actualizarlo al registrar este stock?
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, justifyContent: "flex-end", borderTop: "1px solid", borderColor: "divider" }}>
          <CancelButton onClick={handleCostConfirmNo}>No, solo stock</CancelButton>
          <Button
            onClick={handleCostConfirmYes}
            variant="contained"
            autoFocus
            sx={{
              backgroundColor: "#234e8c",
              "&:hover": { backgroundColor: "#1a3b6e" },
              px: 3,
            }}
          >
            Sí, actualizar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={reduceModalOpen}
        onClose={() => setReduceModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Warehouse size={24} color={theme.palette.warning.main} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Reducir Stock
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {selectedProduct.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Stock actual:{" "}
                <strong>{stockDisplay(selectedProduct)}</strong>
              </Typography>
              <TextField
                label={
                  isContainerUnit(selectedProduct.sale_unit)
                    ? unitLabels(selectedProduct.sale_unit).reduce
                    : "Cantidad a reducir"
                }
                type="number"
                value={reduceQty}
                onChange={(e) => setReduceQty(e.target.value)}
                fullWidth
                autoFocus
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Motivo (opcional)"
                value={reduceNote}
                onChange={(e) => setReduceNote(e.target.value)}
                fullWidth
                placeholder="Ej: merma, inventario, devolución..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setReduceModalOpen(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={confirmRemoveStock}
            variant="outlined"
            startIcon={<Minus size={20} />}
            disabled={
              !reduceQty ||
              reduceQty <= 0 ||
              reduceQty > (selectedProduct?.stock || 0)
            }
            sx={{
              borderColor: "warning.main",
              color: "warning.main",
              backgroundColor: "rgba(245,158,11,0.06)",
              "&:hover": {
                backgroundColor: "rgba(245,158,11,0.12)",
                borderColor: "warning.main",
              },
            }}
          >
            Reducir Stock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
