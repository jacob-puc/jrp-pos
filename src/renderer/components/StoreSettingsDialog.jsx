import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Typography, Box, Stack, useTheme, Switch, FormControlLabel, Divider,
} from "@mui/material";
import { Store, LocationOn, Save, CloudUpload, DeleteOutline } from "@mui/icons-material";

const resizeImage = (dataUrl, maxSize = 256) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const StoreSettingsDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [formData, setFormData] = useState({ storeName: "", address: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printTwoTickets, setPrintTwoTickets] = useState(false);
  const [printEnabled, setPrintEnabled] = useState(true);
  const [logo, setLogo] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await window.api.invoke("get-all-settings");
          setFormData({
            storeName: settings.store_name || "",
            address: settings.store_address || "",
          });
          setPrintTwoTickets(settings.print_two_tickets === "true");
          setPrintEnabled(settings.print_enabled !== "false");
          setLogo(settings.store_logo || "");
        } catch (err) {
          console.error("Error loading settings:", err);
        }
      };
      load();
    }
  }, [open]);

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result);
      setLogo(resized);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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
      await window.api.invoke("save-setting", "print_two_tickets", printTwoTickets ? "true" : "false");
      await window.api.invoke("save-setting", "print_enabled", printEnabled ? "true" : "false");
      await window.api.invoke("save-setting", "store_logo", logo);
      window.dispatchEvent(new CustomEvent("storeSettingsUpdated", {
        detail: { storeName: formData.storeName.trim().toUpperCase(), address: formData.address.trim(), storeLogo: logo },
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
          <Divider sx={{ my: 0.5 }} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleLogoChange}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: "14px", flexShrink: 0,
              border: "1px solid", borderColor: "divider", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "background.paper",
            }}>
              {logo ? (
                <img src={logo} alt="Logo de la tienda" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <Store sx={{ color: "#64748b", fontSize: 28 }} />
              )}
            </Box>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Logo de la tienda</Typography>
              <Typography variant="caption" color="textSecondary">
                Se muestra en el ticket, la barra superior y la pantalla de acceso.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderRadius: "10px", textTransform: "none" }}
                >
                  Subir logo
                </Button>
                {logo && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutline />}
                    onClick={() => setLogo("")}
                    sx={{ borderRadius: "10px", textTransform: "none" }}
                  >
                    Quitar
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <FormControlLabel
            control={<Switch checked={printEnabled} onChange={(e) => setPrintEnabled(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Imprimir tickets</Typography>
                <Typography variant="caption" color="textSecondary">
                  Imprime el ticket de cada venta
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={<Switch checked={printTwoTickets} disabled={!printEnabled} onChange={(e) => setPrintTwoTickets(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: printEnabled ? undefined : "text.disabled" }}>
                  Imprimir 2 tickets
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {printEnabled ? "Para pagos con tarjeta y transferencia" : "Activa \"Imprimir tickets\" para usarlo"}
                </Typography>
              </Box>
            }
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
