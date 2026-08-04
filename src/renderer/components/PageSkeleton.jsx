import React from "react";
import { Box, Skeleton, Stack } from "@mui/material";

const PageSkeleton = () => (
  <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
    <Skeleton variant="text" width={200} height={36} sx={{ mb: 2, mx: "auto" }} />
    <Stack spacing={1.5}>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: "12px" }} />
      ))}
    </Stack>
  </Box>
);

export default PageSkeleton;
