"use client";

import { Card, CardContent, Box, Typography, IconButton, Stack } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import Instagram from "@mui/icons-material/Instagram";
import Facebook from "@mui/icons-material/Facebook";
import { SvgIconComponent } from "@mui/icons-material";

interface ConnectAccountCardProps {
  network: "instagram" | "tiktok" | "facebook";
  label: string;
  icon?: SvgIconComponent;
  isConnected?: boolean;
  onClick?: () => void;
  onAdd?: () => void;
}

export default function ConnectAccountCard({
  network,
  label,
  icon: Icon,
  isConnected = false,
  onClick,
  onAdd,
}: ConnectAccountCardProps) {
  // Default icons
  const defaultIcons: Record<string, SvgIconComponent> = {
    instagram: Instagram,
    facebook: Facebook,
    tiktok: Instagram, // Fallback - you might want to add a custom TikTok icon
  };

  const DisplayIcon = Icon || defaultIcons[network] || Instagram;

  return (
    <Card
      sx={{
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        border: isConnected
          ? `1px solid ${(theme) => theme.palette.outlineVariant?.main || "#DDE4D8"}`
          : "none",
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        "&:hover": onClick
          ? {
              boxShadow: "0px 2px 4px rgba(0,0,0,0.12)",
            }
          : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3, position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
        {onAdd && !isConnected && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <AddRounded />
          </IconButton>
        )}

        <Stack spacing={2} sx={{ flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <DisplayIcon sx={{ fontSize: 28 }} />
          </Box>

          <Typography
            variant="titleMedium"
            sx={{
              fontWeight: 500,
              color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
            }}
          >
            {label}
          </Typography>

          {isConnected && (
            <Typography
              variant="bodyMedium"
              sx={{
                color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              }}
            >
              Connected
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

