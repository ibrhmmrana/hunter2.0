"use client";

import { Box, Container } from "@mui/material";

interface OnboardingShellProps {
  children: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
}

export default function OnboardingShell({ children, maxWidth = "md" }: OnboardingShellProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        py: 4,
      }}
    >
      <Container maxWidth={maxWidth} sx={{ width: "100%" }}>
        {children}
      </Container>
    </Box>
  );
}


