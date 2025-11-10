/**
 * Shared analytics logic for competitor insights.
 * 
 * This module centralizes the logic for fetching competitor ranking data
 * that is used in both onboarding analytics and the competitors page.
 */

import { createServiceRoleClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TopSearchRanking {
  query: string;
  position: number | null;
  totalResults: number | null;
  isLoosenedQuery: boolean;
  heading?: string;
  isChasers?: boolean;
}

export interface CompetitorLeader {
  name: string;
  placeId: string;
  rating: number | null;
  reviews: number | null;
  address?: string;
  isYou?: boolean;
  rank?: number;
  distance_m?: number | null;
  photo_reference?: string | null;
  photos?: string[];
}

export interface CompetitorInsights {
  businessName: string;
  businessPlaceId: string;
  topSearch: TopSearchRanking | null;
  leaders: CompetitorLeader[]; // Search ranking leaders from top_search
  aheadCompetitors: CompetitorLeader[]; // General competitors that are ahead (from business_competitors)
  yourStats?: {
    rating: number | null;
    reviews: number | null;
  };
}

interface GetBusinessCompetitorInsightsParams {
  supabaseServerClient: SupabaseClient;
  userId?: string; // Optional - if not provided, placeId must be provided
  placeId?: string; // Optional - if not provided, will use default_business_place_id from profile
}

/**
 * Get competitor insights for a business.
 * 
 * This function:
 * 1. Resolves the business place_id (from params or user's default_business_place_id)
 * 2. Fetches the business data
 * 3. Loads top search ranking from business_insights
 * 4. Loads competitor leaders from business_competitors or top_search
 * 
 * Returns null if no business is found.
 */
export async function getBusinessCompetitorInsights({
  supabaseServerClient,
  userId,
  placeId: providedPlaceId,
}: GetBusinessCompetitorInsightsParams): Promise<CompetitorInsights | null> {
  let placeId: string | null = providedPlaceId || null;

  // If no placeId provided, get from user's default business
  if (!placeId && userId) {
    const { data: profile, error: profileError } = await supabaseServerClient
      .from("profiles")
      .select("default_business_place_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[getBusinessCompetitorInsights] Error fetching profile:", profileError);
      return null;
    }

    placeId = profile?.default_business_place_id || null;
  }

  if (!placeId) {
    return null;
  }

  // 2. Get business data and user stats
  const serviceSupabase = createServiceRoleClient();
  const { data: business, error: businessError } = await serviceSupabase
    .from("businesses")
    .select("place_id, name")
    .eq("place_id", placeId)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[getBusinessCompetitorInsights] Error fetching business:", businessError);
    return null;
  }

  // Get user's business stats (rating, reviews) from google_review_snapshots
  const { data: latestSnapshot } = await serviceSupabase
    .from("google_review_snapshots")
    .select("rating_avg, reviews_total")
    .eq("business_place_id", placeId)
    .order("snapshot_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const yourStats = {
    rating: latestSnapshot?.rating_avg ?? null,
    reviews: latestSnapshot?.reviews_total ?? null,
  };

  // 3. Fetch top search ranking from business_insights
  const { data: insights, error: insightsError } = await serviceSupabase
    .from("business_insights")
    .select("top_search")
    .eq("business_place_id", placeId)
    .maybeSingle();

  if (insightsError) {
    console.error("[getBusinessCompetitorInsights] Error fetching insights:", insightsError);
  }

  // Parse top_search data
  let topSearch: TopSearchRanking | null = null;
  if (insights?.top_search) {
    const topSearchData = insights.top_search as any;
    // Only create topSearch if we have a query OR if we have leaders (leaders might exist without query in some edge cases)
    if (topSearchData.query || (topSearchData.leaders && topSearchData.leaders.length > 0)) {
      topSearch = {
        query: topSearchData.query || "",
        position: topSearchData.userRank ?? null,
        totalResults: topSearchData.leaders?.length ? topSearchData.leaders.length + (topSearchData.userRank || 0) : null,
        isLoosenedQuery: topSearchData.isChasers || false,
        heading: topSearchData.heading,
        isChasers: topSearchData.isChasers,
      };
    } else {
      console.log("[getBusinessCompetitorInsights] top_search exists but has no query or leaders", {
        placeId,
        hasQuery: !!topSearchData.query,
        hasLeaders: !!(topSearchData.leaders && topSearchData.leaders.length > 0),
      });
    }
  } else {
    console.log("[getBusinessCompetitorInsights] No top_search data found in business_insights", { placeId });
  }

  // 4. Fetch search ranking leaders from top_search
  let leaders: CompetitorLeader[] = [];
  if (insights?.top_search?.leaders) {
    // Use leaders from top_search (these are the actual search ranking leaders)
    const topSearchLeaders = (insights.top_search as any).leaders || [];
    leaders = topSearchLeaders.map((leader: any) => ({
      name: leader.name || "",
      placeId: leader.place_id || "",
      rating: leader.rating ?? null,
      reviews: leader.user_ratings_total ?? null,
      rank: leader.rank ?? undefined,
      distance_m: leader.distance_m ?? null,
      photo_reference: leader.photo_reference ?? null,
      photos: leader.photos || (leader.photo_reference ? [leader.photo_reference] : []),
      isYou: false,
    }));
  }

  // 5. Fetch general competitors that are ahead (from business_competitors)
  // These are competitors that meet criteria like more reviews, equal/better rating, etc.
  let aheadCompetitors: CompetitorLeader[] = [];
  const { data: competitors, error: competitorsError } = await serviceSupabase
    .from("business_competitors")
    .select("competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw")
    .eq("business_place_id", placeId)
    .order("is_stronger", { ascending: false })
    .order("reviews_total", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(6);

  if (competitorsError) {
    console.error("[getBusinessCompetitorInsights] Error fetching competitors:", competitorsError);
  } else if (competitors) {
    aheadCompetitors = competitors.map((comp, index) => {
      // Extract photo_reference from raw field if available
      const photoRef = (comp.raw as any)?.photo_reference as string | undefined;
      const photos = (comp.raw as any)?.photos as string[] | undefined;
      
      return {
        name: comp.name || "",
        placeId: comp.competitor_place_id || "",
        rating: comp.rating_avg ?? null,
        reviews: comp.reviews_total ?? null,
        distance_m: comp.distance_m ?? null,
        photo_reference: photoRef ?? null,
        photos: photos || (photoRef ? [photoRef] : []),
        isYou: false,
        rank: index + 1,
      };
    });
  }

  return {
    businessName: business.name || "",
    businessPlaceId: placeId,
    topSearch,
    leaders,
    aheadCompetitors,
    yourStats,
  };
}

