"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  Menu,
  MenuItem,
  Badge,
  Avatar,
} from "@mui/material";
import MenuRounded from "@mui/icons-material/MenuRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import PeopleRounded from "@mui/icons-material/PeopleRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import CalendarTodayRounded from "@mui/icons-material/CalendarTodayRounded";
import StoreRounded from "@mui/icons-material/StoreRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { setGlobalLoading } from "@/components/DashboardContentLoader";
import { UnreadAlertsBadge } from "@/components/alerts/UnreadAlertsBadge";

const drawerWidth = 280;
const drawerWidthCollapsed = 72;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardRounded },
  { href: "/competitors", label: "Competitors", icon: PeopleRounded },
  { href: "/watchlist", label: "Watchlist", icon: VisibilityRounded },
  { href: "/scheduler", label: "Scheduler", icon: CalendarTodayRounded },
  { href: "/marketplace", label: "Marketplace", icon: StoreRounded },
  { href: "/ads", label: "My Ads", icon: AutoAwesomeRounded },
  { href: "/alerts", label: "Alerts", icon: NotificationsRounded },
  { href: "/settings", label: "Settings", icon: SettingsRounded },
];

export default function MaterialShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(true); // Desktop drawer collapsed state
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = React.useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    
    const fetchUserData = async () => {
      // First, try to get fresh user data
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.error('[MaterialShell] Error fetching user:', error);
        return;
      }

      // Debug: Log user metadata to see what's available
      console.log('[MaterialShell] User metadata:', user.user_metadata);
      console.log('[MaterialShell] Full user object:', user);
      
      // Get avatar URL from user metadata (Google sign-in)
      // Google OAuth typically stores it in 'avatar_url' or 'picture'
      const avatarUrl = user.user_metadata?.avatar_url || 
                       user.user_metadata?.picture ||
                       user.user_metadata?.photo_url ||
                       user.user_metadata?.image;
      
      console.log('[MaterialShell] Avatar URL found:', avatarUrl);
      
      if (avatarUrl) {
        setUserAvatarUrl(avatarUrl);
      } else {
        // If no avatar in metadata, try refreshing the session
        console.log('[MaterialShell] No avatar found, attempting to refresh session...');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const refreshedUser = session.user;
          const refreshedAvatarUrl = refreshedUser.user_metadata?.avatar_url || 
                                     refreshedUser.user_metadata?.picture ||
                                     refreshedUser.user_metadata?.photo_url ||
                                     refreshedUser.user_metadata?.image;
          if (refreshedAvatarUrl) {
            console.log('[MaterialShell] Avatar URL found after refresh:', refreshedAvatarUrl);
            setUserAvatarUrl(refreshedAvatarUrl);
          }
        }
      }

      // First, try to get name from user metadata (Google sign-in)
      const metadataName = user.user_metadata?.full_name || 
                          user.user_metadata?.name ||
                          user.user_metadata?.display_name;
      
      if (metadataName) {
        setUserName(metadataName);
        return;
      }

      // If not in metadata, fetch from profile table
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else {
        // Last resort: use email username (formatted)
        const emailName = (profile?.email || user.email || "").split("@")[0];
        if (emailName) {
          setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
        }
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
    handleMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const DrawerContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <Box
      sx={{
        p: collapsed ? 1.5 : 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        alignItems: collapsed ? "center" : "stretch",
        position: "relative",
      }}
    >
      {/* Hamburger Menu / Logo */}
      <Box sx={{ px: collapsed ? 0 : 1, pb: 2, width: "100%", display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>
        {collapsed ? (
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ color: "text.primary" }}
          >
            <MenuRounded />
          </IconButton>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              sx={{ color: "text.primary", mr: 0.5 }}
            >
              <MenuRounded />
            </IconButton>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
                H
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
              Hunter
            </Typography>
          </Box>
        )}
      </Box>


      {/* Navigation */}
      <List sx={{ flex: 1, width: "100%", overflowY: "auto" }}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href === "/dashboard" && pathname === "/");
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={isActive}
              onClick={() => {
                if (item.href !== pathname) {
                  setGlobalLoading(true);
                }
                if (!isDesktop) {
                  setMobileOpen(false);
                }
              }}
              sx={{
                py: collapsed ? 0.5 : 1,
                mb: 0.5,
                borderRadius: collapsed ? "50%" : 999,
                justifyContent: collapsed ? "center" : "flex-start",
                minHeight: collapsed ? 48 : "auto",
                width: collapsed ? 48 : "auto",
                mx: collapsed ? "auto" : 0,
                "&.Mui-selected": {
                  backgroundColor: (theme) => theme.palette.primaryContainer?.main || "#CFE9CF",
                  "& .MuiListItemIcon-root": {
                    color: (theme) => theme.palette.primary.main,
                  },
                  "& .MuiListItemText-primary": {
                    fontWeight: 700,
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 36,
                  justifyContent: "center",
                  color: isActive ? "primary.main" : "inherit",
                }}
              >
                <item.icon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
              {!collapsed && item.href === "/alerts" && (
                <Box sx={{ ml: "auto" }}>
                  <UnreadAlertsBadge />
                </Box>
              )}
            </ListItemButton>
          );
        })}
      </List>

      {/* Profile section - Fixed at bottom */}
      {!collapsed && (
        <Box
          sx={{
            mt: "auto",
            pt: 2,
            borderTop: "1px solid",
            borderColor: "outline.variant",
          }}
        >
          <ListItemButton
            onClick={handleMenuOpen}
            sx={{
              borderRadius: 999,
              py: 1,
              px: 1.5,
              minHeight: 48,
              "&:hover": {
                backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 20, mr: 1.5 }}>
              <Avatar 
                src={userAvatarUrl || undefined}
                onError={(e) => {
                  console.error('[MaterialShell] Failed to load avatar image:', userAvatarUrl);
                  // Fallback to icon if image fails to load
                  setUserAvatarUrl(null);
                }}
                sx={{ 
                  width: 32, 
                  height: 32, 
                  bgcolor: userAvatarUrl ? "transparent" : "primary.main",
                }}
              >
                {!userAvatarUrl && <AccountCircleRounded />}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={userName || "Profile"}
              primaryTypographyProps={{
                variant: "body2",
                noWrap: true,
                sx: {
                  fontSize: "14px",
                  fontWeight: 400,
                  color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                },
              }}
            />
          </ListItemButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>

      {/* Drawer */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerOpen ? drawerWidth : drawerWidthCollapsed,
            flexShrink: 0,
            transition: "width 0.2s ease",
            "& .MuiDrawer-paper": {
              width: drawerOpen ? drawerWidth : drawerWidthCollapsed,
              borderRight: "1px solid",
              borderColor: "outline.variant",
              backgroundColor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
              boxSizing: "border-box",
              transition: "width 0.2s ease",
              overflowX: "hidden",
            },
          }}
        >
          <DrawerContent collapsed={!drawerOpen} />
        </Drawer>
      ) : (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          variant="temporary"
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              backgroundColor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
            },
          }}
        >
          <DrawerContent collapsed={false} />
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 6,
          backgroundColor: "background.default",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: "left", vertical: "bottom" }}
        anchorOrigin={{ horizontal: "left", vertical: "top" }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            mt: 1,
            minWidth: 200,
          },
        }}
      >
        <MenuItem component={Link} href="/settings" onClick={handleMenuClose}>
          <ListItemIcon>
            <SettingsRounded fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}

