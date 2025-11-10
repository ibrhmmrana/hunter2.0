import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { syncCompetitorsForBusiness } from "@/lib/competitors/syncCompetitorsForBusiness";
import { getDiscoveryQueriesForBusiness } from "@/lib/ai/discoveryQueries";

export const dynamic = "force-dynamic";

/**
 * POST /api/onboard/preload
 * 
 * Preload analysis data (competitors + discovery queries) for a business.
 * Called during the connections step to prepare data for analytics page.
 * 
 * Body: { businessPlaceId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { businessPlaceId } = body;

    if (!businessPlaceId || typeof businessPlaceId !== "string") {
      return NextResponse.json(
        { error: "Missing businessPlaceId" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Fetch business data
    const { data: business, error: businessError } = await serviceClient
      .from("businesses")
      .select("*")
      .eq("place_id", businessPlaceId)
      .maybeSingle();

    if (businessError) {
      console.error("[onboard-preload] Error fetching business:", businessError);
      return NextResponse.json(
        { error: "Failed to fetch business" },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // 1) Ensure competitors are synced (idempotent)
    try {
      await syncCompetitorsForBusiness(businessPlaceId);
    } catch (err: any) {
      console.error("[onboard-preload] Competitor sync error:", err);
      // Don't fail the request, just log
    }

    // 2) Pre-generate discovery queries
    try {
      const primaryCategory = Array.isArray(business.categories) && business.categories.length > 0
        ? business.categories[0]?.replace(/_/g, " ")
        : null;

      const queries = await getDiscoveryQueriesForBusiness({
        name: business.name,
        category: primaryCategory,
        primary_category: business.primary_category || null,
        address: business.address || null,
      });

      // Store queries in business record (if discovery_queries column exists)
      try {
        await serviceClient
          .from("businesses")
          .update({ discovery_queries: queries })
          .eq("place_id", businessPlaceId);
      } catch (updateError: any) {
        // Column might not exist, that's okay - we'll generate on demand
        console.log("[onboard-preload] Could not store discovery_queries (column may not exist)", updateError.message);
      }
      
      console.log("[onboard-preload] Preloaded discovery queries", {
        businessPlaceId,
        queryCount: queries.length,
      });
    } catch (err: any) {
      console.error("[onboard-preload] Discovery queries error:", err);
      // Don't fail the request, just log
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[onboard-preload] error", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

