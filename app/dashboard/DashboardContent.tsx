"use client";

import { useRef } from "react";
import Link from "next/link";
import { Container, Card, CardContent, Typography, Button, Box, Stack, Skeleton } from "@mui/material";
import { useToast, ToastContainer } from "@/components/Toast";
import BusinessHeroCard from "@/src/components/dashboard/BusinessHeroCard";
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
  const businessCardRef = useRef<{ openChangeDialog: () => void }>(null);

  // Determine image URL (prefer business image_url, fallback to row1)
  const businessImageUrl = businessData?.image_url || row1Data?.image_url || null;

  // Handle business change - navigate to business search
  const handleBusinessChange = () => {
    router.push("/onboarding/business/search");
  };

  return (
    <Container maxWidth="xl" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Stack spacing={2} sx={{ height: "100%", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Page Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <Typography variant="headlineLarge">
            My business
          </Typography>
          {businessData && (
            <Button
              variant="outlined"
              onClick={() => businessCardRef.current?.openChangeDialog()}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Change Business
            </Button>
          )}
        </Box>

        {/* My Business Section */}
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {isLoading ? (
            <Card
              sx={{
                borderRadius: 2,
                backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                p: 3,
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
                  gap: 3,
                }}
              >
                <Skeleton variant="rectangular" height={{ xs: 240, md: 340 }} sx={{ borderRadius: 2 }} />
                <Stack spacing={2}>
                  <Skeleton variant="text" width="75%" height={32} />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="66%" />
                </Stack>
              </Box>
            </Card>
          ) : businessData ? (
            <BusinessHeroCard
              ref={businessCardRef}
              business={{
                ...businessData,
                image_url: businessImageUrl,
                rating: row1Data?.rating_avg ?? businessData.rating ?? null,
                reviews_count: row1Data?.reviews_total ?? businessData.reviews_count ?? null,
                socialMediaSection: (
                  <SocialMediaSection
                    businessId={businessData.place_id}
                    initialSnapshots={socialSnapshots}
                    initialProfiles={socialProfiles}
                    googleReviewSnapshot={googleReviewSnapshot}
                  />
                ),
              }}
              onBusinessChange={handleBusinessChange}
            />
          ) : (
            <Card
              sx={{
                borderRadius: 2,
                backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              <CardContent sx={{ p: 3, textAlign: "center", py: 4 }}>
                <Typography
                  variant="bodyLarge"
                  sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41", mb: 2 }}
                >
                  No business data found. Please complete onboarding.
                </Typography>
                <Link href="/onboarding/business/search">
                  <Button
                    variant="contained"
                    sx={{
                      borderRadius: 999,
                      backgroundColor: (theme) => theme.palette.primary.main,
                      color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
                      textTransform: "none",
                      fontWeight: 500,
                    }}
                  >
                    Add Your Business
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Watchlist Alerts Widget */}
        {latestAlerts && latestAlerts.length > 0 && (
          <Box>
            <DashboardAlertsWidget initialAlerts={latestAlerts} />
          </Box>
        )}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </Stack>
    </Container>
  );
}

