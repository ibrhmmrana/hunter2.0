"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { describeVelocity, describeVolume } from "@/lib/analytics/microcopy";

interface NextActionCardProps {
  hasGbp: boolean;
  reviewsTotal: number | null | undefined;
  reviewsLast30: number | null | undefined;
}

export function NextActionCard({
  hasGbp,
  reviewsTotal,
  reviewsLast30,
}: NextActionCardProps) {
  if (!hasGbp) {
    return (
      <Card className="rounded-2xl border-red-200 bg-red-50 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Not on Google Maps
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;re invisible to &quot;near me&quot; searches
              </p>
              <Link href="/onboard/verify">
                <Button
                  className="rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium"
                  aria-label="Create and verify your Google Business Profile"
                >
                  Create & Verify My Profile
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate contextual subtext based on velocity/volume
  const getSubtext = (): string => {
    const velocityText = describeVelocity(reviewsLast30);
    const volumeText = describeVolume(reviewsTotal);

    // Prioritize velocity insights if low, otherwise volume
    if (
      reviewsLast30 !== null &&
      reviewsLast30 !== undefined &&
      reviewsLast30 < 5
    ) {
      return velocityText;
    }

    if (
      reviewsTotal !== null &&
      reviewsTotal !== undefined &&
      reviewsTotal < 50
    ) {
      return volumeText;
    }

    return velocityText;
  };

  return (
    <Card className="rounded-2xl border shadow-md bg-gradient-to-r from-[#153E23]/5 to-transparent">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Boost your visibility this week
            </h3>
            <p className="text-sm text-muted-foreground">{getSubtext()}</p>
          </div>
          <Button
            className="rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium flex-shrink-0"
            aria-label="Ask 5 recent customers for reviews"
          >
            Ask 5 recent customers for reviews
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}






