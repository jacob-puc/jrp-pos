import React from "react";
import { Button } from "@mui/material";

const CancelButton = ({ children = "Cancelar", sx, ...props }) => (
  <Button
    variant="outlined"
    sx={{
      borderColor: "#64748b",
      color: "#64748b",
      backgroundColor: "rgba(100,116,139,0.06)",
      "&:hover": {
        backgroundColor: "rgba(100,116,139,0.12)",
        borderColor: "#64748b",
      },
      ...sx,
    }}
    {...props}
  >
    {children}
  </Button>
);

export default CancelButton;
