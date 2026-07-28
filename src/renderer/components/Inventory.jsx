import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Card, CardContent, TextField, InputAdornment, Chip, Stack, IconButton,
  Tooltip, useTheme, TablePagination, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText, Avatar, Grid, Fade, Divider, MenuItem, LinearProgress,
} from "@mui/material";
import {
  AddCircleOutline, Search, Inventory2, TrendingUp, TrendingDown, AttachMoney,
  Print, Edit, Delete, Visibility, Add, Warehouse, Discount,
  ArrowUpward, ArrowDownward, Store,
} from "@mui/icons-material";
import AddProductModal from "./AddProductModal";
import { TableSkeleton, CardSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalCount: 0, totalValue: 0, lowStockCount: 0, discountedCount: 0 });
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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const [result, cats, sups] = await Promise.all([
      window.api.invoke("get-products", { search: searchTerm || undefined, category_id: selectedCategory || undefined, supplier_id: selectedSupplier || undefined, sortField, sortDir, page, rowsPerPage }),
      window.api.invoke("get-categories"),
      window.api.invoke("get-suppliers"),
    ]);
    setProducts(result.products);
    setTotal(result.total);
    setStats(result.stats || { totalCount: 0, totalValue: 0, lowStockCount: 0, discountedCount: 0 });
    setCategories(cats || []);
    setSuppliers(sups || []);
    setLoading(false);
  }, [searchTerm, selectedCategory, selectedSupplier, sortField, sortDir, page, rowsPerPage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const handler = () => setIsModalOpen(true);
    window.addEventListener("ctrl-n", handler);
    return () => window.removeEventListener("ctrl-n", handler);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedCategory, selectedSupplier]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ArrowUpward sx={{ fontSize: 14, ml: 0.3 }} /> : <ArrowDownward sx={{ fontSize: 14, ml: 0.3 }} />;
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
      await window.api.invoke("delete-product", selectedProduct.id);
      fetchProducts();
      setDeleteConfirmOpen(false);
      setSelectedProduct(null);
    }
  };

  const confirmAddStock = async () => {
    if (!selectedProduct || stockQuantity <= 0) return;
    const actualQty = selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0 ? stockQuantity * selectedProduct.box_qty : stockQuantity;
    const result = await window.api.invoke("add-stock", { productId: selectedProduct.id, quantity: actualQty, cost: parseFloat(stockCost) || 0 });
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

  const calcDiscountedPrice = (price, discount) => price * (1 - (discount || 0) / 100);
  const stockUnit = (p) => p.sale_unit === "weight" ? "kg" : p.sale_unit === "box" ? "cajas" : "pz";
  const stockDisplay = (p) => {
    if (p.sale_unit === "box" && p.box_qty > 0 && p.stock >= p.box_qty) return `${Math.floor(p.stock / p.box_qty)} cajas (${p.stock} pz)`;
    if (p.sale_unit === "weight") return `${p.stock} ${p.stock === 1 ? "kg" : "kg"}`;
    return `${p.stock} pz`;
  };
  const boxPriceDisplay = (p) => p.sale_unit === "box" && p.box_qty > 0 && p.stock >= p.box_qty ? p.box_price : p.price;

  const printInventoryReport = () => {
    const now = new Date();
    const totalValue = Number(stats.totalValue);
    const lowStockCount = stats.lowStockCount;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte de Inventario</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#333}
      h1{color:#2563eb;text-align:center}
      table{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px}
      th{background:#2563eb;color:white;padding:10px;text-align:left}
      td{padding:8px;border-bottom:1px solid #ddd}
      .summary{display:flex;gap:20px;margin:20px 0;justify-content:center}
      .card{border:2px solid #e2e8f0;border-radius:8px;padding:20px;text-align:center;min-width:150px}
      .num{font-size:24px;font-weight:bold}
      .footer{text-align:center;margin-top:40px;color:#666;font-size:12px}
      .discount{color:#dc2626;text-decoration:line-through;margin-right:5px}
    </style></head><body>
      <h1>Reporte de Inventario</h1>
      <p style="text-align:center">Generado el ${now.toLocaleDateString()} a las ${now.toLocaleTimeString()}</p>
      <div class="summary">
        <div class="card"><div>Total Productos</div><div class="num">${products.length}</div></div>
        <div class="card"><div>Valor Total</div><div class="num">$${totalValue.toFixed(2)}</div></div>
        <div class="card"><div>Stock Bajo</div><div class="num" style="color:#dc2626">${lowStockCount}</div></div>
        <div class="card"><div>En Rebaja</div><div class="num" style="color:#dc2626">${stats.discountedCount}</div></div>
      </div>
      <table><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th></tr>
      ${products.map(p => {
        const s = getStockStatus(p.stock, p.min_stock);
        const finalPrice = calcDiscountedPrice(p.price, p.discount_percent);
        return `<tr><td><strong>${p.name}</strong><br><small>${p.brand || ""}</small></td>
          <td>${p.discount_percent > 0 ? `<span class="discount">$${p.price.toFixed(2)}</span> $${finalPrice.toFixed(2)}` : `$${p.price.toFixed(2)}`}</td>
          <td>${p.stock}</td><td>${s.label}</td></tr>`;
      }).join("")}
      </table>
      <div class="footer">Reporte generado automáticamente por el Sistema POS</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 2, textAlign: "center", fontSize: "1.8rem" }}>Gestión de Inventario</Typography>

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%)", border: "2px solid rgba(59, 130, 246, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.15)" }}>
                  <Inventory2 sx={{ fontSize: 22, color: theme.palette.primary.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Total Productos</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: "1.25rem", lineHeight: 1.1 }}>{stats.totalCount}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)", border: "2px solid rgba(16, 185, 129, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.15)" }}>
                  <AttachMoney sx={{ fontSize: 22, color: theme.palette.success.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Valor Total</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: "1.25rem", lineHeight: 1.1 }}>${Number(stats.totalValue).toFixed(2)}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.15) 100%)", border: "2px solid rgba(245, 158, 11, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245, 158, 11, 0.15)" }}>
                  <Warehouse sx={{ fontSize: 22, color: theme.palette.warning.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Stock Bajo</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.warning.main, fontSize: "1.25rem", lineHeight: 1.1 }}>{stats.lowStockCount}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.15) 100%)", border: "2px solid rgba(239, 68, 68, 0.2)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239, 68, 68, 0.15)" }}>
                  <Discount sx={{ fontSize: 22, color: theme.palette.error.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>En Rebaja</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.error.main, fontSize: "1.25rem", lineHeight: 1.1 }}>{stats.discountedCount}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Fade>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <TextField variant="outlined" size="small" placeholder="Buscar productos..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} sx={{ width: 220 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          <TextField select size="small" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            sx={{ width: 160 }}>
            <MenuItem value="">Todas las categorías</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}
            sx={{ width: 170 }}>
            <MenuItem value="">Todos los proveedores</MenuItem>
            {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Print />} onClick={printInventoryReport}
            sx={{ borderColor: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(30, 41, 59, 0.25)" }}>Imprimir</Button>
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setIsModalOpen(true)}>
            Añadir Producto
          </Button>
          <Chip label="Ctrl+N" size="small" variant="outlined"
            sx={{ height: 20, fontSize: "0.55rem", color: "text.secondary", borderColor: isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.25)" }} />
        </Stack>
      </Box>

      {!loading && stats.lowStockCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
          <Typography variant="body2"><strong>{stats.lowStockCount}</strong> producto(s) con stock bajo</Typography>
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
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }} onClick={() => handleSort("name")}>
                      Producto <SortIcon field="name" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }} onClick={() => handleSort("price")}>
                      Precio <SortIcon field="price" />
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }} onClick={() => handleSort("stock")}>
                      Stock <SortIcon field="stock" />
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Estado</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product.stock, product.min_stock);
                    const finalPrice = calcDiscountedPrice(product.price, product.discount_percent);
                    return (
                      <TableRow key={product.id} sx={{ "&:hover": { backgroundColor: isDark ? "rgba(59, 130, 246, 0.06)" : "rgba(37, 99, 235, 0.04)" } }}>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar src={product.image_path || undefined}
                              sx={{ width: 36, height: 36, borderRadius: "8px", bgcolor: "rgba(59, 130, 246, 0.12)" }}>
                              <Inventory2 sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                {product.name}
                                {product.sale_unit === "weight" && (
                                  <Chip label="kg" size="small" sx={{ ml: 0.5, height: 16, fontSize: "0.5rem", bgcolor: "rgba(59,130,246,0.12)", color: theme.palette.primary.main, fontWeight: 700 }} />
                                )}
                                {product.sale_unit === "box" && (
                                  <Chip label="caja" size="small" sx={{ ml: 0.5, height: 16, fontSize: "0.5rem", bgcolor: "rgba(16,185,129,0.12)", color: theme.palette.success.main, fontWeight: 700 }} />
                                )}
                                {product.discount_percent > 0 && (
                                  <Chip label={`-${product.discount_percent}%`} color="error" size="small"
                                    sx={{ ml: 0.5, height: 18, fontSize: "0.6rem" }} />
                                )}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">{product.brand || ""}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {product.discount_percent > 0 ? (
                            <Box>
                              <Typography variant="caption" sx={{ textDecoration: "line-through", color: "text.secondary", display: "block" }}>
                                ${product.price.toFixed(2)}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.error.light }}>
                                ${finalPrice.toFixed(2)}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
                            value={Math.min((product.stock / ((product.min_stock || 5) * 2)) * 100, 100)}
                            sx={{
                              mt: 0.5,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.15)",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: stockStatus.color === "error" ? "#ef4444" : stockStatus.color === "warning" ? "#f59e0b" : "#10b981",
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={stockStatus.label} color={stockStatus.color} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.3} justifyContent="center">
                            <Tooltip title="Ver"><IconButton size="small" color="primary" onClick={() => handleViewDetails(product)}><Visibility fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEditProduct(product)}><Edit fontSize="small" sx={{ color: theme.palette.secondary.main }} /></IconButton></Tooltip>
                            <Tooltip title="Agregar Stock"><IconButton size="small" color="success" onClick={() => handleAddStock(product)}><Add fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => handleDeleteProduct(product)}><Delete fontSize="small" /></IconButton></Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Box sx={{ py: 6, textAlign: "center" }}>
                          <Store sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                          <Typography variant="body1" color="textSecondary" sx={{ mb: 0.5 }}>
                            No hay productos registrados
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Agrega tu primer producto usando el botón "Añadir Producto"
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={total}
              rowsPerPage={rowsPerPage} page={page} onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
          </Card>
        </Fade>
      )}

      <AddProductModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onProductAdded={handleProductAdded} />
      <AddProductModal open={editModalOpen} onClose={() => { setEditModalOpen(false); setSelectedProduct(null); }} onProductAdded={handleProductAdded} editProduct={selectedProduct} />

      <Dialog open={viewDetailsOpen} onClose={() => setViewDetailsOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={selectedProduct?.image_path || undefined} variant="rounded"
              sx={{ width: 56, height: 56, bgcolor: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}>
              <Inventory2 sx={{ fontSize: 28, color: "white" }} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: "1.2rem" }}>{selectedProduct?.name}</Typography>
              <Typography variant="body2" color="textSecondary">{selectedProduct?.brand || "Sin marca"}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Card sx={{ p: 2, background: isDark ? "rgba(59, 130, 246, 0.06)" : "rgba(37, 99, 235, 0.03)", border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.08)"}`, borderRadius: "12px" }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: "center", p: 1 }}>
                      <AttachMoney sx={{ fontSize: 24, color: theme.palette.primary.main, mb: 0.5 }} />
                      {selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0 && selectedProduct.stock >= selectedProduct.box_qty ? (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                            ${(selectedProduct.box_price || 0).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Precio Venta (caja)</Typography>
                          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
                            Pieza: ${(selectedProduct.price || 0).toFixed(2)}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                            ${selectedProduct.discount_percent > 0 ? calcDiscountedPrice(selectedProduct.price, selectedProduct.discount_percent).toFixed(2) : selectedProduct.price.toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Precio {selectedProduct.discount_percent > 0 ? "Final" : "Venta"}</Typography>
                          {selectedProduct.discount_percent > 0 && (
                            <Typography variant="caption" sx={{ textDecoration: "line-through", color: "text.secondary", display: "block" }}>
                              ${selectedProduct.price.toFixed(2)}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: "center", p: 1 }}>
                      <Inventory2 sx={{ fontSize: 24, color: selectedProduct.stock === 0 ? theme.palette.error.main : selectedProduct.stock <= (selectedProduct.min_stock || 5) ? theme.palette.warning.main : theme.palette.success.main, mb: 0.5 }} />
                      <Typography variant="h5" sx={{ fontWeight: 800, color: selectedProduct.stock === 0 ? theme.palette.error.main : selectedProduct.stock <= (selectedProduct.min_stock || 5) ? theme.palette.warning.main : theme.palette.success.main }}>
                        {selectedProduct.sale_unit === "box" && selectedProduct.box_qty > 0
                          ? stockDisplay(selectedProduct)
                          : selectedProduct.stock}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">Stock Actual</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Card>

              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                <Chip label={`Código: ${selectedProduct.barcode}`} variant="outlined" size="small" sx={{ fontWeight: 500 }} />
                <Chip
                  icon={getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "error" ? <TrendingDown /> : getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color === "warning" ? <TrendingDown /> : <TrendingUp />}
                  label={getStockStatus(selectedProduct.stock, selectedProduct.min_stock).label}
                  color={getStockStatus(selectedProduct.stock, selectedProduct.min_stock).color}
                  variant="filled" size="small" sx={{ fontWeight: 700 }} />
              </Stack>

              {selectedProduct.discount_percent > 0 && (
                <Box sx={{ p: 1.5, borderRadius: 2, background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.06)", border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.15)"}`, textAlign: "center" }}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    REBAJA -{selectedProduct.discount_percent}% — Ahorras ${(selectedProduct.price - calcDiscountedPrice(selectedProduct.price, selectedProduct.discount_percent)).toFixed(2)}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Precio de costo</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>${(selectedProduct.cost_price || 0).toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Stock mínimo</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedProduct.min_stock || 5}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Margen de ganancia</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                    {selectedProduct.cost_price > 0 ? `${((selectedProduct.price - selectedProduct.cost_price) / selectedProduct.cost_price * 100).toFixed(0)}%` : "—"}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Proveedor</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedProduct?.supplier_name || "—"}</Typography>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setViewDetailsOpen(false)} fullWidth>Cerrar</CancelButton>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>¿Eliminar "{selectedProduct?.name}"? Esta acción no se puede deshacer.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setDeleteConfirmOpen(false)}>Cancelar</CancelButton>
          <Button onClick={confirmDelete} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stockModalOpen} onClose={() => setStockModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Warehouse color="success" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Agregar Stock</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedProduct.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                Stock actual: <strong>{stockDisplay(selectedProduct)}</strong>
                {selectedProduct.sale_unit === "weight" && <span> — Precio kg: ${selectedProduct.price.toFixed(2)}</span>}
              </Typography>
              <TextField label={selectedProduct.sale_unit === "box" ? "Cantidad (cajas)" : "Cantidad a agregar"} type="number" value={stockQuantity}
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)} fullWidth autoFocus
                inputProps={{ min: 1 }} />
              <TextField label="Costo total de esta compra" type="number" value={stockCost}
                onChange={(e) => setStockCost(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Se registrará como egreso en la caja abierta" />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setStockModalOpen(false)}>Cancelar</CancelButton>
          <Button onClick={confirmAddStock} variant="outlined" startIcon={<Add />} disabled={!stockQuantity || stockQuantity <= 0}
            sx={{ borderColor: "success.main", color: "success.main", backgroundColor: "rgba(16,185,129,0.06)", "&:hover": { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "success.main" } }}>
            Agregar Stock
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Inventory;
