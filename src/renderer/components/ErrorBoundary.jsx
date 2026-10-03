import React from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { AlertTriangle, RefreshCw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            p: 3,
            bgcolor: "#0a0e1a",
            color: "#f8fafc",
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 4,
              maxWidth: 550,
              width: "100%",
              textAlign: "center",
              bgcolor: "rgba(17, 24, 39, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "16px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                bgcolor: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <AlertTriangle size={32} color="#ef4444" />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: "#f8fafc" }}>
              Ocurrió un error inesperado
            </Typography>

            <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
              La aplicación encontró un problema temporal durante la operación. Puedes reiniciar la vista sin perder tu sesión.
            </Typography>

            {this.state.error && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 3,
                  bgcolor: "rgba(0, 0, 0, 0.4)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  textAlign: "left",
                  maxHeight: 120,
                  overflow: "auto",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace",
                    color: "#f87171",
                    display: "block",
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                onClick={this.handleReset}
                sx={{
                  color: "#94a3b8",
                  borderColor: "rgba(148, 163, 184, 0.3)",
                  "&:hover": { borderColor: "#94a3b8", bgcolor: "rgba(148, 163, 184, 0.1)" },
                }}
              >
                Intentar de nuevo
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshCw size={18} />}
                onClick={this.handleReload}
                sx={{
                  bgcolor: "#2563eb",
                  "&:hover": { bgcolor: "#1d4ed8" },
                }}
              >
                Recargar Aplicación
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
