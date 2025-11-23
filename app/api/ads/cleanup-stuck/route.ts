import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/ads/cleanup-stuck
 * Marks ads that have been stuck in "generating" status for more than 10 minutes as "failed"
 * Can be called manually or via cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, allowing unauthenticated access (you may want to add a secret)
    
    const serviceSupabase = createServiceRoleClient();
    
    // Find ads that have been in "generating" status for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckAds, error: fetchError } = await serviceSupabase
      .from("ads")
      .select("id, created_at, updated_at")
      .eq("status", "generating")
      .lt("updated_at", tenMinutesAgo);
    
    if (fetchError) {
      console.error("[ads/cleanup-stuck] Error fetching stuck ads:", fetchError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch stuck ads" },
        { status: 500 }
      );
    }
    
    if (!stuckAds || stuckAds.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No stuck ads found",
        cleaned: 0,
      });
    }
    
    // Update all stuck ads to failed status
    const { data: updatedAds, error: updateError } = await serviceSupabase
      .from("ads")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        meta: {
          error: "Generation timed out - stuck in generating status for more than 10 minutes",
          cleanedAt: new Date().toISOString(),
        },
      })
      .eq("status", "generating")
      .lt("updated_at", tenMinutesAgo)
      .select("id");
    
    if (updateError) {
      console.error("[ads/cleanup-stuck] Error updating stuck ads:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update stuck ads" },
        { status: 500 }
      );
    }
    
    console.log(`[ads/cleanup-stuck] Cleaned up ${updatedAds?.length || 0} stuck ads`);
    
    return NextResponse.json({
      ok: true,
      message: `Cleaned up ${updatedAds?.length || 0} stuck ads`,
      cleaned: updatedAds?.length || 0,
      adIds: updatedAds?.map(ad => ad.id) || [],
    });
  } catch (error: any) {
    console.error("[ads/cleanup-stuck] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

