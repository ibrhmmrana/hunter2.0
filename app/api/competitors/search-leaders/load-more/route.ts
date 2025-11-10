import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getTopSearchResultForBusiness } from "@/lib/competitors/topSearchLeaders";

export const dynamic = "force-dynamic";

/**
 * POST /api/competitors/search-leaders/load-more
 * Load more search ranking leaders for a business
 * Body: { businessPlaceId, currentCount, query }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessPlaceId, currentCount = 0, query } = body;

    if (!businessPlaceId) {
      return NextResponse.json(
        { ok: false, error: "businessPlaceId is required" },
        { status: 400 }
      );
    }

    // First verify business ownership using server client
    const { data: businessCheck, error: checkError } = await supabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessPlaceId)
      .maybeSingle();

    if (checkError) {
      console.error("[search-leaders/load-more] Business check error:", checkError);
      return NextResponse.json(
        { ok: false, error: "Failed to verify business" },
        { status: 500 }
      );
    }

    if (!businessCheck || businessCheck.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Now fetch full business data using service client
    const serviceSupabase = createServiceRoleClient();
    
    console.log("[search-leaders/load-more] Fetching business data", { businessPlaceId });
    
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id, name, lat, lng, primary_category, category, address")
      .eq("place_id", businessPlaceId)
      .maybeSingle();

    if (businessError) {
      console.error("[search-leaders/load-more] Business query error:", businessError);
      console.error("[search-leaders/load-more] Error details:", JSON.stringify(businessError, null, 2));
      return NextResponse.json(
        { ok: false, error: "Failed to fetch business data", details: businessError.message },
        { status: 500 }
      );
    }

    if (!business) {
      console.error("[search-leaders/load-more] Business not found", { businessPlaceId });
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    console.log("[search-leaders/load-more] Business found", { name: business.name, hasLatLng: !!(business.lat && business.lng) });

    if (!business.lat || !business.lng) {
      return NextResponse.json(
        { ok: false, error: "Business location missing" },
        { status: 400 }
      );
    }

    // First, try to get cached top_search data from business_insights
    const { data: insights, error: insightsError } = await serviceSupabase
      .from("business_insights")
      .select("top_search")
      .eq("business_place_id", businessPlaceId)
      .maybeSingle();

    let allLeaders: any[] = [];

    if (insights?.top_search?.leaders && Array.isArray(insights.top_search.leaders)) {
      // Use cached leaders from business_insights
      console.log("[search-leaders/load-more] Using cached leaders", { 
        totalLeaders: insights.top_search.leaders.length,
        currentCount 
      });
      allLeaders = insights.top_search.leaders;
    } else {
      // Fallback: fetch fresh data if cache is not available
      console.log("[search-leaders/load-more] Cache not available, fetching fresh data");
      const topSearchResult = await getTopSearchResultForBusiness({
        place_id: business.place_id,
        name: business.name || "",
        primary_category: business.primary_category,
        category: business.category,
        formatted_address: business.address, // Use address as formatted_address
        address: business.address,
        lat: business.lat,
        lng: business.lng,
      });

      if (!topSearchResult || !topSearchResult.leaders) {
        return NextResponse.json({
          ok: true,
          leaders: [],
          hasMore: false,
        });
      }

      allLeaders = topSearchResult.leaders;
    }

    // Get more leaders beyond what's already displayed
    const moreLeaders = allLeaders.slice(currentCount, currentCount + 6);
    
    console.log("[search-leaders/load-more] Slicing leaders", {
      totalLeaders: allLeaders.length,
      currentCount,
      moreLeadersCount: moreLeaders.length,
      hasMore: currentCount + moreLeaders.length < allLeaders.length,
    });

    // Map to CompetitorLeader format
    const mappedLeaders = moreLeaders.map((leader) => ({
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

    const hasMore = currentCount + mappedLeaders.length < allLeaders.length;

    return NextResponse.json({
      ok: true,
      leaders: mappedLeaders,
      hasMore,
      totalLeaders: allLeaders.length,
    });
  } catch (error: any) {
    console.error("[search-leaders/load-more] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

