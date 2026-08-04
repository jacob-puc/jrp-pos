import React, { useState, useEffect } from "react";
import {
  Box, Typography, Card, Grid, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, Alert,
} from "@mui/material";
import {
  Add, EditOutlined, DeleteOutlined, Category, CheckCircle,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";

const catColors = [
  { bg: "rgba(59,130,246,0.12)", icon: "#3b82f6", glow: "rgba(59,130,246,0.1)" },
  { bg: "rgba(79,70,229,0.12)", icon: "#4f46e5", glow: "rgba(79,70,229,0.1)" },
  { bg: "rgba(13,148,136,0.12)", icon: "#0d9488", glow: "rgba(13,148,136,0.1)" },
  { bg: "rgba(5,150,105,0.12)", icon: "#059669", glow: "rgba(5,150,105,0.1)" },
  { bg: "rgba(217,119,6,0.12)", icon: "#d97706", glow: "rgba(217,119,6,0.1)" },
  { bg: "rgba(236,72,153,0.12)", icon: "#db2777", glow: "rgba(236,72,153,0.1)" },
];

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <Grid container spacing={2.5}>
          {[0, 1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} lg={4} xl={3} key={i}>
              <Card sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", boxShadow: "none", height: 230 }} />
            </Grid>
          ))}
        </Grid>
      ) : categories.length === 0 ? (
        <Box sx={{ width: "100%", py: 10, textAlign: "center", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Category sx={{ fontSize: 48, mb: 1.5, opacity: 0.3 }} />
          <Typography>No hay categorías registradas</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {categories.map((c, i) => {
            const col = catColors[i % catColors.length];
            return (
              <Grid item xs={12} sm={6} lg={4} xl={3} key={c.id}>
                <Card sx={{
                  borderRadius: "12px",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "none",
                  position: "relative",
                  overflow: "hidden",
                  height: "100%",
                  minHeight: 230,
                  display: "flex",
                  flexDirection: "column",
                  transition: "box-shadow 0.2s ease",
                  "&:hover": { boxShadow: "0 12px 24px rgba(0,0,0,0.12)" },
                }}>
                  <Box sx={{
                    position: "absolute", top: 0, right: 0, width: 110, height: 110,
                    mr: -3, mt: -3, borderRadius: "50%", bgcolor: col.glow,
                    filter: "blur(2rem)", transition: "background-color 0.2s",
                  }} />
                  <Box sx={{ p: 3 }}>
                    <Box sx={{
                      width: 52, height: 52, borderRadius: "14px",
                      bgcolor: col.bg, display: "flex", alignItems: "center",
                      justifyContent: "center", mb: 2,
                    }}>
                      <Category sx={{ fontSize: 26, color: col.icon }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", mb: 0.5 }}>{c.name}</Typography>
                    <Typography sx={{ color: "#64748b", fontSize: "0.85rem", mb: 2, minHeight: 40 }}>
                      {c.description || "Sin descripción"}
                    </Typography>
                  </Box>
                  <Box sx={{
                    mt: "auto", pt: 1.5, pb: 1.5, px: 2.5,
                    borderTop: "1px solid", borderColor: "divider",
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b" }}>
                        {c.product_count || 0} Productos
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <IconButton size="small" onClick={() => handleOpen(c)}
                          sx={{ color: "#1e3a8a", p: 1, "&:hover": { bgcolor: "#f5f5f4" } }}>
                          <EditOutlined sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(c)} sx={{ p: 1 }}>
                          <DeleteOutlined sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? "Editar Categoría" : "Nueva Categoría"}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Nombre" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }} autoFocus
            slotProps={{ input: { startAdornment: <Category sx={{ mr: 1, fontSize: 20, color: "#234e8c" }} /> } }} />
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
