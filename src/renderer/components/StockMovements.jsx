import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography, Card, CardContent, TextField, InputAdornment,
  Stack, useTheme, TablePagination, Chip, Select, MenuItem, FormControl, InputLabel,
  Grid, Button, Fade,
} from "@mui/material";
import {
  CompareArrows, TrendingUp, TrendingDown, SwapVert, Search, CalendarToday,
} from "@mui/icons-material";
import { TableSkeleton, CardSkeleton } from "./Skeletons";

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const theme = useTheme();

  const fetchProducts = useCallback(async () => {
    const result = await window.api.invoke("get-products");
    setProducts(result.products || result);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (productId) params.productId = Number(productId);
    if (type) params.type = type;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate + "T23:59:59";
    const result = await window.api.invoke("get-stock-movements", params);
    setMovements(result);
    setPage(0);
    setLoading(false);
  }, [productId, type, startDate, endDate]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date();
    firstDay.setDate(1);
    if (!startDate) setStartDate(firstDay.toISOString().slice(0, 10));
    if (!endDate) setEndDate(today);
  }, []);

  const getTypeChip = (t) => {
    if (t === "in") return <Chip icon={<TrendingUp />} label="Entrada" color="success" size="small" variant="outlined" />;
    if (t === "out") return <Chip icon={<TrendingDown />} label="Salida" color="error" size="small" variant="outlined" />;
    return <Chip icon={<SwapVert />} label="Ajuste" color="warning" size="small" variant="outlined" />;
  };

  const getUnit = (productId) => {
    const p = products.find(x => x.id === productId);
    return p?.sale_unit === "weight" ? "kg" : "pz";
  };
  const totalIn = movements.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0);

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 3, textAlign: "center", fontSize: "1.8rem" }}>
        Historial de Movimientos de Stock
      </Typography>

      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", boxShadow: "none" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59, 130, 246, 0.12)" }}>
                  <CompareArrows sx={{ fontSize: 22, color: theme.palette.primary.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Total Movimientos</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.25rem", lineHeight: 1.1 }}>{movements.length}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", boxShadow: "none" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.12)" }}>
                  <TrendingUp sx={{ fontSize: 22, color: theme.palette.success.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Unidades Entradas</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.25rem", lineHeight: 1.1 }}>{totalIn}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", boxShadow: "none" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239, 68, 68, 0.12)" }}>
                  <TrendingDown sx={{ fontSize: 22, color: theme.palette.error.main }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: "textSecondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "0.6rem", lineHeight: 1.2 }}>Unidades Salidas</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.25rem", lineHeight: 1.1 }}>{totalOut}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Fade>
      )}

      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Producto</InputLabel>
              <Select value={productId} label="Producto" onChange={(e) => setProductId(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select value={type} label="Tipo" onChange={(e) => setType(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="in">Entrada</MenuItem>
                <MenuItem value="out">Salida</MenuItem>
                <MenuItem value="adjust">Ajuste</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField label="Desde" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              size="small" fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField label="Hasta" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              size="small" fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button variant="contained" onClick={() => fetchData()} sx={{ width: "100%" }}>
              Filtrar
            </Button>
          </Grid>
        </Grid>
      </Card>

      {loading ? (
        <TableSkeleton rows={4} columns={7} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Tipo</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Costo</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Notas</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                  {movements.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((m) => (
                    <TableRow key={m.id} sx={{ "&:hover": { backgroundColor: "rgba(59, 130, 246, 0.06)" } }}>
                      <TableCell>
                        <Typography variant="body2">{new Date(m.created_at).toLocaleDateString()}</Typography>
                        <Typography variant="caption" color="textSecondary">{new Date(m.created_at).toLocaleTimeString()}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{m.product_name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="textSecondary" sx={{ fontFamily: "monospace" }}>{m.barcode}</Typography></TableCell>
                      <TableCell align="center">{getTypeChip(m.type)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m.type === "in" ? "#34d399" : m.type === "out" ? "#f87171" : "#fbbf24" }}>
                          {m.type === "in" ? "+" : m.type === "out" ? "-" : "±"}{m.quantity} {getUnit(m.product_id)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="textSecondary">
                          {m.type === "in" && m.cost ? `$${m.cost.toFixed(2)}` : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="textSecondary">{m.notes || "—"}</Typography></TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && (
                    <TableRow><TableCell colSpan={7} align="center"><Typography color="textSecondary" sx={{ py: 4 }}>No hay movimientos registrados</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]} component="div" count={movements.length}
              rowsPerPage={rowsPerPage} page={page}
              onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default StockMovements;
