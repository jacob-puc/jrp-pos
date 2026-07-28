import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, useTheme, Alert,
} from "@mui/material";
import {
  Add, Edit, Delete, Category, CheckCircle,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";
import { TableSkeleton } from "./Skeletons";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.api.invoke("get-categories");
      setCategories(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (cat = null) => {
    setEditing(cat);
    setForm(cat ? { name: cat.name, description: cat.description || "" } : { name: "", description: "" });
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    try {
      if (editing) {
        await window.api.invoke("update-category", editing.id, { name: form.name.trim(), description: form.description.trim() });
      } else {
        await window.api.invoke("add-category", { name: form.name.trim(), description: form.description.trim() });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const result = await window.api.invoke("delete-category", deleteConfirm.id);
      if (result.success) {
        setDeleteConfirm(null);
        load();
      } else {
        alert(result.error);
        setDeleteConfirm(null);
      }
    } catch {}
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Categorías</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona las categorías de productos
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}
          sx={{ borderRadius: "10px", fontWeight: 600 }}>
          Nueva Categoría
        </Button>
      </Stack>

      {loading ? <TableSkeleton rows={4} columns={4} /> : (
      <TableContainer component={Paper} sx={{
        borderRadius: "14px",
        border: `1px solid ${isDark ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.1)"}`,
      }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Productos</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Category sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  {c.description || "—"}
                </TableCell>
                <TableCell>
                  {c.product_count || 0}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(c)} sx={{ mr: 0.5 }}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteConfirm(c)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: isDark ? "#64748b" : "#94a3b8" }}>
                  <Category sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                  <Typography>No hay categorías registradas</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? "Editar Categoría" : "Nueva Categoría"}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Nombre" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }} autoFocus
            InputProps={{ startAdornment: <Category sx={{ mr: 1, fontSize: 20, color: "#234e8c" }} /> }} />
          <TextField fullWidth label="Descripción (opcional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setDialogOpen(false)}>Cancelar</CancelButton>
          <Button onClick={handleSave} variant="contained"
            startIcon={editing ? <CheckCircle /> : <Add />}>
            {editing ? "Guardar" : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Eliminar Categoría</DialogTitle>
        <DialogContent>
          <Typography>¿Eliminar <strong>{deleteConfirm?.name}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No se puede eliminar si tiene productos asociados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteConfirm(null)} variant="outlined">Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Categories;
