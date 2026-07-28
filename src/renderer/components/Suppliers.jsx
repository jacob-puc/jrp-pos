import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Card, CardContent, TextField,
  InputAdornment, Stack, IconButton, Tooltip, useTheme, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  Alert, Grid, Fade, CircularProgress, Chip,
} from "@mui/material";
import {
  AddCircleOutline, Search, LocalShipping, Edit, Delete, Phone, Email, Person, LocationOn,
} from "@mui/icons-material";
import { TableSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
});

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const theme = useTheme();

  const { control, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contact: "", phone: "", email: "", address: "" },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await window.api.invoke("get-suppliers");
    setSuppliers(result);
    setFiltered(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = () => openAdd();
    window.addEventListener("ctrl-p", handler);
    return () => window.removeEventListener("ctrl-p", handler);
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2 || searchTerm.length === 0) {
      setFiltered(suppliers.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact?.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else { setFiltered(suppliers); }
    setPage(0);
  }, [searchTerm, suppliers]);

  const openAdd = () => {
    setEditItem(null);
    reset({ name: "", contact: "", phone: "", email: "", address: "" });
    setSubmitError("");
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    reset({ name: s.name, contact: s.contact || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setSubmitError("");
    setModalOpen(true);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError("");
    const result = editItem
      ? await window.api.invoke("update-supplier", editItem.id, data)
      : await window.api.invoke("add-supplier", data);
    if (result.success) { setModalOpen(false); fetchData(); }
    else setSubmitError(result.error);
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const result = await window.api.invoke("delete-supplier", deleteConfirm.id);
    if (result.success) { setDeleteConfirm(null); fetchData(); }
    else { alert(result.error); setDeleteConfirm(null); }
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 3, textAlign: "center", fontSize: "1.8rem" }}>
        Gestión de Proveedores
      </Typography>

      {loading ? (
        <Card sx={{ flex: 1, p: 2 }}><CardContent sx={{ p: 0, textAlign: "center" }}>
          <Box sx={{ width: 60, height: 60, borderRadius: "12px", bgcolor: "rgba(59,130,246,0.1)", mx: "auto", mb: 1 }} />
          <Box sx={{ width: 100, height: 24, bgcolor: "rgba(148,163,184,0.06)", mx: "auto", borderRadius: 1 }} />
        </CardContent></Card>
      ) : (
        <Fade in={!loading} timeout={500}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1, background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%)", border: "2px solid rgba(59, 130, 246, 0.2)" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <LocalShipping sx={{ fontSize: 36, color: theme.palette.primary.main, mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>{suppliers.length}</Typography>
                <Typography variant="body2" color="textSecondary">Total Proveedores</Typography>
              </CardContent>
            </Card>
          </Stack>
        </Fade>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={openAdd}>Nuevo Proveedor</Button>
          <TextField variant="outlined" placeholder="Buscar proveedores..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ width: 320 }}
          />
        </Stack>
        <Chip label="Ctrl+P" size="small" variant="outlined"
          sx={{ height: 20, fontSize: "0.55rem", color: "text.secondary", borderColor: "rgba(148,163,184,0.12)" }} />
      </Box>

      {loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contacto</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Teléfono</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Productos</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s) => (
                    <TableRow key={s.id} sx={{ "&:hover": { backgroundColor: "rgba(59, 130, 246, 0.06)" } }}>
                      <TableCell><Typography variant="body1" sx={{ fontWeight: 600 }}>{s.name}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="textSecondary">{s.contact || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="textSecondary">{s.phone || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="textSecondary">{s.email || "—"}</Typography></TableCell>
                      <TableCell align="center"><Typography variant="body2" sx={{ fontWeight: 600 }}>{s.product_count || 0}</Typography></TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(s)}><Edit fontSize="small" sx={{ color: theme.palette.secondary.main }} /></IconButton></Tooltip>
                          <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => setDeleteConfirm(s)}><Delete fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center"><Typography color="textSecondary" sx={{ py: 4 }}>No hay proveedores</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]} component="div" count={filtered.length}
              rowsPerPage={rowsPerPage} page={page}
              onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Filas:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </Card>
        </Fade>
      )}

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{editItem ? "Editar Proveedor" : "Nuevo Proveedor"}</Typography>
        </DialogTitle>
        <DialogContent>
          {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Controller name="name" control={control} render={({ field }) => (
              <TextField {...field} label="Nombre del proveedor" fullWidth autoFocus
                error={!!errors.name} helperText={errors.name?.message}
                InputProps={{ startAdornment: <InputAdornment position="start"><LocalShipping /></InputAdornment> }} />
            )} />
            <Controller name="contact" control={control} render={({ field }) => (
              <TextField {...field} label="Persona de contacto" fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }} />
            )} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Controller name="phone" control={control} render={({ field }) => (
                  <TextField {...field} label="Teléfono" fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }} />
                )} />
              </Grid>
              <Grid item xs={6}>
                <Controller name="email" control={control} render={({ field }) => (
                  <TextField {...field} label="Email" fullWidth
                    error={!!errors.email} helperText={errors.email?.message}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email /></InputAdornment> }} />
                )} />
              </Grid>
            </Grid>
            <Controller name="address" control={control} render={({ field }) => (
              <TextField {...field} label="Dirección" fullWidth multiline rows={2}
                InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn /></InputAdornment> }} />
            )} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setModalOpen(false)}>Cancelar</CancelButton>
          <Button onClick={handleSubmit(onSubmit)} variant="outlined" disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ borderColor: "success.main", color: "success.main", backgroundColor: "rgba(16,185,129,0.06)", "&:hover": { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "success.main" } }}>
            {isSubmitting ? "Guardando..." : editItem ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>¿Eliminar el proveedor "{deleteConfirm?.name}"?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={() => setDeleteConfirm(null)}>Cancelar</CancelButton>
          <Button onClick={handleDelete} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Suppliers;
