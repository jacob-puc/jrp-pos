import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Card, CardContent, Typography, Stack, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
} from "@mui/material";
import {
  Backup, RestorePage, Warning, Storage,
} from "@mui/icons-material";
import CancelButton from "./CancelButton";
import { CardSkeleton } from "./Skeletons";

const BackupRestore = () => {
  const [backups, setBackups] = useState([]);
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    const result = await window.api.invoke("get-backups");
    setBackups(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const createBackup = async () => {
    const result = await window.api.invoke("create-backup");
    if (result.success) {
      setMessage({ type: "success", text: `Respaldo creado: ${result.name} (${(result.size / 1024).toFixed(1)} KB)` });
      fetchBackups();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  const restoreBackup = async () => {
    if (!restoreConfirm) return;
    const result = await window.api.invoke("restore-backup", restoreConfirm.path);
    if (result.success) {
      setMessage({ type: "success", text: "Base de datos restaurada. Reinicia la aplicación para aplicar los cambios." });
      setRestoreConfirm(null);
      fetchBackups();
    } else {
      setMessage({ type: "error", text: result.error });
      setRestoreConfirm(null);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Box sx={{ p: 1, animation: "fadeIn 0.4s ease-out" }}>
      <Typography variant="h2" sx={{ mb: 3, textAlign: "center", fontSize: "1.8rem" }}>
        Respaldo y Restauración
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {loading ? <CardSkeleton count={2} /> : (
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mb: 4 }}>
        <Card sx={{ flex: 1, p: 3, textAlign: "center",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)",
          border: "2px solid rgba(37, 99, 235, 0.2)" }}>
          <CardContent>
            <Backup sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Crear Respaldo</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Genera una copia de seguridad de la base de datos actual
            </Typography>
            <Button variant="contained" size="large" onClick={createBackup} startIcon={<Backup />}>
              Crear Respaldo Ahora
            </Button>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, p: 3, textAlign: "center",
          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.15) 100%)",
          border: "2px solid rgba(245, 158, 11, 0.2)" }}>
          <CardContent>
            <Storage sx={{ fontSize: 48, color: theme.palette.warning.main, mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Respaldos Existentes</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {backups.length} respaldo{backups.length !== 1 ? "s" : ""} disponible{backups.length !== 1 ? "s" : ""}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
              {backups.length}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
      )}

      {!loading && backups.length > 0 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Archivo</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Tamaño</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((b, i) => (
                  <TableRow key={b.name} sx={{ "&:hover": { backgroundColor: "rgba(37, 99, 235, 0.06)" } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 500 }}>{b.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={formatSize(b.size)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(b.date).toLocaleDateString()}</Typography>
                      <Typography variant="caption" color="textSecondary">{new Date(b.date).toLocaleTimeString()}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined" color="warning" size="small"
                        startIcon={<RestorePage />}
                        onClick={() => setRestoreConfirm(b)}
                      >
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {!loading && backups.length === 0 && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="textSecondary">No hay respaldos disponibles. Crea tu primer respaldo.</Typography>
        </Card>
      )}

      <Dialog open={!!restoreConfirm} onClose={() => setRestoreConfirm(null)}>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Warning color="warning" />
            Restaurar Respaldo
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Restaurar el respaldo "{restoreConfirm?.name}"?
            <br /><br />
            <strong>Advertencia:</strong> Esta acción reemplazará TODOS los datos actuales de la base de datos.
            Los datos existentes se perderán permanentemente. Se recomienda crear un respaldo antes de restaurar.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
            <CancelButton onClick={() => setRestoreConfirm(null)}>Cancelar</CancelButton>
          <Button onClick={restoreBackup} color="warning" variant="contained" startIcon={<RestorePage />}>
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupRestore;
