import React from "react";
import { Button } from "@mui/material";

const CancelButton = ({ children = "Cancelar", sx, ...props }) => (
  <Button
    variant="outlined"
    sx={{
      borderColor: "error.main",
      color: "error.main",
      backgroundColor: "rgba(239,68,68,0.06)",
      "&:hover": {
        backgroundColor: "rgba(239,68,68,0.12)",
        borderColor: "error.main",
      },
      ...sx,
    }}
    {...props}
  >
    {children}
  </Button>
);

export default CancelButton;
