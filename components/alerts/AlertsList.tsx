"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, TrendingUp, MessageSquare, Star, ExternalLink, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// Simple date formatter
function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString();
}

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

interface AlertsListProps {
  initialAlerts: Alert[];
}

const typeIcons = {
  competitor_new_review: MessageSquare,
  competitor_negative_review: AlertCircle,
  competitor_new_post: MessageSquare,
  competitor_trending_post: TrendingUp,
};

const typeLabels = {
  competitor_new_review: "New Review",
  competitor_negative_review: "Negative Review",
  competitor_new_post: "New Post",
  competitor_trending_post: "Trending Post",
};

const typeColors = {
  competitor_new_review: "bg-blue-50 text-blue-700 border-blue-200",
  competitor_negative_review: "bg-rose-50 text-rose-700 border-rose-200",
  competitor_new_post: "bg-purple-50 text-purple-700 border-purple-200",
  competitor_trending_post: "bg-amber-50 text-amber-700 border-amber-200",
};

export function AlertsList({ initialAlerts }: AlertsListProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleMarkAsRead = async (alertId: string) => {
    if (markingRead.has(alertId)) return;

    setMarkingRead((prev) => new Set(prev).add(alertId));

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });

      if (response.ok) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === alertId
              ? { ...alert, read_at: new Date().toISOString() }
              : alert
          )
        );
      }
    } catch (error) {
      console.error("[AlertsList] Error marking as read:", error);
    } finally {
      setMarkingRead((prev) => {
        const updated = new Set(prev);
        updated.delete(alertId);
        return updated;
      });
    }
  };

  // Fetch alerts function
  const fetchAlerts = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const response = await fetch("/api/alerts", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }

      const data = await response.json();
      
      if (data.ok && data.alerts) {
        setAlerts(data.alerts);
        setError(null); // Clear any previous errors on success
      } else {
        throw new Error(data.error || "Failed to fetch alerts");
      }
    } catch (err: any) {
      console.error("[AlertsList] Error fetching alerts:", err);
      // Only set error if we don't have any alerts to show
      // Use functional update to get current alerts state
      setAlerts((currentAlerts) => {
        if (currentAlerts.length === 0) {
          setError(err.message || "Failed to load alerts");
        }
        return currentAlerts; // Don't change alerts on error
      });
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // Auto-refresh alerts every 10 seconds
  useEffect(() => {
    // Initial fetch after component mounts (in case initialAlerts is stale)
    // Use a small delay to avoid blocking initial render
    const initialTimeout = setTimeout(() => {
      fetchAlerts(true);
    }, 500);

    // Set up polling interval (don't show loading spinner for background refreshes)
    pollingIntervalRef.current = setInterval(() => {
      fetchAlerts(false);
    }, 10000); // Refresh every 10 seconds

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const unreadCount = alerts.filter((a) => !a.read_at).length;

  // Show error state
  if (error && alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Error loading alerts</h3>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <Button onClick={fetchAlerts} disabled={isLoading} variant="outline">
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  if (alerts.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No alerts yet</h3>
        <p className="text-sm text-slate-600">
          When you add competitors to your watchlist, we'll notify you about their activity here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {unreadCount > 0 && (
          <p className="text-sm text-slate-600">
            {unreadCount} unread {unreadCount === 1 ? "alert" : "alerts"}
          </p>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type];
          const isRead = !!alert.read_at;

          return (
            <div
              key={alert.id}
              className={cn(
                "rounded-xl border p-4 transition-all",
                isRead
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200 shadow-sm"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    isRead ? "bg-slate-200" : typeColors[alert.type].split(" ")[0]
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isRead ? "text-slate-600" : typeColors[alert.type].split(" ")[1]
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1">
                      <h3
                        className={cn(
                          "text-sm font-semibold mb-2",
                          isRead ? "text-slate-600" : "text-slate-900"
                        )}
                      >
                        {alert.title}
                      </h3>
                      {/* Display message as pills/tags */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {alert.message.split(" | ").map((pill, index) => (
                          <span
                            key={index}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border font-medium",
                              isRead
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            )}
                          >
                            {pill}
                          </span>
                        ))}
                      </div>
                    </div>
                    {!isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(alert.id)}
                        disabled={markingRead.has(alert.id)}
                        className="h-8 w-8 p-0"
                      >
                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        typeColors[alert.type]
                      )}
                    >
                      {typeLabels[alert.type]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTimeAgo(alert.created_at)}
                    </span>
                    {alert.meta?.url && (
                      <a
                        href={alert.meta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

