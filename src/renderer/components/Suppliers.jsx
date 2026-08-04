import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, TextField,
  InputAdornment, Stack, IconButton, Tooltip, useTheme, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  Alert, Grid, Fade, CircularProgress, Chip,
} from "@mui/material";
import {
  AddCircleOutline, Search, LocalShipping, EditOutlined, DeleteOutlined,
  Phone, Email, Person, LocationOn, ChevronLeft, ChevronRight,
} from "@mui/icons-material";
import { TableSkeleton } from "./Skeletons";
import CancelButton from "./CancelButton";
import StepIndicator from "./StepIndicator";

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
});

const steps = ["Información", "Contacto"];

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
  const [activeStep, setActiveStep] = useState(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const { control, handleSubmit, formState: { errors }, reset, trigger } = useForm({
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
    setActiveStep(0);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    reset({ name: s.name, contact: s.contact || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setSubmitError("");
    setActiveStep(0);
    setModalOpen(true);
  };

  const handleNext = async () => {
    const fields = activeStep === 0 ? ["name"] : ["email"];
    const isValid = await trigger(fields);
    if (isValid) setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

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

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Fade in={activeStep === 0} timeout={300}>
            <Box>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12 }}>
                  <Controller name="name" control={control} render={({ field }) => (
                    <TextField {...field} label="Nombre del proveedor" fullWidth size="small" autoFocus
                      error={!!errors.name} helperText={errors.name?.message}
                      placeholder="Ej: Distribuidora Central S.A."
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><LocalShipping sx={{ fontSize: 18, color: "#64748b" }} /></InputAdornment> } }} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Controller name="address" control={control} render={({ field }) => (
                    <TextField {...field} label="Dirección" fullWidth size="small" multiline rows={2}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><LocationOn sx={{ fontSize: 18, color: "#64748b" }} /></InputAdornment> } }} />
                  )} />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );
      case 1:
        return (
          <Fade in={activeStep === 1} timeout={300}>
            <Box>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12 }}>
                  <Controller name="contact" control={control} render={({ field }) => (
                    <TextField {...field} label="Persona de contacto" fullWidth size="small"
                      placeholder="Ej: Ricardo Gómez"
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 18, color: "#64748b" }} /></InputAdornment> } }} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller name="phone" control={control} render={({ field }) => (
                    <TextField {...field} label="Teléfono" fullWidth size="small"
                      placeholder="Ej: +52 312 456 7890"
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 18, color: "#64748b" }} /></InputAdornment> } }} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller name="email" control={control} render={({ field }) => (
                    <TextField {...field} label="Email" fullWidth size="small"
                      error={!!errors.email} helperText={errors.email?.message}
                      placeholder="ventas@central.com"
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 18, color: "#64748b" }} /></InputAdornment> } }} />
                  )} />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 3, textAlign: "center", fontSize: "1.8rem" }}>
        Gestión de Proveedores
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField variant="outlined" placeholder="Buscar proveedores..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ width: 320 }}
          />
          <Chip label="Ctrl+P" size="small" variant="outlined"
            sx={{ height: 20, fontSize: "0.55rem", color: "text.secondary", borderColor: "rgba(148,163,184,0.12)" }} />
        </Stack>
        <Button variant="contained" startIcon={<AddCircleOutline />} onClick={openAdd}>Nuevo Proveedor</Button>
      </Box>

      {loading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : (
        <Fade in={!loading} timeout={500}>
          <Box sx={{
            border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            bgcolor: isDark ? "rgba(17,24,39,0.7)" : "rgba(255,255,255,0.85)",
          }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: "#0f172a", color: "#f8fafc", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px", py: 1.5 }}>Proveedor</TableCell>
                    <TableCell sx={{ bgcolor: "#0f172a", color: "#f8fafc", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px", py: 1.5 }}>Contacto Principal</TableCell>
                    <TableCell sx={{ bgcolor: "#0f172a", color: "#f8fafc", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px", py: 1.5 }}>Comunicación</TableCell>
                    <TableCell align="right" sx={{ bgcolor: "#0f172a", color: "#f8fafc", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px", py: 1.5 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s) => (
                    <TableRow key={s.id} sx={{
                      "& .MuiTableCell-root": { py: 1.25 },
                      "&:hover .supplier-actions": { opacity: 1 },
                      "&:hover": { backgroundColor: isDark ? "rgba(59,130,246,0.06)" : "rgba(37,99,235,0.04)" },
                    }}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: isDark ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.08)", border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <LocalShipping sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                          </Box>
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>{s.address || "Sin dirección"}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.contact || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>{s.product_count || 0} productos</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Phone sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.8rem" }}>{s.phone || "—"}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Email sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.8rem" }}>{s.email || "—"}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" className="supplier-actions"
                          sx={{ opacity: 0, transition: "opacity 0.2s ease" }}>
                          <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(s)} sx={{ "&:hover": { backgroundColor: "rgba(37,99,235,0.08)" } }}><EditOutlined fontSize="small" sx={{ color: "text.secondary" }} /></IconButton></Tooltip>
                          <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => setDeleteConfirm(s)}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={4} align="center"><Typography color="textSecondary" sx={{ py: 4 }}>No hay proveedores</Typography></TableCell></TableRow>
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
          </Box>
        </Fade>
      )}

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (activeStep < steps.length - 1) handleNext();
            else handleSubmit(onSubmit)();
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: "20px",
            background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
            border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          },
        }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: "12px", background: "linear-gradient(135deg, #234e8c 0%, #1a3b6e 100%)", display: "flex" }}>
              <LocalShipping sx={{ color: "white", fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: "1.3rem" }}>
                {editItem ? "Editar Proveedor" : "Nuevo Proveedor"}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {editItem ? "Modifique la información del proveedor" : "Complete la información del proveedor"}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <StepIndicator steps={steps} activeStep={activeStep} />

        <DialogContent sx={{ px: 3, pb: 2, flex: 1, overflowY: "auto" }}>
          {submitError && <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>}
          {renderStepContent(activeStep)}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <Box>
            {activeStep > 0 && (
              <Button onClick={handleBack} startIcon={<ChevronLeft />} variant="outlined">Anterior</Button>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <CancelButton onClick={() => setModalOpen(false)}>Cancelar</CancelButton>
            {activeStep < steps.length - 1 ? (
              <Button onClick={handleNext} variant="contained" endIcon={<ChevronRight />}>Siguiente</Button>
            ) : (
              <Button onClick={handleSubmit(onSubmit)} variant="outlined" disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ borderColor: "success.main", color: "success.main", backgroundColor: "rgba(16,185,129,0.06)", "&:hover": { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "success.main" } }}>
                {isSubmitting ? "Guardando..." : editItem ? "Actualizar" : "Crear"}
              </Button>
            )}
          </Box>
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
