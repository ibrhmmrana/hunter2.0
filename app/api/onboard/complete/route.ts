import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * API endpoint to mark onboarding as complete.
 * POST /api/onboard/complete
 * 
 * Body (optional):
 * - plan: 'free' | 'premium' (defaults to 'free')
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[onboarding:complete:api] User not authenticated:", userError?.message);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body for plan selection
    let plan = 'free';
    try {
      const body = await request.json();
      if (body?.plan && (body.plan === 'free' || body.plan === 'premium')) {
        plan = body.plan;
      }
    } catch (e) {
      // No body or invalid JSON - use default 'free'
    }

    const serviceSupabase = createServiceRoleClient();

    // Get current profile to check if already completed (idempotent)
    const { data: currentProfile } = await serviceSupabase
      .from("profiles")
      .select("onboarding_completed_at, default_business_place_id, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get user's business to set as default_business_place_id (if not already set)
    const { data: userBusiness } = await serviceSupabase
      .from("businesses")
      .select("place_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build update data - only set if not already set (idempotent)
    const updateData: any = {};

    // Only set onboarding_completed_at if not already set
    if (!currentProfile?.onboarding_completed_at) {
      updateData.onboarding_completed_at = new Date().toISOString();
    }

    // Only set default_business_place_id if not already set and we have a business
    if (!currentProfile?.default_business_place_id && userBusiness?.place_id) {
      updateData.default_business_place_id = userBusiness.place_id;
    }

    // Set plan and plan_selected_at if provided
    if (plan && plan !== currentProfile?.plan) {
      updateData.plan = plan;
      updateData.plan_selected_at = new Date().toISOString();
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await serviceSupabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[onboarding:complete:api] Error updating profile:", updateError);
        return NextResponse.json({ ok: false, error: updateError.message || "Failed to complete onboarding" }, { status: 500 });
      }

      console.log(`[onboarding:complete:api] User ${user.id} updated:`, updateData);
    } else {
      console.log(`[onboarding:complete:api] User ${user.id} already completed onboarding, no update needed`);
    }

    return NextResponse.json({ ok: true, message: "Onboarding completed" }, { status: 200 });
  } catch (error: any) {
    console.error("[onboarding:complete:api] Unexpected error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}

