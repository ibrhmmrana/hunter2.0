import { SupabaseClient } from "@supabase/supabase-js";

export const FRESH_MINUTES = 1440; // 24 hours

export interface ReviewsDistribution {
  five?: number;
  four?: number;
  three?: number;
  two?: number;
  one?: number;
}

export interface Row1Data {
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
  reviews_distribution?: ReviewsDistribution | null;
}

export interface FetchRow1Result {
  row: Row1Data | null;
  isFresh: boolean;
}

/**
 * Resolve place_id from URL searchParams or latest business
 */
export async function resolvePlaceId(
  supabase: SupabaseClient,
  searchParamsPlaceId: string | null
): Promise<string | null> {
  // First check URL query param
  if (searchParamsPlaceId) {
    console.info("analytics:resolve:from-url", searchParamsPlaceId);
    return searchParamsPlaceId;
  }

  // Otherwise fetch most recent business
  const { data, error } = await supabase
    .from("businesses")
    .select("place_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error resolving place_id:", error);
    return null;
  }

  if (data?.place_id) {
    console.info("analytics:resolve:from-db", data.place_id);
    return data.place_id;
  }

  console.info("analytics:resolve:none");
  return null;
}

/**
 * Fetch the latest Row-1 KPI data for a place_id
 */
export async function fetchRow1(
  supabase: SupabaseClient,
  placeId: string
): Promise<FetchRow1Result> {
  const { data: row, error } = await supabase
    .from("dashboard_row1_presented_alias")
    .select("*")
    .eq("business_place_id", placeId)
    .order("snapshot_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!row) {
    return { row: null, isFresh: false };
  }

  // Try to get reviews_distribution from the view or from snapshots_gbp.raw
  let reviewsDistribution: ReviewsDistribution | null = null;

  // First try from the view itself
  if ((row as any).reviews_distribution) {
    try {
      const dist = typeof (row as any).reviews_distribution === 'string'
        ? JSON.parse((row as any).reviews_distribution)
        : (row as any).reviews_distribution;
      reviewsDistribution = dist;
    } catch (e) {
      // Ignore parse errors
    }
  }

  // If not in view, try fetching from snapshots_gbp.raw
  if (!reviewsDistribution) {
    const { data: snapshot } = await supabase
      .from("snapshots_gbp")
      .select("raw")
      .eq("business_place_id", placeId)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot?.raw && typeof snapshot.raw === 'object') {
      const raw = snapshot.raw as any;
      if (raw.reviews_distribution) {
        reviewsDistribution = raw.reviews_distribution;
      }
    }
  }

  // Check freshness
  const snapshotDate = new Date(row.snapshot_ts);
  const now = new Date();
  const diffMs = now.getTime() - snapshotDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  const isFresh = diffMinutes <= FRESH_MINUTES;

  return {
    row: {
      ...(row as Row1Data),
      reviews_distribution: reviewsDistribution,
    },
    isFresh,
  };
}

/**
 * Subscribe to realtime changes on snapshots_gbp table
 * Returns an unsubscribe function
 */
export function subscribeRow1(
  supabase: SupabaseClient,
  placeId: string,
  onHit: () => void
): () => void {
  console.info("analytics:realtime:subscribe", { placeId });

  const channel = supabase
    .channel(`row1-${placeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "snapshots_gbp",
        filter: `business_place_id=eq.${placeId}`,
      },
      (payload) => {
        console.info("analytics:realtime:event", {
          eventType: payload.eventType,
          placeId,
        });
        onHit();
      }
    )
    .subscribe();

  return () => {
    console.info("analytics:realtime:unsubscribe", { placeId });
    channel.unsubscribe();
  };
}

