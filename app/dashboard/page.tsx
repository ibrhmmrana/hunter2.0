import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ensureGbpSnapshotUpToDate } from "@/lib/onboard/ensureGbpSnapshot";
import { getLatestReviewMetrics, ReviewMetrics } from "@/lib/analytics/reviewMetrics";
import { DashboardContent } from "./DashboardContent";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Redirect to sign-in if not authenticated
  if (userError || !user) {
    redirect("/sign-up");
  }

  const serviceSupabase = createServiceRoleClient();

  // Fetch profile to check onboarding status and get default business
  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("onboarding_completed_at, default_business_place_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("[dashboard] Error fetching profile:", profileError);
  }

  // If no profile or onboarding not completed, redirect to onboarding
  if (!profile || !profile.onboarding_completed_at) {
    // Check if they have a business - if yes, send to analytics, else search
    const { data: business } = await serviceSupabase
      .from("businesses")
      .select("place_id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (business) {
      redirect(`/onboard/analytics?place_id=${business.place_id}`);
    } else {
      redirect("/onboarding/business/search");
    }
  }

  // If no default_business_place_id, redirect to onboarding
  if (!profile.default_business_place_id) {
    redirect("/onboarding/business/search");
  }

  // Fetch business data using default_business_place_id
  let businessData: BusinessData | null = null;
  let row1Data: DashboardRow1Data | null = null;
  let reviewMetrics: ReviewMetrics | null = null;

  try {
    // Fetch business with additional fields for the card
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, name, address, city, website, phone, image_url, google_maps_url, updated_at, rating, reviews_count, categories")
      .eq("place_id", profile.default_business_place_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("[dashboard] Error fetching business:", businessError);
    } else if (business) {
      businessData = business;

      // Ensure GBP snapshot is up to date (this will also save review metrics)
      // This is important for images and reviews to be available
      // Do this synchronously to ensure data is ready, but don't block if it fails
      try {
        await ensureGbpSnapshotUpToDate(business.place_id);
        // Small delay to ensure data is written to DB
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error("[dashboard] Error ensuring GBP snapshot:", error);
        // Continue - we'll use existing data if available
      }

      // Fetch row1 data for this business
      const { data: row1, error: row1Error } = await serviceSupabase
        .from("dashboard_row1_presented_alias")
        .select("*")
        .eq("business_place_id", business.place_id)
        .order("snapshot_ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row1Error && row1Error.code !== "PGRST116") {
        console.error("[dashboard] Error fetching row1 data:", row1Error);
      } else if (row1) {
        row1Data = row1;
      }

      // Fetch review metrics for this business (as fallback if row1Data is null)
      reviewMetrics = await getLatestReviewMetrics(serviceSupabase, business.place_id);
    }
  } catch (err) {
    console.error("[dashboard] Error fetching dashboard data:", err);
  }

  // Fetch social media snapshots and profiles
  let socialSnapshots: any[] = [];
  let socialProfiles: any[] = [];
  let googleReviewSnapshot: any = null;

  if (businessData) {
    // Fetch latest snapshots for each network
    const networks: ('instagram' | 'tiktok' | 'facebook')[] = ['instagram', 'tiktok', 'facebook'];
    for (const network of networks) {
      const { data: snapshotData } = await serviceSupabase
        .from('social_snapshots')
        .select('*')
        .eq('business_id', businessData.place_id)
        .eq('network', network)
        .order('snapshot_ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotData) {
        socialSnapshots.push({
          network: snapshotData.network,
          posts_total: snapshotData.posts_total,
          posts_last_30d: snapshotData.posts_last_30d,
          days_since_last_post: snapshotData.days_since_last_post,
          engagement_rate: snapshotData.engagement_rate,
          followers: snapshotData.followers,
          snapshot_ts: snapshotData.snapshot_ts,
        });
      }
    }

    // Fetch social profiles
    const { data: profiles } = await serviceSupabase
      .from('social_profiles')
      .select('network, handle, profile_url')
      .eq('business_id', businessData.place_id)
      .in('network', networks);

    if (profiles) {
      socialProfiles = profiles;
    }

    // Fetch latest Google review snapshot
    const { data: googleSnapshot } = await serviceSupabase
      .from('google_review_snapshots')
      .select('*')
      .eq('business_id', businessData.place_id)
      .order('snapshot_ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (googleSnapshot) {
      googleReviewSnapshot = {
        negative_reviews: googleSnapshot.negative_reviews,
        positive_reviews: googleSnapshot.positive_reviews,
        days_since_last_review: googleSnapshot.days_since_last_review,
        total_reviews: googleSnapshot.total_reviews,
        reviews_distribution: googleSnapshot.reviews_distribution,
        snapshot_ts: googleSnapshot.snapshot_ts,
      };
    }
  }

  // Fetch latest alerts for dashboard widget
  let latestAlerts: any[] = [];
  if (user) {
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("id, type, title, message, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!alertsError && alerts) {
      latestAlerts = alerts;
    }
  }

  // If business not found, show friendly message (don't redirect - they're already onboarded)
  // The DashboardContent component will handle the empty state

  return (
    <DashboardContent
      businessData={businessData}
      row1Data={row1Data}
      reviewMetrics={reviewMetrics}
      socialSnapshots={socialSnapshots}
      socialProfiles={socialProfiles}
      googleReviewSnapshot={googleReviewSnapshot}
      latestAlerts={latestAlerts}
      isLoading={false}
    />
  );
}
