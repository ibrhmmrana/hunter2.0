"use client";

import { MessageSquare, TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightPill {
  icon: React.ReactNode;
  text: string;
}

interface InsightsStripProps {
  insights: InsightPill[];
}

export function InsightsStrip({ insights }: InsightsStripProps) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-2 rounded-xl border bg-card shadow-sm px-4 py-2.5",
            "text-sm text-foreground"
          )}
        >
          <div className="flex-shrink-0 text-muted-foreground" aria-hidden="true">
            {insight.icon}
          </div>
          <p className="line-clamp-1">{insight.text}</p>
        </div>
      ))}
    </div>
  );
}

// Icon components for convenience
export const InsightsIcons = {
  MessageSquare: (props: { className?: string }) => (
    <MessageSquare className={cn("h-4 w-4", props.className)} />
  ),
  TrendingUp: (props: { className?: string }) => (
    <TrendingUp className={cn("h-4 w-4", props.className)} />
  ),
  Star: (props: { className?: string }) => (
    <Star className={cn("h-4 w-4", props.className)} />
  ),
};






