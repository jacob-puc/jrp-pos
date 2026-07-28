import React from "react";
import { Skeleton, Card, CardContent, Stack, Box } from "@mui/material";

const DetailSkeleton = () => (
  <Card sx={{ p: 3 }}>
    <CardContent sx={{ p: 0 }}>
      <Stack spacing={3}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Skeleton variant="circular" width={56} height={56} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={28} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
            <Skeleton variant="text" width="60%" height={18} sx={{ bgcolor: "rgba(148,163,184,0.06)" }} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" width="100%" height={180} sx={{ borderRadius: "12px", bgcolor: "rgba(148,163,184,0.06)" }} />
        <Stack spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={48} sx={{ borderRadius: "8px", bgcolor: "rgba(148,163,184,0.06)" }} />
          ))}
        </Stack>
      </Stack>
    </CardContent>
  </Card>
);

export default DetailSkeleton;
