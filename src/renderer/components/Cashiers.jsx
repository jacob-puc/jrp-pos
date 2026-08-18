import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Stack, useTheme,
  Alert, InputAdornment, Avatar, Switch, FormHelperText,
} from "@mui/material";
import { User, Plus, Pencil, Trash2, Lock, CheckCircle2 } from "lucide-react";
import CancelButton from "./CancelButton";
import { TableSkeleton } from "./Skeletons";

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

const Cashiers = () => {
  const [cashiers, setCashiers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", pin: "", active: true });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.api.invoke("get-cashiers");
      setCashiers(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (cashier = null) => {
    setEditing(cashier);
    setForm(cashier
      ? { name: cashier.name, pin: "", active: cashier.is_active === 1 }
      : { name: "", pin: "", active: true });
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    if (!editing && !form.pin.trim()) { setError("El PIN es requerido"); return; }
    if (form.pin && !/^\d+$/.test(form.pin)) { setError("Solo números en el PIN"); return; }

    try {
      if (editing) {
        const data = {
          name: form.name.trim(),
          pin: form.pin,
          role: "cashier",
          is_active: editing.role === "admin" ? 1 : (form.active ? 1 : 0),
        };
        await window.api.invoke("update-cashier", editing.id, data);
      } else {
        await window.api.invoke("add-cashier", { name: form.name.trim(), pin: form.pin, role: "cashier" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este cajero?")) return;
    try {
      await window.api.invoke("delete-cashier", id);
      load();
    } catch {}
  };

  const roleColor = (role) => role === "admin" ? "primary" : "default";

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Cajeros</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona los usuarios del sistema
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => handleOpen()}
          sx={{ borderRadius: "6px", fontWeight: 600 }}>
          Nuevo Cajero
        </Button>
      </Stack>

      {loading ? <TableSkeleton rows={4} columns={4} /> : (
      <TableContainer component={Paper} sx={{
        borderRadius: "10px",
        border: `1px solid ${isDark ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.1)"}`,
      }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Rol</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cashiers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 32, height: 32, background: c.role === "admin"
                      ? "linear-gradient(135deg, #234e8c 0%, #1a3b6e 100%)"
                      : (isDark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.12)"),
                    }}>
                      <User size={18} color={c.role === "admin" ? "white" : undefined} />
                    </Avatar>
                    <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={c.role === "admin" ? "Propietario" : "Cajero"}
                    color={roleColor(c.role)}
                    variant={c.role === "admin" ? "filled" : "outlined"}
                    size="small"
                    sx={{ fontWeight: 600 }} />
                </TableCell>
                <TableCell>
                  <Chip label={c.is_active ? "Activo" : "Inactivo"}
                    color={c.is_active ? "success" : "error"}
                    size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  {c.role !== "admin" && (
                    <>
                      <IconButton size="small" onClick={() => handleOpen(c)} sx={{ mr: 0.5 }}>
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={18} />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
        PaperProps={{ sx: {
          borderRadius: "6px",
          boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.45)" : "0 15px 40px rgba(0,0,0,0.12)",
        } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? "Editar Cajero" : "Nuevo Cajero"}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ mb: 2 }}>
            <FieldLabel>Nombre</FieldLabel>
            <TextField fullWidth value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Juan Pérez"
              sx={inputSx}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}><User size={18} color="#64748b" style={{ display: "block" }} /></InputAdornment>,
                },
              }} />
          </Box>
          <Box>
            <FieldLabel>PIN de acceso</FieldLabel>
            <TextField fullWidth value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              type="password" inputProps={{ maxLength: 6 }}
              placeholder={editing ? "••••••" : "Mínimo 3 dígitos"}
              helperText={editing ? "Dejar vacío para mantener el actual" : "Mínimo 3 dígitos"}
              sx={inputSx}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}><Lock size={18} color="#64748b" style={{ display: "block" }} /></InputAdornment>,
                },
              }} />
          </Box>
          <Box sx={{ mt: 2.5, mb: 1 }}>
            <Box sx={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              p: 1.5, borderRadius: "6px",
              border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "rgba(37,99,235,0.12)"}`,
              background: isDark ? "rgba(59,130,246,0.04)" : "rgba(37,99,235,0.03)",
            }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {form.active ? "Usuario activo" : "Usuario inactivo"}
                </Typography>
                <FormHelperText sx={{ m: 0, fontSize: "0.72rem" }}>
                  {form.active
                    ? "Podrá iniciar sesión en la app móvil"
                    : "Bloqueado: no podrá acceder desde la app móvil"}
                </FormHelperText>
              </Box>
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                disabled={editing?.role === "admin"}
                sx={{ ml: 2 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <CancelButton onClick={() => setDialogOpen(false)}>Cancelar</CancelButton>
          <Button onClick={handleSave} variant="contained"
            sx={{ backgroundColor: "#234e8c", "&:hover": { backgroundColor: "#1a3b6e" } }}
            startIcon={editing ? <CheckCircle2 size={18} /> : <Plus size={18} />}>
            {editing ? "Guardar" : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cashiers;
