import React, { Fragment } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Check } from '@mui/icons-material';

const StepIndicator = ({ steps, activeStep }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2.5 }}>
      {steps.map((label, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        const isDarkStep = isActive || isDone;
        return (
          <Fragment key={label}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  bgcolor: isDarkStep
                    ? '#234e8c'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#e4e4e7',
                  color: isDarkStep ? '#fff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                {isDone ? <Check sx={{ fontSize: 15 }} /> : i + 1}
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive
                    ? isDark
                      ? '#e2e8f0'
                      : '#0f172a'
                    : isDark
                      ? '#64748b'
                      : '#94a3b8',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: '2px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
                }}
              />
            )}
          </Fragment>
        );
      })}
    </Box>
  );
};

export default StepIndicator;
