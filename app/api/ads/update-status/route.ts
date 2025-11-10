import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status, output_url, error } = body;

    if (!id || !status) {
      return NextResponse.json(
        { ok: false, error: "id and status are required" },
        { status: 400 }
      );
    }

    // Verify the ad belongs to the user
    const serviceSupabase = createServiceRoleClient();
    const { data: existingAd } = await serviceSupabase
      .from("ads")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingAd || existingAd.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Ad not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update the ad
    const updateData: any = {
      status: status as "pending" | "generating" | "ready" | "failed",
      updated_at: new Date().toISOString(),
    };

    if (output_url) {
      updateData.output_url = output_url;
    }

    if (error) {
      updateData.meta = {
        error,
      };
    }

    const { data: updatedAd, error: updateError } = await serviceSupabase
      .from("ads")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[ads/update-status] Update error:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update ad" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ad: updatedAd,
    });
  } catch (error: any) {
    console.error("[ads/update-status] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


