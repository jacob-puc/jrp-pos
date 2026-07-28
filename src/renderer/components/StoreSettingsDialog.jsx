import React, { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Typography, Box, Stack, useTheme,
} from "@mui/material";
import { Store, LocationOn, Save } from "@mui/icons-material";

const StoreSettingsDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [formData, setFormData] = useState({ storeName: "", address: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await window.api.invoke("get-all-settings");
          setFormData({
            storeName: settings.store_name || "",
            address: settings.store_address || "",
          });
        } catch (err) {
          console.error("Error loading settings:", err);
        }
      };
      load();
    }
  }, [open]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!formData.storeName.trim()) newErrors.storeName = "El nombre es requerido";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await window.api.invoke("save-setting", "store_name", formData.storeName.trim());
      await window.api.invoke("save-setting", "store_address", formData.address.trim());
      window.dispatchEvent(new CustomEvent("storeSettingsUpdated", {
        detail: { storeName: formData.storeName.trim().toUpperCase(), address: formData.address.trim() },
      }));
      onClose();
    } catch (err) {
      setErrors({ submit: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
          borderRadius: "24px",
          border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(100, 116, 139, 0.2)"}`,
        },
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Store sx={{ color: "#234e8c" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Configuración de Tienda
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Nombre de la tienda"
            value={formData.storeName}
            onChange={handleChange("storeName")}
            error={!!errors.storeName}
            helperText={errors.storeName}
            fullWidth
            variant="outlined"
            autoFocus
            InputProps={{ sx: { borderRadius: "12px" } }}
          />

          <TextField
            label="Dirección"
            value={formData.address}
            onChange={handleChange("address")}
            fullWidth
            variant="outlined"
            multiline
            rows={2}
            InputProps={{
              sx: { borderRadius: "12px" },
              startAdornment: <LocationOn sx={{ color: "#64748b", mr: 1, fontSize: 18 }} />,
            }}
          />
        </Stack>

        {errors.submit && (
          <Typography color="error" variant="caption" sx={{ mt: 1, display: "block" }}>
            {errors.submit}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: "10px" }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isSubmitting}
          startIcon={<Save />}
          sx={{
            borderRadius: "10px",
            background: isDark ? "linear-gradient(135deg, #234e8c, #2d5fa8)" : "#234e8c",
            "&:hover": { background: isDark ? "linear-gradient(135deg, #1a3b6e, #234e8c)" : "#1a3b6e" },
          }}
        >
          {isSubmitting ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoreSettingsDialog;
