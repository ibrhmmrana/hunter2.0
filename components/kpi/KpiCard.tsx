"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  subtitle?: string;
  value: string | number | React.ReactNode;
  subtext?: string | React.ReactNode;
  breakdown?: React.ReactNode;
  tooltip?: React.ReactNode;
  className?: string;
}

export function KpiCard({
  title,
  subtitle,
  value,
  subtext,
  breakdown,
  tooltip,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("rounded-2xl border bg-card shadow-sm p-6", className)}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {tooltip}
        </div>
        <div>{value}</div>
        {subtext && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {subtext}
          </p>
        )}
        {breakdown && (
          <div className="text-xs text-muted-foreground">
            {breakdown}
          </div>
        )}
      </div>
    </Card>
  );
}

