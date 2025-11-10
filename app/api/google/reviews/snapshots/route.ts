import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/google/reviews/snapshots
 * Returns the latest Google review snapshot for a business
 * Query params: businessId
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[google/reviews/snapshots] GET request received");
    
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[google/reviews/snapshots] Auth error:", authError);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      console.log("[google/reviews/snapshots] No user found");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get("businessId");

    console.log("[google/reviews/snapshots] Request params", { businessId, userId: user.id });

    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify business ownership
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[google/reviews/snapshots] Business query error:", businessError);
      return NextResponse.json({ ok: false, error: "Failed to verify business" }, { status: 500 });
    }

    if (!business) {
      console.log("[google/reviews/snapshots] Business not found", { businessId });
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      console.log("[google/reviews/snapshots] Unauthorized access attempt", {
        businessId,
        businessOwnerId: business.owner_id,
        userId: user.id,
      });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    console.log("[google/reviews/snapshots] Business ownership verified", { businessId });

    // Fetch latest snapshot
    const { data: snapshot, error: queryError } = await serviceSupabase
      .from("google_review_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("[google/reviews/snapshots] Query error:", {
        error: queryError.message,
        code: queryError.code,
        details: queryError.details,
        hint: queryError.hint,
        businessId,
      });
      return NextResponse.json({ 
        ok: false, 
        error: "Failed to fetch snapshot",
        details: queryError.message,
      }, { status: 500 });
    }

    const result = snapshot ? {
      negative_reviews: snapshot.negative_reviews,
      positive_reviews: snapshot.positive_reviews,
      days_since_last_review: snapshot.days_since_last_review,
      total_reviews: snapshot.total_reviews,
      reviews_distribution: snapshot.reviews_distribution,
      snapshot_ts: snapshot.snapshot_ts,
    } : null;
    
    console.log("[google/reviews/snapshots] Query result", {
      businessId,
      found: !!result,
      negative_reviews: result?.negative_reviews,
      positive_reviews: result?.positive_reviews,
      days_since_last_review: result?.days_since_last_review,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[google/reviews/snapshots] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

