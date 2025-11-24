"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

export function UnreadAlertsBadge() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/alerts/unread-count");
        if (response.ok) {
          const data = await response.json();
          if (data.ok) {
            setUnreadCount(data.count);
          }
        }
      } catch (error) {
        console.error("[UnreadAlertsBadge] Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (unreadCount === null || unreadCount === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        ml: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        px: 1.5,
        borderRadius: 999,
        bgcolor: "error.main",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "white",
          fontSize: "0.75rem",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </Typography>
    </Box>
  );
}

