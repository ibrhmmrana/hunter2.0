"use client";
import { createTheme, alpha } from "@mui/material/styles";

// Extend palette for Material 3 color roles
declare module "@mui/material/styles" {
  interface Palette {
    primaryContainer: Palette["primary"];
    onPrimary: Palette["primary"];
    onPrimaryContainer: Palette["primary"];
    surfaceContainerLow: Palette["primary"];
    surfaceContainer: Palette["primary"];
    surfaceContainerHigh: Palette["primary"];
    onSurface: Palette["primary"];
    onSurfaceVariant: Palette["primary"];
    outlineVariant: Palette["primary"];
    tertiary: Palette["primary"];
    surface: {
      main: string;
      variant: string;
      container: string;
    };
    outline: {
      main: string;
      variant: string;
    };
  }
  interface PaletteOptions {
    primaryContainer?: PaletteOptions["primary"];
    onPrimary?: PaletteOptions["primary"];
    onPrimaryContainer?: PaletteOptions["primary"];
    surfaceContainerLow?: PaletteOptions["primary"];
    surfaceContainer?: PaletteOptions["primary"];
    surfaceContainerHigh?: PaletteOptions["primary"];
    onSurface?: PaletteOptions["primary"];
    onSurfaceVariant?: PaletteOptions["primary"];
    outlineVariant?: PaletteOptions["primary"];
    tertiary?: PaletteOptions["primary"];
    surface?: {
      main: string;
      variant: string;
      container: string;
    };
    outline?: {
      main: string;
      variant: string;
    };
  }

  interface TypographyVariants {
    displayLarge: React.CSSProperties;
    headlineLarge: React.CSSProperties;
    titleLarge: React.CSSProperties;
    titleMedium: React.CSSProperties;
    bodyLarge: React.CSSProperties;
    bodyMedium: React.CSSProperties;
    labelLarge: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayLarge?: React.CSSProperties;
    headlineLarge?: React.CSSProperties;
    titleLarge?: React.CSSProperties;
    titleMedium?: React.CSSProperties;
    bodyLarge?: React.CSSProperties;
    bodyMedium?: React.CSSProperties;
    labelLarge?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    displayLarge: true;
    headlineLarge: true;
    titleLarge: true;
    titleMedium: true;
    bodyLarge: true;
    bodyMedium: true;
    labelLarge: true;
  }
}

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    // M3 Primary (green)
    primary: { 
      main: "#2E7D32",
      light: "#60AD5E",
      dark: "#005005",
    },
    primaryContainer: { 
      main: "#CFE9CF",
      light: "#E3F2E3",
      dark: "#A8D4A8",
    },
    onPrimary: { 
      main: "#FFFFFF",
    },
    onPrimaryContainer: { 
      main: "#0E1F0E",
    },
    // M3 Secondary (indigo)
    secondary: { 
      main: "#5C6BC0",
      light: "#8E9DD9",
      dark: "#2E3D8F",
    },
    // M3 Tertiary (teal)
    tertiary: { 
      main: "#006875",
      light: "#4A9BA8",
      dark: "#003A42",
    },
    // M3 Surface roles
    background: { 
      default: "#F1F5EC",
    },
    surface: {
      main: "#F1F5EC",
      variant: "#E3E9DE",
      container: "#FFFFFF",
    },
    surfaceContainerLow: { 
      main: "#E9EEE4",
    },
    surfaceContainer: { 
      main: "#FFFFFF",
    },
    surfaceContainerHigh: { 
      main: "#F6FAF0",
    },
    // M3 On-surface roles
    onSurface: { 
      main: "#1B1C19",
    },
    onSurfaceVariant: { 
      main: "#444A41",
    },
    text: {
      primary: "#1B1C19",
      secondary: "#444A41",
    },
    // M3 Outline roles
    outline: {
      main: "#C7CEC3",
      variant: "#DDE4D8",
    },
    outlineVariant: { 
      main: "#DDE4D8",
    },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: "var(--font-roboto), Roboto, system-ui, sans-serif",
    // M3 Type Scale
    displayLarge: { 
      fontSize: "57px", 
      lineHeight: "64px", 
      fontWeight: 400, 
      letterSpacing: "-0.25px" 
    },
    headlineLarge: { 
      fontSize: "32px", 
      lineHeight: "40px", 
      fontWeight: 400 
    },
    titleLarge: { 
      fontSize: "22px", 
      lineHeight: "28px", 
      fontWeight: 500 
    },
    titleMedium: {
      fontSize: "16px",
      lineHeight: "24px",
      fontWeight: 500,
    },
    bodyLarge: { 
      fontSize: "16px", 
      lineHeight: "24px", 
      fontWeight: 400 
    },
    bodyMedium: {
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: 400,
    },
    labelLarge: { 
      fontSize: "14px", 
      lineHeight: "20px", 
      fontWeight: 500 
    },
    // Map existing variants to M3 scale
    h1: { fontSize: "32px", lineHeight: "40px", fontWeight: 400 },
    h2: { fontSize: "22px", lineHeight: "28px", fontWeight: 500 },
    h3: { fontSize: "18px", lineHeight: "24px", fontWeight: 500 },
    h4: { fontSize: "16px", lineHeight: "24px", fontWeight: 500 },
    h5: { fontSize: "14px", lineHeight: "20px", fontWeight: 500 },
    h6: { fontSize: "14px", lineHeight: "20px", fontWeight: 500 },
    body1: { fontSize: "16px", lineHeight: "24px", fontWeight: 400 },
    body2: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
    button: { textTransform: "none", fontWeight: 500, fontSize: "14px", lineHeight: "20px" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { 
          backgroundColor: "#F1F5EC",
          fontFamily: "var(--font-roboto), Roboto, system-ui, sans-serif",
        },
      },
    },
    // Ensure all Typography uses Roboto
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: "var(--font-roboto), Roboto, system-ui, sans-serif",
        },
      },
    },
    // M3 Card elevation via tonal surfaces
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#FFFFFF", // surfaceContainer
          boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
          border: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#FFFFFF", // surfaceContainer
          boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        },
        outlined: {
          borderColor: "#DDE4D8", // outlineVariant
          backgroundColor: "#FFFFFF",
        },
        elevation1: {
          backgroundColor: "#E9EEE4", // surfaceContainerLow
          boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        },
      },
    },
    // M3 Filled Button
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
          paddingBlock: 8,
          textTransform: "none",
          fontWeight: 500,
          fontSize: "14px",
          lineHeight: "20px",
        },
        contained: {
          backgroundColor: "#2E7D32", // primary
          color: "#FFFFFF", // onPrimary
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#005005", // primary.dark
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: "#C7CEC3", // outline
          color: "#2E7D32", // primary
          "&:hover": {
            borderColor: "#2E7D32",
            backgroundColor: alpha("#2E7D32", 0.08),
          },
        },
        text: {
          color: "#2E7D32", // primary
          "&:hover": {
            backgroundColor: alpha("#2E7D32", 0.08),
          },
        },
        // Tonal button (for secondary actions)
        containedSecondary: {
          backgroundColor: "#F6FAF0", // surfaceContainerHigh
          color: "#2E7D32", // primary
          "&:hover": {
            backgroundColor: "#E9EEE4", // surfaceContainerLow
          },
        },
      },
    },
    // M3 Navigation Drawer - Selected pill
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          marginInline: 8,
          color: "#444A41", // onSurfaceVariant
          "&:hover": {
            backgroundColor: alpha("#2E7D32", 0.08), // state layer
          },
          "&.Mui-selected": {
            backgroundColor: "#CFE9CF", // primaryContainer
            color: "#0E1F0E", // onPrimaryContainer
            "&:hover": {
              backgroundColor: "#B8DFB8", // slightly darker on hover
            },
            "& .MuiListItemIcon-root": {
              color: "#0E1F0E", // onPrimaryContainer
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: "#444A41", // onSurfaceVariant
          minWidth: 36,
        },
      },
    },
    // M3 TextField
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 999,
            backgroundColor: "#E3E9DE", // surface.variant
            "& fieldset": {
              borderColor: "transparent",
            },
            "&:hover fieldset": {
              borderColor: "transparent",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#2E7D32", // primary
            },
          },
        },
      },
    },
    // M3 Chip
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
        },
        filled: {
          backgroundColor: "#F6FAF0", // surfaceContainerHigh
          color: "#2E7D32", // primary
        },
        outlined: {
          borderColor: "#DDE4D8", // outlineVariant
          color: "#444A41", // onSurfaceVariant
        },
      },
    },
  },
});

export default theme;
