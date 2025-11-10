// app/api/competitors/ranking/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getTopSearchResultForBusiness } from "@/lib/competitors/topSearchLeaders";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[ranking] Failed to parse request body', parseError);
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }
    
    const { businessPlaceId } = body;

    if (!businessPlaceId) {
      return NextResponse.json({ ok: false, error: "Missing businessPlaceId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("place_id", businessPlaceId)
      .single();

    if (error || !business) {
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    // Use the shared helper to get top search results
    const topSearchResult = await getTopSearchResultForBusiness({
      place_id: business.place_id,
      name: business.name || '',
      primary_category: business.primary_category || null,
      category: business.category || null,
      formatted_address: business.formatted_address || null,
      address: business.address || null,
      lat: business.lat || null,
      lng: business.lng || null,
    });

    if (!topSearchResult) {
      return NextResponse.json({ 
        ok: false, 
        error: "Failed to compute top search ranking" 
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      primaryQuery: topSearchResult.query,
      userRank: topSearchResult.userRank,
      leaders: topSearchResult.leaders,
    });
  } catch (err: any) {
    console.error("[ranking] error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to compute leaders" },
      { status: 500 }
    );
  }
}

