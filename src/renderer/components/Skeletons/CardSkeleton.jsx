import React from "react";
import { Skeleton, Card, CardContent, Stack, Box } from "@mui/material";

const CardSkeleton = ({ count = 1, height = 120 }) => (
  <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} sx={{ flex: "1 1 200px", minWidth: 180, p: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <Stack spacing={1.5}>
            <Skeleton variant="text" width="50%" height={16} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
            <Skeleton variant="text" width="80%" height={32} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
            <Skeleton variant="text" width="30%" height={14} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
          </Stack>
        </CardContent>
      </Card>
    ))}
  </Stack>
);

export default CardSkeleton;
