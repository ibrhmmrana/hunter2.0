"use client";

import { Card } from "@/components/ui/card";
import { VisualTrustGauge } from "@/components/kpi/VisualTrustGauge";
import { describeVisualTrust } from "@/lib/analytics/microcopy";
import { cn } from "@/lib/utils";

interface VisualTrustCardProps {
  score: number | null | undefined;
}

export function VisualTrustCard({ score }: VisualTrustCardProps) {
  const { label, sub } = describeVisualTrust(score);

  return (
    <Card className={cn("rounded-2xl border bg-card shadow-md p-6 h-full flex flex-col")}>
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Visual Trust
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <VisualTrustGauge
            value={score ?? 0}
            size={112}
            strokeWidth={10}
            className="flex-shrink-0"
            showLabel={false}
          />
          <div className="text-center space-y-1">
            <p className="text-base font-semibold tracking-tight">{label}</p>
            <p className="text-sm text-muted-foreground line-clamp-1 max-w-[180px]">
              {sub}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

