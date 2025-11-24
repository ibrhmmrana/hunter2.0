"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { formatNumber } from "@/lib/format";

interface SocialSnapshot {
  network: 'instagram' | 'tiktok' | 'facebook';
  posts_total: number | null;
  posts_last_30d: number | null;
  days_since_last_post: number | null;
  engagement_rate: number | null;
  followers: number | null;
  snapshot_ts: string;
}

interface BenchmarkBreakdownDialogProps {
  open: boolean;
  onClose: () => void;
  network: "instagram" | "tiktok" | "facebook";
  currentScore: number;
  benchmarkScore: number;
  reasoning?: string;
  benchmarkReasoning?: string;
  snapshot: SocialSnapshot | null;
}

export function BenchmarkBreakdownDialog({
  open,
  onClose,
  network,
  currentScore,
  benchmarkScore,
  reasoning,
  benchmarkReasoning,
  snapshot,
}: BenchmarkBreakdownDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const formatEngagementRate = (rate: number | null): string => {
    if (rate === null) return 'N/A';
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
          boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
          px: 3,
          pt: 3,
        }}
      >
        <Typography variant="titleLarge" sx={{ textTransform: "capitalize", fontWeight: 500 }}>
          {network} Performance Breakdown
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: (theme) => theme.palette.onSurfaceVariant?.main,
            "&:hover": {
              backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main,
            },
          }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Stack spacing={3}>
          {/* Your Score Section */}
          <Box>
            <Typography variant="titleMedium" sx={{ mb: 2, fontWeight: 600 }}>
              Your Score: {currentScore}
            </Typography>
            
            {snapshot && (
              <Box
                sx={{
                  bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
                  borderRadius: 2,
                  p: 2,
                  mb: 2,
                }}
              >
                <Typography variant="bodySmall" sx={{ mb: 1.5, fontWeight: 600, color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                  Metrics Used:
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                      Posts (30 days):
                    </Typography>
                    <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                      {snapshot.posts_last_30d !== null ? snapshot.posts_last_30d : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                      Engagement Rate:
                    </Typography>
                    <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                      {formatEngagementRate(snapshot.engagement_rate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                      Days Since Last Post:
                    </Typography>
                    <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                      {snapshot.days_since_last_post !== null ? snapshot.days_since_last_post : 'N/A'}
                    </Typography>
                  </Box>
                  {snapshot.followers !== null && (
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                        Followers:
                      </Typography>
                      <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                        {formatNumber(snapshot.followers)}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {reasoning && (
              <Box
                sx={{
                  bgcolor: (theme) => theme.palette.primaryContainer?.main || "#CFE9CF",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Typography variant="bodySmall" sx={{ mb: 1, fontWeight: 600, color: (theme) => theme.palette.onPrimaryContainer?.main }}>
                  Analysis:
                </Typography>
                <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onPrimaryContainer?.main }}>
                  {reasoning}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: (theme) => theme.palette.outlineVariant?.main }} />

          {/* Industry Standard Section */}
          <Box>
            <Typography variant="titleMedium" sx={{ mb: 2, fontWeight: 600 }}>
              Industry Standard: {benchmarkScore}
            </Typography>
            
            {benchmarkReasoning && (
              <Box
                sx={{
                  bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Typography variant="bodySmall" sx={{ mb: 1, fontWeight: 600, color: (theme) => theme.palette.onSurfaceVariant?.main }}>
                  Benchmark Explanation:
                </Typography>
                <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurface?.main }}>
                  {benchmarkReasoning}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: "flex-end",
          p: { xs: 2, md: 3 },
          borderTop: "1px solid",
          borderColor: (theme) => theme.palette.outlineVariant?.main,
          bgcolor: (theme) => theme.palette.surfaceContainerLow?.main,
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 500,
            fontSize: "14px",
            backgroundColor: (theme) => theme.palette.primary.main,
            color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
            "&:hover": {
              backgroundColor: (theme) => theme.palette.primary.dark || "#005005",
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

