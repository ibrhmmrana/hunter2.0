import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get("businessId") || searchParams.get("placeId");
    const network = searchParams.get("network");

    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId or placeId is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    // 3. Verify business exists and user owns it
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // 4. Fetch social insights
    let query = serviceSupabase
      .from("social_insights")
      .select("network, punchline, severity")
      .eq("business_id", businessId);

    if (network) {
      query = query.eq("network", network.toLowerCase());
    }

    const { data: insights, error: insightsError } = await query;

    if (insightsError) {
      console.error("[social/insights] Error fetching insights", insightsError);
      return NextResponse.json({ ok: false, error: "Failed to fetch insights" }, { status: 500 });
    }

    // 5. Normalize and filter insights
    const normalizedInsights = (insights || [])
      .filter((insight) => insight.punchline && insight.punchline.trim())
      .map((insight) => ({
        network: (insight.network || "").toLowerCase().trim(),
        punchline: insight.punchline.trim(),
        severity: (insight.severity || "medium").toLowerCase().trim() as "low" | "medium" | "high" | "critical",
      }))
      .filter((insight) => ["low", "medium", "high", "critical"].includes(insight.severity));

    return NextResponse.json({
      ok: true,
      insights: normalizedInsights,
    });
  } catch (error: any) {
    console.error("[social/insights] Error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

