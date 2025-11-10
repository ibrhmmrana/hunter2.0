import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/competitors/load-more
 * Load more competitors with progressively loosened criteria
 * Body: { businessPlaceId, currentCount, tier }
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[competitors/load-more] POST request received");
    
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[competitors/load-more] Auth error:", authError);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("[competitors/load-more] Request body:", { 
      businessPlaceId: body.businessPlaceId,
      currentCount: body.currentCount,
      tier: body.tier,
      excludeCount: body.excludePlaceIds?.length || 0,
    });
    
    const { businessPlaceId, currentCount = 0, tier = 0, excludePlaceIds = [] } = body;

    if (!businessPlaceId) {
      return NextResponse.json(
        { ok: false, error: "businessPlaceId is required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify business ownership
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessPlaceId)
      .maybeSingle();

    if (businessError) {
      console.error("[competitors/load-more] Business query error:", businessError);
      return NextResponse.json(
        { ok: false, error: "Failed to verify business" },
        { status: 500 }
      );
    }

    if (!business || business.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Fetch more competitors with progressively loosened criteria
    // Tier 0: Same as initial (is_stronger first, then by reviews/rating)
    // Tier 1: Remove is_stronger requirement, still order by reviews/rating
    // Tier 2: Order by distance (closer first), then reviews/rating
    // Tier 3: Order by distance only

    let mappedCompetitors: any[] = [];
    let currentTier = tier;
    let hasMore = false;
    let tierStartCount = currentCount; // Track count for current tier
    let loopCount = 0; // Safety counter to prevent infinite loops
    const MAX_LOOP_ITERATIONS = 10;

    console.log("[competitors/load-more] Starting fetch loop", { currentTier, tierStartCount, excludeCount: excludePlaceIds.length });

    // Try current tier first, then progressively loosen if no results
    while (mappedCompetitors.length === 0 && currentTier <= 3 && loopCount < MAX_LOOP_ITERATIONS) {
      loopCount++;
      console.log("[competitors/load-more] Loop iteration", { loopCount, currentTier, tierStartCount });
      let query = serviceSupabase
        .from("business_competitors")
        .select("competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw")
        .eq("business_place_id", businessPlaceId);

      // Exclude already displayed competitors using Supabase filter
      // We'll filter in JavaScript after fetching since Supabase .not().in() syntax is complex

      // Apply ordering based on tier
      if (currentTier === 0) {
        // Initial: is_stronger first, then reviews, then rating
        query = query
          .order("is_stronger", { ascending: false })
          .order("reviews_total", { ascending: false })
          .order("rating_avg", { ascending: false });
      } else if (currentTier === 1) {
        // Remove is_stronger priority, just order by reviews/rating
        query = query
          .order("reviews_total", { ascending: false })
          .order("rating_avg", { ascending: false });
      } else if (currentTier === 2) {
        // Order by distance first (closer is better), then reviews/rating
        query = query
          .order("distance_m", { ascending: true })
          .order("reviews_total", { ascending: false })
          .order("rating_avg", { ascending: false });
      } else {
        // Tier 3+: Order by distance only
        query = query.order("distance_m", { ascending: true });
      }

      // When switching tiers, start from 0 for the new tier
      const fetchStart = currentTier === tier ? tierStartCount : 0;

      // Fetch more results - fetch extra if we need to exclude some
      // Fetch a larger batch to account for filtering
      const fetchCount = excludePlaceIds && excludePlaceIds.length > 0 ? 20 : 6;
      
      console.log("[competitors/load-more] Fetching competitors", { fetchStart, fetchCount, currentTier });
      
      const { data: competitors, error: competitorsError } = await query
        .range(fetchStart, fetchStart + fetchCount - 1);

      if (competitorsError) {
        console.error("[competitors/load-more] Error fetching competitors:", competitorsError);
        return NextResponse.json(
          { ok: false, error: "Failed to fetch competitors" },
          { status: 500 }
        );
      }

      console.log("[competitors/load-more] Fetched competitors", { count: competitors?.length || 0 });

      // Filter out excluded competitors and map to CompetitorLeader format
      const excludeSet = new Set(excludePlaceIds || []);
      const filtered = (competitors || []).filter((comp) => !excludeSet.has(comp.competitor_place_id));
      
      mappedCompetitors = filtered
        .slice(0, 6) // Take up to 6 after filtering
        .map((comp, index) => {
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
            rank: fetchStart + index + 1,
          };
        });

      // If we got results, check if there are more available at this tier
      if (mappedCompetitors.length > 0) {
        // Check if we got fewer results than requested (means we're at the end)
        // Also check if we got exactly 6 results (might be more)
        const gotFullBatch = mappedCompetitors.length >= 6;
        
        // Check if there are more filtered results available
        const hasMoreFiltered = filtered.length > mappedCompetitors.length;
        
        // Also check total count
        const { count: totalCount } = await serviceSupabase
          .from("business_competitors")
          .select("*", { count: "exact", head: true })
          .eq("business_place_id", businessPlaceId);

        // Estimate remaining: total - displayed - just fetched
        const remainingEstimate = totalCount 
          ? totalCount - (excludePlaceIds?.length || 0) - mappedCompetitors.length 
          : 0;
        
        hasMore = (gotFullBatch && hasMoreFiltered) || remainingEstimate > 0;
        break; // Found results, exit loop
      } else {
        // No results at this tier (either no data or all filtered out), try next tier
        // But only if we actually fetched some competitors (they were just all filtered)
        if (competitors && competitors.length > 0 && filtered.length === 0) {
          // We got results but they were all filtered - try fetching more from this tier
          // by increasing the fetch range
          if (fetchStart + fetchCount < 100) { // Safety limit
            tierStartCount = fetchStart + fetchCount;
            console.log("[competitors/load-more] All filtered, trying larger range", { newTierStartCount: tierStartCount });
            continue; // Try again with larger range
          }
        }
        // No more results at this tier, try next tier
        console.log("[competitors/load-more] No results at tier, moving to next tier", { currentTier, nextTier: currentTier + 1 });
        currentTier++;
        tierStartCount = 0; // Reset count when switching tiers
      }
    }

    // If we exited the loop without results, check if we hit the max iterations
    if (loopCount >= MAX_LOOP_ITERATIONS) {
      console.warn("[competitors/load-more] Hit max loop iterations", { loopCount, currentTier });
    }

    // If still no results after all tiers, set hasMore to false
    if (mappedCompetitors.length === 0) {
      console.log("[competitors/load-more] No results found after all tiers");
      hasMore = false;
    }

    const response = {
      ok: true,
      competitors: mappedCompetitors,
      hasMore,
      nextTier: currentTier,
      tierUsed: currentTier, // For debugging
    };
    
    console.log("[competitors/load-more] Returning response:", {
      competitorsCount: mappedCompetitors.length,
      hasMore,
      nextTier: currentTier,
    });
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[competitors/load-more] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

