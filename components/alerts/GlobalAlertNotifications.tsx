"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, MessageSquare, AlertCircle, TrendingUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Alert {
  id: string;
  user_id: string;
  watchlist_id: string | null;
  type: 'competitor_new_review' | 'competitor_negative_review' | 'competitor_new_post' | 'competitor_trending_post';
  title: string;
  message: string;
  meta: any;
  created_at: string;
  read_at: string | null;
}

const typeIcons = {
  competitor_new_review: MessageSquare,
  competitor_negative_review: AlertCircle,
  competitor_new_post: MessageSquare,
  competitor_trending_post: TrendingUp,
};

const typeColors = {
  competitor_new_review: "bg-blue-50 text-blue-900 border-blue-200",
  competitor_negative_review: "bg-rose-50 text-rose-900 border-rose-200",
  competitor_new_post: "bg-purple-50 text-purple-700 border-purple-200",
  competitor_trending_post: "bg-amber-50 text-amber-700 border-amber-200",
};

interface AlertToast {
  id: string;
  alert: Alert;
  dismissed: boolean;
}

/**
 * Play a notification sound
 */
function playNotificationSound() {
  try {
    // Create a simple notification sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Fallback: try using HTML5 audio if Web Audio API fails
    console.warn("[GlobalAlertNotifications] Could not play notification sound:", error);
  }
}

export function GlobalAlertNotifications() {
  const router = useRouter();
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(new Set());
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Load seen alert IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hunter_seen_alerts');
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        const idsSet = new Set(ids);
        setSeenAlertIds(idsSet);
        seenAlertIdsRef.current = idsSet;
      }
    } catch (error) {
      console.warn("[GlobalAlertNotifications] Failed to load seen alerts from localStorage:", error);
    }
    // Mark as initialized after a short delay to ensure localStorage is loaded
    setTimeout(() => {
      isInitializedRef.current = true;
    }, 100);
  }, []);

  // Save seen alert IDs to localStorage
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    try {
      const idsArray = Array.from(seenAlertIds);
      localStorage.setItem('hunter_seen_alerts', JSON.stringify(idsArray));
      
      // Keep only last 1000 alert IDs to prevent localStorage from growing too large
      if (idsArray.length > 1000) {
        const trimmed = idsArray.slice(-1000);
        const trimmedSet = new Set(trimmed);
        setSeenAlertIds(trimmedSet);
        seenAlertIdsRef.current = trimmedSet;
        localStorage.setItem('hunter_seen_alerts', JSON.stringify(trimmed));
      }
    } catch (error) {
      console.warn("[GlobalAlertNotifications] Failed to save seen alerts to localStorage:", error);
    }
  }, [seenAlertIds]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch("/api/alerts", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      
      if (data.ok && data.alerts && Array.isArray(data.alerts)) {
        // Find new alerts (only those we haven't seen before - regardless of read status)
        // Once an alert is shown, it should never appear again, even if unread
        const newAlerts = data.alerts.filter(
          (alert: Alert) => !seenAlertIdsRef.current.has(alert.id)
        );

        if (newAlerts.length > 0) {
          console.log("[GlobalAlertNotifications] Found", newAlerts.length, "new alerts to display");
          // Mark all new alerts as seen IMMEDIATELY before showing them
          // This ensures they won't appear again even if the component re-renders
          const updatedSeenIds = new Set(seenAlertIdsRef.current);
          newAlerts.forEach((alert: Alert) => updatedSeenIds.add(alert.id));
          seenAlertIdsRef.current = updatedSeenIds;
          
          // Update state immediately
          setSeenAlertIds(updatedSeenIds);
          
          // Save to localStorage immediately
          try {
            const idsArray = Array.from(updatedSeenIds);
            localStorage.setItem('hunter_seen_alerts', JSON.stringify(idsArray));
          } catch (error) {
            console.warn("[GlobalAlertNotifications] Failed to save seen alerts:", error);
          }

          // Play sound for new alerts
          playNotificationSound();

          // Add new alerts as toasts (only the most recent ones if there are many)
          // Sort by created_at to get the newest first
          const sortedNewAlerts = [...newAlerts].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          const newToasts: AlertToast[] = sortedNewAlerts.map((alert: Alert) => ({
            id: alert.id,
            alert,
            dismissed: false,
          }));

          // Add new toasts and keep only the 2 most recent total
          setToasts((prev) => {
            const combined = [...prev, ...newToasts]
              .filter((toast) => !toast.dismissed)
              .sort((a, b) => 
                new Date(b.alert.created_at).getTime() - new Date(a.alert.created_at).getTime()
              )
              .slice(0, 2); // Only keep the 2 most recent
            
            return combined;
          });
        }
      }
    } catch (error) {
      console.error("[GlobalAlertNotifications] Error fetching alerts:", error);
    }
  };

  // Poll for new alerts every 10 seconds
  useEffect(() => {
    // Wait for initialization before starting to poll
    const checkInitialized = setInterval(() => {
      if (isInitializedRef.current) {
        clearInterval(checkInitialized);
        
        // Initial fetch immediately
        fetchAlerts();

        // Set up polling interval
        pollingIntervalRef.current = setInterval(() => {
          fetchAlerts();
        }, 10000); // Poll every 10 seconds
      }
    }, 100);

    return () => {
      clearInterval(checkInitialized);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.map((toast) => 
      toast.id === toastId ? { ...toast, dismissed: true } : toast
    ));
    
    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    }, 300);
  }, []);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    toasts.forEach((toast) => {
      if (!toast.dismissed) {
        const timer = setTimeout(() => {
          handleDismiss(toast.id);
        }, 5000);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, handleDismiss]);

  const handleClick = (alert: Alert) => {
    // Mark as read
    fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch((error) => {
      console.error("[GlobalAlertNotifications] Error marking alert as read:", error);
    });

    // Navigate to alerts page
    router.push("/alerts");
    handleDismiss(alert.id);
  };

  // Only show the 2 most recent non-dismissed toasts (sorted by creation date, newest first)
  const visibleToasts = toasts
    .filter((toast) => !toast.dismissed)
    .sort((a, b) => 
      new Date(b.alert.created_at).getTime() - new Date(a.alert.created_at).getTime()
    )
    .slice(0, 2); // Only show the 2 most recent

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {visibleToasts.map((toast) => {
          const Icon = typeIcons[toast.alert.type];
          const colorClass = typeColors[toast.alert.type];

          return (
            <div
              key={toast.id}
              onClick={() => handleClick(toast.alert)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 shadow-lg min-w-[320px] max-w-md pointer-events-auto",
                "bg-white cursor-pointer hover:shadow-xl transition-shadow",
                colorClass,
                "animate-in slide-in-from-top-5 fade-in duration-300",
                toast.dismissed && "animate-out slide-out-to-right fade-out duration-300"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold mb-1 line-clamp-1">
                  {toast.alert.title}
                </h4>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {toast.alert.message.split(" | ").map((pill, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-0.5 rounded-full border font-medium bg-white/50"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                {toast.alert.meta?.url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(toast.alert.meta.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(toast.id);
                  }}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

