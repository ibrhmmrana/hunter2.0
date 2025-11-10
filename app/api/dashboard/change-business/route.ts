import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ensureGbpSnapshotUpToDate } from "@/lib/onboard/ensureGbpSnapshot";

export const dynamic = "force-dynamic";

/**
 * API endpoint to change the user's default business.
 * POST /api/dashboard/change-business
 * 
 * Body:
 * - place_id: string (the new business place_id)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[dashboard:change-business] User not authenticated:", userError?.message);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { place_id } = body;

    if (!place_id || typeof place_id !== 'string') {
      return NextResponse.json({ ok: false, error: "place_id is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify the business exists and belongs to the user
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id")
      .eq("place_id", place_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("[dashboard:change-business] Error checking business:", businessError);
      return NextResponse.json({ ok: false, error: "Failed to verify business" }, { status: 500 });
    }

    if (!business) {
      return NextResponse.json({ ok: false, error: "Business not found or does not belong to you" }, { status: 404 });
    }

    // Update the user's default_business_place_id
    const { error: updateError } = await serviceSupabase
      .from("profiles")
      .update({ default_business_place_id: place_id })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[dashboard:change-business] Error updating profile:", updateError);
      return NextResponse.json({ ok: false, error: updateError.message || "Failed to update business" }, { status: 500 });
    }

    console.log(`[dashboard:change-business] User ${user.id} changed default business to ${place_id}`);

    // Trigger GBP snapshot creation in the background (non-blocking)
    // This ensures images and reviews are fetched for the new business
    ensureGbpSnapshotUpToDate(place_id).catch((error) => {
      console.error("[dashboard:change-business] Error creating snapshot (non-blocking):", error);
    });

    return NextResponse.json({ ok: true, message: "Business changed successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[dashboard:change-business] Unexpected error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}

