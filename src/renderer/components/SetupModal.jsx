import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import {
  Dialog, DialogContent, TextField, Button, Typography, Box, Card, CardContent,
  Alert, Avatar, Fade, useTheme, InputAdornment, IconButton, CircularProgress,
} from "@mui/material";
import {
  Store, Person, CheckCircle, LocationOn, ChevronRight, ChevronLeft, Lock, VisibilityOutlined, VisibilityOff,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
  50% { box-shadow: 0 0 40px rgba(59,130,246,0.6); }
`;

const checkScale = keyframes`
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`;

const SetupModal = ({ open, onComplete, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    storeName: "",
    ownerName: "",
    address: "",
    adminPin: "",
    mode: "host",
    hostUrl: "",
    activationCode: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [hostInfo, setHostInfo] = useState(null);
  const [hostInfoLoading, setHostInfoLoading] = useState(false);
  const [hostInfoError, setHostInfoError] = useState("");

  const steps = [
    { label: "Modo", icon: <Store sx={{ fontSize: 16 }} /> },
    { label: "Tienda", icon: <Store sx={{ fontSize: 16 }} /> },
    { label: formData.mode === "client" ? "Usuarios" : "Dueño", icon: <Person sx={{ fontSize: 16 }} /> },
    { label: "Listo", icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  ];

  useEffect(() => {
    if (formData.mode !== "client" || !formData.hostUrl.trim() || !formData.activationCode.trim()) {
      setHostInfo(null);
      setHostInfoError("");
      setHostInfoLoading(false);
      return undefined;
    }

    let cancelled = false;
    setHostInfo(null);
    setHostInfoError("");
    const timer = setTimeout(async () => {
      setHostInfoLoading(true);
      try {
        const result = await window.api.invoke("get-host-setup-info", {
          hostUrl: formData.hostUrl.trim(),
          activationCode: formData.activationCode.trim(),
        });
        if (cancelled) return;
        if (!result.success) {
          setHostInfoError(result.error || "No se pudieron cargar los datos del Host");
          return;
        }
        setHostInfo(result);
        setFormData((current) => ({
          ...current,
          storeName: result.storeName || current.storeName,
          ownerName: result.ownerName || current.ownerName,
          address: result.address || current.address,
        }));
      } catch (error) {
        if (!cancelled) setHostInfoError(error.message || "No se pudieron cargar los datos del Host");
      } finally {
        if (!cancelled) setHostInfoLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.mode, formData.hostUrl, formData.activationCode]);

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 0) {
      if (formData.mode === "client") {
        if (!formData.hostUrl.trim()) {
          newErrors.hostUrl = "La IP/Host del servidor es requerida";
        }
        if (!formData.activationCode.trim()) {
          newErrors.activationCode = "El código de activación es requerido";
        } else if (!hostInfo) {
          newErrors.activationCode = "Espera a que se validen los datos del Host";
        }
      }
    }

    if (step === 1) {
      if (!formData.storeName.trim()) {
        newErrors.storeName = "El nombre de la tienda es requerido";
      }
    }

    if (step === 2) {
      if (formData.mode === "client") {
        setErrors({});
        return true;
      }
      if (!formData.ownerName.trim()) {
        newErrors.ownerName = "El nombre del propietario es requerido";
      }
      if (!formData.adminPin.trim()) {
        newErrors.adminPin = "El PIN es requerido";
      } else if (formData.adminPin.length < 3) {
        newErrors.adminPin = "El PIN debe tener al menos 3 dígitos";
      } else if (!/^\d+$/.test(formData.adminPin)) {
        newErrors.adminPin = "Solo números permitidos";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFinish = async () => {
    if (!validateStep(2)) return;

    setIsSubmitting(true);
    try {
      if (formData.mode === "client") {
        // Emparejar con el Host: canjea el código de activación por un
        // token persistente y guarda la conexión en la configuración.
        const pair = await window.api.invoke("pair-with-host", {
          hostUrl: formData.hostUrl.trim(),
          activationCode: formData.activationCode.trim(),
        });
        if (!pair.success) {
          setErrors({ submit: pair.error || "No se pudo vincular con el Host" });
          setIsSubmitting(false);
          return;
        }
      }

      await window.api.invoke("save-setting", "store_name", formData.storeName.trim());
      await window.api.invoke("save-setting", "owner_name", formData.ownerName.trim());
      await window.api.invoke("save-setting", "store_address", formData.address.trim());
      const modeResult = await window.api.invoke("set-app-mode", formData.mode);
      if (!modeResult.success) throw new Error(modeResult.error || "No se pudo guardar el modo de caja");
      await window.api.invoke("save-setting", "setup_completed", "true");

      if (formData.mode === "host") {
        await window.api.invoke("add-cashier", { name: formData.ownerName.trim(), pin: formData.adminPin.trim(), role: "admin" });
      }

      setActiveStep(3);

      setTimeout(() => {
        onComplete({
          storeName: formData.storeName.trim(),
          ownerName: formData.ownerName.trim(),
          address: formData.address.trim(),
          mode: formData.mode,
        });
      }, 2000);
    } catch (error) {
      console.error("Error saving setup:", error);
      setErrors({ submit: "Error al guardar la configuración" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
    if (field === "hostUrl" || field === "activationCode") {
      setHostInfo(null);
      setHostInfoError("");
    }
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      onClose={onClose}
      disableEscapeKeyDown={!onClose}
      PaperProps={{
        sx: {
          background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
          borderRadius: "12px",
          border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.12)"}`,
          boxShadow: isDark ? "0 30px 80px rgba(30, 64, 175, 0.4)" : "0 30px 60px rgba(0, 0, 0, 0.1)",
          overflow: "visible",
          position: "relative",
        },
      }}
    >
      <Box sx={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 200, height: 200,
        background: `radial-gradient(circle, ${isDark ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.08)"} 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <DialogContent sx={{ position: "relative", zIndex: 1, pt: 3 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Avatar
            sx={{
              width: 64, height: 64, margin: "0 auto 12px",
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              animation: `${pulseGlow} 2s ease-in-out infinite`,
            }}
          >
            <Store sx={{ fontSize: 30 }} />
          </Avatar>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "1px",
            }}
          >
            SISTEMA VENTAS
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Configura tu tienda en 4 pasos
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", mb: 4, gap: 0 }}>
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Avatar
                  sx={{
                    width: 36, height: 36,
                    bgcolor: i < activeStep ? "#059669" : i === activeStep ? "#3b82f6" : (isDark ? "rgba(71,85,105,0.3)" : "rgba(148,163,184,0.25)"),
                    color: i <= activeStep ? "white" : (isDark ? "#64748b" : "#94a3b8"),
                    fontSize: 14, fontWeight: 700,
                    transition: "all 0.3s ease",
                    boxShadow: i === activeStep ? "0 0 20px rgba(59,130,246,0.4)" : "none",
                  }}
                >
                  {i < activeStep ? <CheckCircle sx={{ fontSize: 18 }} /> : i + 1}
                </Avatar>
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.5, fontWeight: i === activeStep ? 700 : 500,
                    color: i <= activeStep ? (isDark ? "#f1f5f9" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8"),
                    fontSize: "0.65rem",
                    transition: "color 0.3s",
                  }}
                >
                  {step.label}
                </Typography>
              </Box>
              {i < steps.length - 1 && (
                <Box
                  key={`line-${i}`}
                  sx={{
                    width: 60, height: 2, mx: 1, mb: 2,
                    borderRadius: 1,
                    background: i < activeStep
                      ? "linear-gradient(90deg, #059669, #3b82f6)"
                      : (isDark ? "rgba(71,85,105,0.2)" : "rgba(148,163,184,0.25)"),
                    transition: "background 0.3s",
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </Box>

        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>{errors.submit}</Alert>
        )}

        <Card sx={{
          background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(255, 255, 255, 0.8)",
          border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
        }}>
          <CardContent>
            {activeStep === 0 && (
              <Fade in={activeStep === 0} timeout={350}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Tipo de Caja
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Elige el rol de este equipo en tu negocio
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <Card
                      onClick={() => setFormData({ ...formData, mode: "host" })}
                      sx={{
                        flex: 1, cursor: "pointer",
                        border: formData.mode === "host" ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.3)",
                      }}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Caja Principal</Typography>
                        <Typography variant="caption" color="textSecondary">Administra la tienda y levanta el servidor API</Typography>
                      </CardContent>
                    </Card>
                    <Card
                      onClick={() => setFormData({ ...formData, mode: "client" })}
                      sx={{
                        flex: 1, cursor: "pointer",
                        border: formData.mode === "client" ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.3)",
                      }}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Caja Adicional</Typography>
                        <Typography variant="caption" color="textSecondary">Se conecta al servidor de la caja principal</Typography>
                      </CardContent>
                    </Card>
                  </Box>
                  {formData.mode === "client" && (
                    <>
                      <TextField
                        fullWidth
                        label="IP / Host del Servidor"
                        placeholder="Ej: 192.168.1.50:3456"
                        value={formData.hostUrl}
                        onChange={handleInputChange("hostUrl")}
                        error={!!errors.hostUrl}
                        helperText={errors.hostUrl}
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        fullWidth
                        label="Código de Activación"
                        placeholder="Código mostrado en la caja principal"
                        value={formData.activationCode}
                        onChange={handleInputChange("activationCode")}
                        error={!!errors.activationCode}
                        helperText={errors.activationCode}
                      />
                      {hostInfoLoading && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="caption">Conectando y cargando tienda y usuarios...</Typography>
                        </Box>
                      )}
                      {hostInfoError && <Alert severity="error" sx={{ mt: 1 }}>{hostInfoError}</Alert>}
                      {hostInfo && (
                        <Alert severity="success" sx={{ mt: 1 }}>
                          Host conectado: <strong>{hostInfo.storeName || "Tienda"}</strong>. Usuarios:{" "}
                          {hostInfo.cashiers.length
                            ? hostInfo.cashiers.map((cashier) => cashier.name).join(", ")
                            : "aún no hay usuarios activos"}
                        </Alert>
                      )}
                    </>
                  )}
                </Box>
              </Fade>
            )}
            {activeStep === 1 && (
              <Fade in={activeStep === 1} timeout={350}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    ¡Bienvenido!
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Cuéntanos sobre tu negocio
                  </Typography>
                  <TextField
                    fullWidth
                    label="Nombre de la Tienda"
                    placeholder="Ej: Mi Super Tienda"
                    value={formData.storeName}
                    onChange={handleInputChange("storeName")}
                    error={!!errors.storeName}
                    helperText={errors.storeName}
                    InputProps={{
                      startAdornment: (
                        <Store sx={{ color: "#234e8c", fontSize: 20, mr: 1 }} />
                      ),
                    }}
                    sx={{ mb: 2 }}
                    autoFocus
                  />
                  <TextField
                    fullWidth
                    label="Dirección (Opcional)"
                    placeholder="Ej: Calle Principal 123"
                    value={formData.address}
                    onChange={handleInputChange("address")}
                    multiline
                    rows={2}
                    InputProps={{
                      startAdornment: (
                        <LocationOn sx={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 20, mr: 1 }} />
                      ),
                    }}
                  />
                </Box>
              </Fade>
            )}
            {activeStep === 2 && (
              <Fade in={activeStep === 2} timeout={350}>
                <Box>
                  {formData.mode === "client" ? (
                    <>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Usuarios del Host
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Iniciarás sesión en esta caja con un usuario y PIN existentes en la caja principal.
                      </Typography>
                      {hostInfo?.cashiers?.length ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {hostInfo.cashiers.map((cashier) => (
                            <Alert key={cashier.id} severity="info" icon={<Person />}>
                              {cashier.name} · {cashier.role === "admin" ? "Administrador" : "Cajero"}
                            </Alert>
                          ))}
                        </Box>
                      ) : (
                        <Alert severity="warning">No hay usuarios activos cargados del Host.</Alert>
                      )}
                    </>
                  ) : (
                    <>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Información del Propietario
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                        Aparecerá en reportes y facturas
                      </Typography>
                  <TextField
                    fullWidth
                    label="Nombre del Propietario"
                    placeholder="Tu nombre completo"
                    value={formData.ownerName}
                    onChange={handleInputChange("ownerName")}
                    error={!!errors.ownerName}
                    helperText={errors.ownerName}
                    InputProps={{
                      startAdornment: (
                        <Person sx={{ color: "#234e8c", fontSize: 20, mr: 1 }} />
                      ),
                    }}
                    sx={{ mb: 2 }}
                    autoFocus
                  />
                  <TextField
                    fullWidth
                    label="PIN de acceso"
                    placeholder="Código de acceso numérico"
                    value={formData.adminPin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setFormData({ ...formData, adminPin: v });
                      if (errors.adminPin) setErrors({ ...errors, adminPin: null });
                    }}
                    error={!!errors.adminPin}
                    helperText={errors.adminPin || "Mínimo 3 dígitos"}
                    type={showPin ? "text" : "password"}
                    inputProps={{ maxLength: 6 }}
                    InputProps={{
                      startAdornment: (
                        <Lock sx={{ color: "#234e8c", fontSize: 20, mr: 1 }} />
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPin(!showPin)} edge="end" size="small">
                            {showPin ? <VisibilityOff fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                    </>
                  )}
                </Box>
              </Fade>
            )}
            {activeStep === 3 && (
              <Fade in={activeStep === 3} timeout={600}>
                <Box sx={{ textAlign: "center", py: 3 }}>
                  <Avatar
                    sx={{
                      width: 80, height: 80, margin: "0 auto 20px",
                      background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      animation: `${checkScale} 0.5s ease-out`,
                    }}
                  >
                    <CheckCircle sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      mb: 1,
                    }}
                  >
                    ¡Todo Listo!
                  </Typography>
                  <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
                    <strong style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>{formData.storeName}</strong> está configurada
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ opacity: 0.7 }}>
                    Redirigiendo al sistema...
                  </Typography>
                </Box>
              </Fade>
            )}
          </CardContent>
        </Card>
      </DialogContent>

      {activeStep < 3 && (
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 3, pb: 3 }}>
          <Box>
            {onClose && activeStep === 0 && (
              <CancelButton onClick={() => { setActiveStep(0); onClose(); }}>Cancelar</CancelButton>
            )}
            {activeStep > 0 && (
              <Button onClick={handleBack} startIcon={<ChevronLeft />}>
                Atrás
              </Button>
            )}
          </Box>
          {activeStep === steps.length - 2 ? (
            <Button
              variant="contained"
              onClick={handleFinish}
              disabled={isSubmitting}
              sx={{
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
                },
              }}
            >
              {isSubmitting ? "Guardando..." : "Finalizar"}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleNext} endIcon={<ChevronRight />}>
              Siguiente
            </Button>
          )}
        </Box>
      )}
    </Dialog>
  );
};

export default SetupModal;
