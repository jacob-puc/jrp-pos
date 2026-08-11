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
} from "@mui/material";
import {
  AddCircleOutline,
  Search,
  Inventory2,
  TrendingUp,
  AttachMoney,
  FileDownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  VisibilityOutlined,
  Add,
  Warehouse,
  Discount,
  Warning,
  ArrowUpward,
  ArrowDownward,
  Store,
  Close,
} from "@mui/icons-material";
import AddProductModal from "./AddProductModal";
import { TableSkeleton, CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";

const Inventory = () => {
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(1);
  const [stockCost, setStockCost] = useState("");
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const scanBufferRef = useRef("");
  const scanTimeoutRef = useRef(null);
  const [initialBarcode, setInitialBarcode] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const [result, cats, sups] = await Promise.all([
      window.api.invoke("get-products", {
        search: searchTerm || undefined,
        category_id: selectedCategory || undefined,
        supplier_id: selectedSupplier || undefined,
        sortField,
        sortDir,
        page,
        rowsPerPage,
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
    searchTerm,
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
              setStockQuantity(1);
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
  }, [searchTerm, selectedCategory, selectedSupplier]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ArrowUpward sx={{ fontSize: 14, ml: 0.3 }} />
    ) : (
      <ArrowDownward sx={{ fontSize: 14, ml: 0.3 }} />
    );
  };

  const handleProductAdded = () => fetchProducts();

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
    setStockQuantity(1);
    setStockCost("");
    setStockModalOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedProduct) {
      const result = await window.api.invoke(
        "delete-product",
        selectedProduct.id,
      );
      if (!result?.success) {
        alert(result?.error || "No se pudo eliminar el producto");
      }
      fetchProducts();
      setDeleteConfirmOpen(false);
      setSelectedProduct(null);
    }
  };

  const confirmAddStock = async () => {
    if (!selectedProduct || stockQuantity <= 0) return;
    const actualQty =
      selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0
        ? stockQuantity * selectedProduct.box_qty
        : stockQuantity;
    const result = await window.api.invoke("add-stock", {
      productId: selectedProduct.id,
      quantity: actualQty,
      cost: parseFloat(stockCost) || 0,
    });
    if (result.success) {
      setStockModalOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } else {
      alert(result.error);
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
  const stockUnit = (p) =>
    p.sale_unit === "weight" ? "kg" : p.sale_unit === "box" ? "cajas" : "pz";
  const stockDisplay = (p) => {
    if (p.sale_unit === "box" && p.box_qty > 0 && p.stock >= p.box_qty)
      return `${Math.floor(p.stock / p.box_qty)} cajas (${p.stock} pz)`;
    if (p.sale_unit === "weight")
      return `${p.stock} ${p.stock === 1 ? "kg" : "kg"}`;
    return `${p.stock} pz`;
  };
  const boxPriceDisplay = (p) =>
    p.sale_unit === "box" && p.box_qty > 0 && p.stock >= p.box_qty
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
          p.stock,
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
    a.download = `inventario-completo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography
        variant="h2"
        sx={{ mb: 2, textAlign: "center", fontSize: "1.8rem" }}
      >
        Gestión de Inventario
      </Typography>

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: "Total Productos", value: stats.totalCount, icon: Inventory2, color: theme.palette.primary.main },
              { label: "Valor Total", value: `$${Number(stats.totalValue).toFixed(2)}`, icon: AttachMoney, color: theme.palette.success.main },
              { label: "Stock Bajo", value: stats.lowStockCount, icon: Warning, color: theme.palette.error.main },
              { label: "En Rebaja", value: stats.discountedCount, icon: Discount, color: theme.palette.warning.main },
            ].map((s) => (
              <Grid size={{ xs: 12, md: 3 }} key={s.label}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    p: 2.5,
                    borderRadius: "12px",
                    bgcolor: isDark ? "rgba(255,255,255,0.05)" : "grey.50",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: s.color }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontSize: "11px",
                        lineHeight: 1.3,
                        color: "text.secondary",
                      }}
                    >
                      {s.label}
                    </Typography>
                    <Box sx={{ width: 32, height: 32, borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: `${s.color}1f`, flexShrink: 0 }}>
                      <s.icon sx={{ fontSize: 17, color: s.color }} />
                    </Box>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: "1.5rem", md: "1.75rem" }, color: "text.primary", lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Fade>
      )}

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
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <TextField
            variant="outlined"
            size="small"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
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
        <Stack direction="row" spacing={1}>
          <Tooltip title="Exportar inventario (CSV)">
            <IconButton onClick={exportInventoryCSV}
              sx={{ border: 1, borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(30, 41, 59, 0.25)", borderRadius: 2 }}>
              <FileDownloadOutlined />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddCircleOutline />}
            onClick={() => setIsModalOpen(true)}
          >
            Añadir Producto
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
      </Box>

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
          <Card>
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("name")}
                    >
                      Producto <SortIcon field="name" />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("price")}
                    >
                      Precio <SortIcon field="price" />
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("stock")}
                    >
                      Stock <SortIcon field="stock" />
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                    >
                      Estado
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                    >
                      Acciones
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(
                      product.stock,
                      product.min_stock,
                    );
                    const finalPrice = calcDiscountedPrice(
                      product.price,
                      product.discount_percent,
                    );
                    return (
                      <TableRow
                        key={product.id}
                        sx={{
                          "& .MuiTableCell-root": {
                            py: 1.5,
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
                            }}
                          >
                            <Avatar
                              src={product.image_path || undefined}
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "8px",
                                bgcolor: "rgba(59, 130, 246, 0.12)",
                              }}
                            >
                              <Inventory2
                                sx={{
                                  fontSize: 18,
                                  color: theme.palette.primary.main,
                                }}
                              />
                            </Avatar>
                            <Box>
                              <Typography
                                variant="body2"
                                component="div"
                                sx={{ fontWeight: 600, lineHeight: 1.2 }}
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
                                {product.discount_percent > 0 && (
                                  <Chip
                                    label={`-${product.discount_percent}%`}
                                    color="error"
                                    size="small"
                                    sx={{
                                      ml: 0.5,
                                      height: 18,
                                      fontSize: "0.6rem",
                                    }}
                                  />
                                )}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
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
                        <TableCell align="center" sx={{ minWidth: 120 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {stockDisplay(product)}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(
                              (product.stock / ((product.min_stock || 5) * 2)) *
                                100,
                              100,
                            )}
                            sx={{
                              mt: 0.5,
                              height: 8,
                              borderRadius: 2,
                              bgcolor: isDark
                                ? "rgba(148,163,184,0.12)"
                                : "rgba(148,163,184,0.15)",
                              "& .MuiLinearProgress-bar": {
                                bgcolor:
                                  stockStatus.color === "error"
                                    ? "#ef4444"
                                    : stockStatus.color === "warning"
                                      ? "#f59e0b"
                                      : "#10b981",
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
                            <Tooltip title="Ver">
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(product)}
                                sx={{ p: 0.5, color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                              >
                                <VisibilityOutlined fontSize="16px" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Editar">
                              <IconButton
                                size="small"
                                onClick={() => handleEditProduct(product)}
                                sx={{ p: 0.5, color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                              >
                                <EditOutlined fontSize="16px" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Agregar Stock">
                              <IconButton
                                size="small"
                                onClick={() => handleAddStock(product)}
                                sx={{ p: 0.5, color: isDark ? "#e2e8f0" : "#0f172a", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)" } }}
                              >
                                <Add fontSize="16px" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteProduct(product)}
                                sx={{ p: 0.5 }}
                              >
                                <DeleteOutlined fontSize="16px" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, p) => setPage(p)}
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
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden", bgcolor: isDark ? "#16181d" : "#f4f4f5", maxHeight: "90vh" } }}
      >
        {selectedProduct && (
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" } }}>
            {/* ── Product Visual Area (40%) ── */}
            <Box sx={{
              width: { xs: "100%", md: "40%" },
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#ececee",
              borderRight: { md: "1px solid" }, borderBottom: { xs: "1px solid", md: "none" },
              borderColor: "divider",
              p: { xs: 4, md: 5 },
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <Box sx={{ position: "absolute", top: 20, left: 20 }}>
                <Chip
                  size="small"
                  label={getStockStatus(selectedProduct.stock, selectedProduct.min_stock).label}
                  sx={{
                    fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase", height: 24,
                    bgcolor: getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "success"
                      ? (isDark ? "rgba(16,185,129,0.15)" : "#dcfce7")
                      : getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "warning"
                        ? (isDark ? "rgba(245,158,11,0.15)" : "#fef3c7")
                        : (isDark ? "rgba(239,68,68,0.15)" : "#fee2e2"),
                    color: getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "success"
                      ? "#059669"
                      : getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "warning"
                        ? "#b45309"
                        : "#dc2626",
                  }}
                />
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.6rem", lineHeight: 1.15, textAlign: "center", mb: 3, wordBreak: "break-word" }}>
                {selectedProduct.name}
              </Typography>

              <Box sx={{
                width: 140, height: 140, borderRadius: "28px",
                bgcolor: isDark ? "rgba(59,130,246,0.08)" : "rgba(37,99,235,0.05)",
                border: "1px solid", borderColor: "divider",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Inventory2 sx={{ fontSize: 64, color: isDark ? "#64748b" : "#94a3b8" }} />
              </Box>

              <Box sx={{ mt: 5, width: "100%" }}>
                <Box sx={{ bgcolor: "background.paper", p: 2, borderRadius: "12px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.55rem" }}>Stock Actual</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main", mt: 0.5, fontSize: "1.7rem" }}>
                    {selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0
                      ? stockDisplay(selectedProduct)
                      : selectedProduct.stock}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>{stockUnit(selectedProduct)}</Typography>
                </Box>
              </Box>
            </Box>

            {/* ── Product Details Area (60%) ── */}
            <Box sx={{
              flex: 1, minWidth: 0, p: { xs: 3, md: 5 },
              bgcolor: "background.paper",
              display: "flex", flexDirection: "column",
              overflowY: "auto",
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
                <Box sx={{ minWidth: 0, pr: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, fontSize: "1.4rem", lineHeight: 1.2, wordBreak: "break-word", mb: 0.75, textAlign: "center" }}>
                    {selectedProduct.barcode || "Sin código"}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem" }}>
                      {selectedProduct.brand || "Sin marca"}
                    </Typography>
                    <Box component="span" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>•</Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                      {selectedProduct.category_name || "Sin categoría"}
                    </Typography>
                  </Stack>
                </Box>
                <IconButton size="small" onClick={() => setViewDetailsOpen(false)}
                  sx={{ color: "text.secondary", "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" } }}>
                  <Close sx={{ fontSize: 22 }} />
                </IconButton>
              </Box>

              {selectedProduct.discount_percent > 0 && (
                <Box sx={{
                  mb: 3, px: 2, py: 1.5, borderRadius: "10px", textAlign: "center",
                  bgcolor: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
                  border: "1px solid", borderColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)",
                }}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                    REBAJA -{selectedProduct.discount_percent}% — Ahorras ${(selectedProduct.price - calcDiscountedPrice(selectedProduct.price, selectedProduct.discount_percent)).toFixed(2)}
                  </Typography>
                </Box>
              )}

              {/* ── Pricing Grid ── */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: { xs: 2, sm: 3 }, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", py: 3.5, mb: 4 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, mb: 0.5, display: "block" }}>Precio Venta</Typography>
                  {selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0 && selectedProduct.stock >= selectedProduct.box_qty ? (
                    <>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main", fontSize: "1.35rem" }}>
                        ${(selectedProduct.box_price || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>caja · Pieza: ${(selectedProduct.price || 0).toFixed(2)}</Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main", fontSize: "1.35rem" }}>
                        ${selectedProduct.discount_percent > 0
                          ? calcDiscountedPrice(selectedProduct.price, selectedProduct.discount_percent).toFixed(2)
                          : selectedProduct.price.toFixed(2)}
                      </Typography>
                      {selectedProduct.discount_percent > 0 && (
                        <Typography variant="caption" sx={{ color: "text.secondary", textDecoration: "line-through" }}>
                          ${selectedProduct.price.toFixed(2)}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, mb: 0.5, display: "block" }}>Precio Costo</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem", color: "text.secondary" }}>
                    ${(selectedProduct.cost_price || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, mb: 0.5 }}>Margen de Ganancia</Typography>
                  <Box sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.75, width: "fit-content",
                    px: 1.5, py: 0.75, borderRadius: "10px",
                    bgcolor: isDark ? "rgba(16,185,129,0.12)" : "#d1fae5",
                    color: "#059669", fontWeight: 700, fontSize: "0.8rem",
                  }}>
                    <TrendingUp sx={{ fontSize: 15 }} />
                    {selectedProduct.cost_price > 0
                      ? `${(((selectedProduct.price - selectedProduct.cost_price) / selectedProduct.cost_price) * 100).toFixed(0)}%`
                      : "—"}
                  </Box>
                </Box>
              </Box>

              {/* ── Supplier Info ── */}
              <Box sx={{
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f4f4f5",
                p: 2.5, borderRadius: "14px", border: "1px solid", borderColor: "divider",
                display: "flex", alignItems: "flex-start", gap: 2,
              }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
                  bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Store sx={{ fontSize: 20, color: "primary.main" }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1.5 }}>Información del Proveedor</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.05em", display: "block" }}>Nombre</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{selectedProduct.supplier_name || "—"}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.05em", display: "block" }}>Categoría</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{selectedProduct.category_name || "—"}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.05em", display: "block" }}>Stock Mínimo</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{selectedProduct.min_stock || 5} {stockUnit(selectedProduct)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.05em", display: "block" }}>Costo por Pieza</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>${(selectedProduct.cost_price || 0).toFixed(2)}</Typography>
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
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Warehouse color="success" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Agregar Stock
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
                Stock actual: <strong>{stockDisplay(selectedProduct)}</strong>
                {selectedProduct.sale_unit === "weight" && (
                  <span> — Precio kg: ${selectedProduct.price.toFixed(2)}</span>
                )}
              </Typography>
              <TextField
                label={
                  selectedProduct.sale_unit === "box"
                    ? "Cantidad (cajas)"
                    : "Cantidad a agregar"
                }
                type="number"
                value={stockQuantity}
                onChange={(e) =>
                  setStockQuantity(parseInt(e.target.value) || 0)
                }
                fullWidth
                autoFocus
                inputProps={{ min: 1 }}
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
                helperText={stockCost ? "Se registrará como egreso en la caja abierta" : `Si deja vacío: $${((selectedProduct?.cost_price || 0) * stockQuantity).toFixed(2)} (costo × cantidad)`}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setStockModalOpen(false)}>
            Cancelar
          </CancelButton>
          <Button
            onClick={confirmAddStock}
            variant="outlined"
            startIcon={<Add />}
            disabled={!stockQuantity || stockQuantity <= 0}
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
            Agregar Stock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
