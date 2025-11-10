"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, TrendingUp, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: 'competitor_new_review' | 'competitor_negative_review' | 'competitor_new_post' | 'competitor_trending_post';
  title: string;
  message: string;
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
  competitor_new_review: "text-blue-600",
  competitor_negative_review: "text-rose-600",
  competitor_new_post: "text-purple-600",
  competitor_trending_post: "text-amber-600",
};

export function DashboardAlertsWidget({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts.slice(0, 3));

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Watchlist Alerts</h3>
        <Link href="/alerts">
          <Button variant="ghost" size="sm" className="text-xs">
            View all
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type];
          const isUnread = !alert.read_at;

          return (
            <Link
              key={alert.id}
              href="/alerts"
              className={cn(
                "block rounded-lg border p-3 transition-all hover:shadow-sm",
                isUnread
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-100 bg-white"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isUnread ? "bg-slate-200" : "bg-slate-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isUnread ? typeColors[alert.type] : "text-slate-500"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className={cn(
                      "text-sm font-medium mb-1.5 truncate",
                      isUnread ? "text-slate-900" : "text-slate-600"
                    )}
                  >
                    {alert.title}
                  </h4>
                  {/* Display message as pills/tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {alert.message.split(" | ").map((pill, index) => (
                      <span
                        key={index}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium",
                          isUnread
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        )}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
                {isUnread && (
                  <div className="h-2 w-2 rounded-full bg-rose-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

