import React, { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const theme = useTheme();
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, severity = "success") => {
    setToast({ message, severity });
  }, []);

  const severity = toast?.severity ?? "info";
  const tint = `${theme.palette[severity]?.main ?? theme.palette.info.main}1A`;

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Snackbar
        key={toast ? `${toast.message}-${toast.severity}` : "none"}
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={severity}
          variant="outlined"
          onClose={() => setToast(null)}
          sx={{ backgroundColor: tint }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export default ToastProvider;