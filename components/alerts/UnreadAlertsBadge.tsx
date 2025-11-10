"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
    <span
      className={cn(
        "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium",
        "bg-rose-500 text-white"
      )}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

