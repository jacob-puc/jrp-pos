import React from "react";
import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

const TableSkeleton = ({ rows = 5, columns = 4, height = 40 }) => (
  <TableContainer component={Paper} sx={{ borderRadius: "12px", overflow: "hidden" }}>
    <Table>
      <TableHead>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableCell key={i}>
              <Skeleton variant="text" width="80%" height={20} sx={{ bgcolor: "rgba(59,130,246,0.08)" }} />
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <TableCell key={c}>
                <Skeleton
                  variant="rectangular"
                  width={c === 0 ? "60%" : c === columns - 1 ? "40%" : "80%"}
                  height={height - 16}
                  sx={{ borderRadius: "2px", bgcolor: "rgba(148,163,184,0.06)" }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default TableSkeleton;
