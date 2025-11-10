"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VisualTrustGauge } from "@/components/kpi/VisualTrustGauge";
import { Star, AlertCircle, HelpCircle } from "lucide-react";
import { formatReviewCount } from "@/lib/format";
import { useToast, ToastContainer } from "@/components/Toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DashboardBusinessCard } from "@/components/DashboardBusinessCard";
import { ReviewMetrics } from "@/lib/analytics/reviewMetrics";
import { useRouter } from "next/navigation";
import { SocialMediaSection } from "@/components/SocialMediaSection";
import { DashboardAlertsWidget } from "@/components/alerts/DashboardAlertsWidget";

interface DashboardRow1Data {
  business_place_id: string;
  name: string;
  google_maps_url: string | null;
  image_url: string | null;
  snapshot_ts: string;
  has_gbp: boolean;
  rating_avg: number | null;
  reviews_average?: number | null;
  reviews_total: number | null;
  reviews_last_30: number | null;
  negative_count: number | null;
  negative_share_percent: number | null;
  visual_trust: number | null;
  ui_variant: string | null;
  negative_subtext: string | null;
}

interface BusinessData {
  place_id: string;
  name: string;
  address: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  image_url: string | null;
  google_maps_url: string | null;
  updated_at: string;
  rating?: number | null;
  reviews_count?: number | null;
  categories?: string[] | null;
}

interface DashboardContentProps {
  businessData: BusinessData | null;
  row1Data: DashboardRow1Data | null;
  reviewMetrics?: ReviewMetrics | null;
  socialSnapshots?: any[];
  socialProfiles?: any[];
  googleReviewSnapshot?: any;
  latestAlerts?: any[];
  isLoading?: boolean;
}

export function DashboardContent({ businessData, row1Data, reviewMetrics = null, socialSnapshots = [], socialProfiles = [], googleReviewSnapshot = null, latestAlerts = [], isLoading = false }: DashboardContentProps) {
  const { toasts, dismissToast } = useToast();
  const router = useRouter();

  // Determine image URL (prefer business image_url, fallback to row1)
  const businessImageUrl = businessData?.image_url || row1Data?.image_url || null;

  // Handle business change - use hard navigation to avoid showing old data
  const handleBusinessChange = (placeId: string) => {
    // The component will handle the navigation itself
    // This is just a placeholder callback
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      </div>

      {/* My Business Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">My business</h2>
        {isLoading ? (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5">
                  <div className="aspect-video bg-gray-200 animate-pulse rounded-xl" />
                </div>
                <div className="lg:col-span-7 space-y-4">
                  <div className="h-8 bg-gray-200 animate-pulse rounded-lg w-3/4" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded-lg w-full" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded-lg w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : businessData ? (
          <DashboardBusinessCard
            business={{
              ...businessData,
              image_url: businessImageUrl,
              rating: row1Data?.rating_avg ?? businessData.rating ?? null,
              reviews_count: row1Data?.reviews_total ?? businessData.reviews_count ?? null,
            }}
            onBusinessChange={handleBusinessChange}
          />
        ) : (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No business data found. Please complete onboarding.
                </p>
                <Link href="/onboarding/business/search">
                  <Button className="rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium">
                    Add Your Business
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analytics Section (no heading) */}
      {businessData && (
        <SocialMediaSection
          businessId={businessData.place_id}
          initialSnapshots={socialSnapshots}
          initialProfiles={socialProfiles}
          googleReviewSnapshot={googleReviewSnapshot}
        />
      )}

      {/* Watchlist Alerts Widget */}
      {latestAlerts && latestAlerts.length > 0 && (
        <div>
          <DashboardAlertsWidget initialAlerts={latestAlerts} />
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

