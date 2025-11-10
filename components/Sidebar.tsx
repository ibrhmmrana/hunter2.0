"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { setGlobalLoading } from "./DashboardContentLoader";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Store,
  Bell,
  Settings,
  User,
  LogOut,
  Eye,
  Sparkles,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { UnreadAlertsBadge } from "@/components/alerts/UnreadAlertsBadge";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/competitors", label: "Competitors", icon: Users },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/scheduler", label: "Scheduler", icon: Calendar },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/ads", label: "My Ads", icon: Sparkles },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get user email on mount
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-64 border-r bg-card shadow-sm z-40">
      <div className="flex h-full flex-col">
        <div className="p-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  // Show loading immediately when link is clicked
                  if (item.href !== pathname) {
                    setGlobalLoading(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150 active:scale-[0.97] active:brightness-95",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.href === "/alerts" && <UnreadAlertsBadge />}
              </Link>
            );
          })}
        </nav>
        
        {/* Profile dropdown at bottom */}
        <div className="p-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-3 px-4 rounded-2xl hover:bg-accent"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userEmail || "Profile"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-2xl">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

