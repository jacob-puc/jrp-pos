export const tableContainerSx = {
  borderRadius: "6px",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

export const darkHeaderCellSx = {
  bgcolor: "#0f172a",
  color: "#f8fafc",
  fontWeight: 700,
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  py: 1.5,
  whiteSpace: "nowrap",
};

export const darkHeaderCellSortableSx = {
  ...darkHeaderCellSx,
  cursor: "pointer",
};