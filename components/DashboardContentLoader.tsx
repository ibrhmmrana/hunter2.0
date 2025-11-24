"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";

const drawerWidth = 280;

// Create a context to share loading state
let globalLoadingState: { isLoading: boolean; setLoading: (loading: boolean) => void } | null = null;

export function setGlobalLoading(loading: boolean) {
  if (globalLoadingState) {
    globalLoadingState.setLoading(loading);
  }
}

export function DashboardContentLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [isLoading, setIsLoading] = useState(false);
  const previousPathname = useRef(pathname);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Set up global loading state
  useEffect(() => {
    globalLoadingState = { isLoading, setLoading: setIsLoading };
    return () => {
      globalLoadingState = null;
    };
  }, [isLoading]);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathname.current = pathname;
      return;
    }

    // When pathname changes, show loading briefly
    if (pathname !== previousPathname.current) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Show loading immediately
      setIsLoading(true);
      
      // Update the previous pathname
      previousPathname.current = pathname;

      // Hide loading very quickly - Next.js App Router is fast
      // Just show a brief flash to indicate navigation started
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 50); // Very short - just 50ms for minimal visual feedback
      
      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      };
    }
  }, [pathname]);

  return (
    <Box sx={{ position: "relative", minHeight: 400 }}>
      {isLoading && (
        <Box
          sx={{
            position: "fixed",
            left: { xs: 0, md: drawerWidth },
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "background.default",
            backdropFilter: "blur(8px)",
          }}
        >
          <LoadingSpinner message="Loading page..." />
        </Box>
      )}
      <Box
        sx={{
          opacity: isLoading ? 0.5 : 1,
          pointerEvents: isLoading ? "none" : "auto",
          transition: "opacity 0.15s ease-in-out",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

