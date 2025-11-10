import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { analyzeGoogleReviews } from "@/lib/social/analyzeGoogleReviews";

export const dynamic = "force-dynamic";

/**
 * POST /api/google/reviews/analyze
 * Triggers Google review analysis for a business
 * Body: { businessId, placeId }
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[google/reviews/analyze] POST request received");

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[google/reviews/analyze] Auth error:", authError);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      console.log("[google/reviews/analyze] No user found");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, placeId } = body;

    console.log("[google/reviews/analyze] Request body", { businessId, placeId, userId: user.id });

    if (!businessId || !placeId) {
      return NextResponse.json(
        { ok: false, error: "businessId and placeId are required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify business ownership
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[google/reviews/analyze] Business query error:", businessError);
      return NextResponse.json(
        { ok: false, error: "Failed to verify business" },
        { status: 500 }
      );
    }

    if (!business) {
      console.log("[google/reviews/analyze] Business not found", { businessId });
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      console.log("[google/reviews/analyze] Unauthorized access attempt", {
        businessId,
        businessOwnerId: business.owner_id,
        userId: user.id,
      });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    console.log("[google/reviews/analyze] Business ownership verified", { businessId, placeId });

    // Trigger analysis in background (fire-and-forget)
    analyzeGoogleReviews(businessId, placeId).catch((error) => {
      console.error("[google/reviews/analyze] Background analysis failed", {
        error: error?.message,
        stack: error?.stack,
        businessId,
        placeId,
      });
      // Don't throw - this is fire-and-forget
    });

    console.log("[google/reviews/analyze] Analysis queued", { businessId, placeId });

    return NextResponse.json(
      { ok: true, status: "queued" },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("[google/reviews/analyze] Unexpected error:", {
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

