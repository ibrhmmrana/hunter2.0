"use client";

import { Box, Typography, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export interface BenchmarkScaleData {
  min: number;
  max: number;
  current: {
    value: number;
    label: string;
  };
  benchmark: {
    value: number;
    label: string;
  };
  showTicks?: boolean;
  endCaps?: boolean;
  orientation?: "horizontal" | "vertical";
}

interface BenchmarkScaleProps {
  data: BenchmarkScaleData;
  network: "instagram" | "tiktok" | "facebook";
}

export function BenchmarkScale({ data, network }: BenchmarkScaleProps) {
  const theme = useTheme();
  const {
    min,
    max,
    current,
    benchmark,
    showTicks = false,
    endCaps = true,
    orientation = "horizontal",
  } = data;

  // Calculate marker positions as percentages
  const currentPosition = ((current.value - min) / (max - min)) * 100;
  const benchmarkPosition = ((benchmark.value - min) / (max - min)) * 100;

  // Ensure positions are within bounds
  const clampedCurrent = Math.max(0, Math.min(100, currentPosition));
  const clampedBenchmark = Math.max(0, Math.min(100, benchmarkPosition));

  return (
    <Box sx={{ width: "100%", py: 2 }}>
      {/* Network Label removed - now shown in parent component with refresh button */}

      {/* Scale Container */}
      <Box sx={{ position: "relative", width: "100%", height: 100 }}>
        {/* Scale Line */}
        <Box
          sx={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {/* Filled portion (from min to current) */}
          <Box
            sx={{
              position: "absolute",
              left: 0,
              width: `${clampedCurrent}%`,
              height: "100%",
              backgroundColor: (theme) => theme.palette.primary.main,
              borderRadius: 2,
            }}
          />
        </Box>

        {/* End Caps */}
        {endCaps && (
          <>
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: 38,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                border: "2px solid",
                borderColor: (theme) => theme.palette.surface?.main || "#FFFFFF",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                right: 0,
                top: 38,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                border: "2px solid",
                borderColor: (theme) => theme.palette.surface?.main || "#FFFFFF",
              }}
            />
          </>
        )}

        {/* Current Marker */}
        <Box
          sx={{
            position: "absolute",
            left: `${clampedCurrent}%`,
            top: 34, // Position circle centered on the line (line center at 42px, circle is 16px, so top = 42 - 8 = 34px)
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          {/* Marker Circle - on the line */}
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: (theme) => theme.palette.primary.main,
              border: "2px solid",
              borderColor: (theme) => theme.palette.surface?.main || "#FFFFFF",
              boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
            }}
          />
          {/* Value - Below the circle */}
          <Typography
            variant="caption"
            sx={{
              mt: 0.5,
              fontWeight: 700,
              color: (theme) => theme.palette.primary.main,
              fontSize: "0.75rem",
            }}
          >
            {current.value}
          </Typography>
          {/* Label - Below the value */}
          <Typography
            variant="caption"
            sx={{
              mt: 0.25,
              fontWeight: 600,
              color: (theme) => theme.palette.primary.main,
              fontSize: "0.6875rem",
            }}
          >
            {current.label}
          </Typography>
        </Box>

        {/* Benchmark Marker */}
        <Box
          sx={{
            position: "absolute",
            left: `${clampedBenchmark}%`,
            top: 0,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          {/* Label */}
          <Typography
            variant="caption"
            sx={{
              mb: 0.5,
              fontWeight: 600,
              color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              fontSize: "0.6875rem",
            }}
          >
            {benchmark.label}
          </Typography>
          {/* Arrow */}
          <Box
            sx={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `8px solid ${theme.palette.onSurfaceVariant?.main || "#444A41"}`,
            }}
          />
          {/* Marker Circle */}
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              border: "2px solid",
              borderColor: (theme) => theme.palette.surface?.main || "#FFFFFF",
              boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
              mt: 0.5,
            }}
          />
          {/* Value */}
          <Typography
            variant="caption"
            sx={{
              mt: 0.5,
              fontWeight: 700,
              color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              fontSize: "0.75rem",
            }}
          >
            {benchmark.value}
          </Typography>
        </Box>

        {/* Ticks (optional) */}
        {showTicks && (
          <Box
            sx={{
              position: "absolute",
              top: 44,
              left: 0,
              right: 0,
              height: 20,
            }}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <Box
                key={tick}
                sx={{
                  position: "absolute",
                  left: `${tick}%`,
                  transform: "translateX(-50%)",
                  width: 1,
                  height: 8,
                  backgroundColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Min/Max Labels */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
            fontSize: "0.6875rem",
          }}
        >
          {min}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
            fontSize: "0.6875rem",
          }}
        >
          {max}
        </Typography>
      </Stack>
    </Box>
  );
}

