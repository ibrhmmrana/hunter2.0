import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { normalizeSocialUrl, normalizeSocialHandle } from "@/lib/watchlist/extractSocials";
import { runWatchlistMonitor } from "@/lib/watchlist/runWatchlistMonitor";

export const dynamic = "force-dynamic";

/**
 * POST /api/watchlist/socials
 * Add manual social media profiles to a watchlist entry
 * Body: { watchlist_id, socials: [{ network, handle_or_url }] }
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
    const { watchlist_id, socials } = body;

    if (!watchlist_id || !socials || !Array.isArray(socials)) {
      return NextResponse.json(
        { ok: false, error: "watchlist_id and socials array are required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify watchlist entry belongs to user
    const { data: watchlistEntry, error: watchlistError } = await serviceSupabase
      .from("watchlist_competitors")
      .select("id, user_id")
      .eq("id", watchlist_id)
      .maybeSingle();

    if (watchlistError) {
      console.error("[watchlist/socials] Error fetching watchlist:", watchlistError);
      return NextResponse.json(
        { ok: false, error: "Failed to verify watchlist entry" },
        { status: 500 }
      );
    }

    if (!watchlistEntry || watchlistEntry.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Validate and normalize socials
    const validNetworks = ['instagram', 'tiktok', 'facebook'];
    const socialsToInsert = [];

    for (const social of socials) {
      if (!social.network || !validNetworks.includes(social.network)) {
        continue;
      }

      if (!social.handle_or_url || typeof social.handle_or_url !== 'string') {
        continue;
      }

      // Normalize to full URL for storage (consistent with GBP-extracted socials)
      const normalizedUrl = normalizeSocialUrl(
        social.handle_or_url,
        social.network as 'instagram' | 'tiktok' | 'facebook'
      );

      socialsToInsert.push({
        watchlist_id,
        network: social.network,
        handle_or_url: normalizedUrl,
        source: 'manual',
      });
    }

    if (socialsToInsert.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid social profiles provided" },
        { status: 400 }
      );
    }

    // Upsert social profiles
    const { error: insertError } = await serviceSupabase
      .from("watchlist_social_profiles")
      .upsert(socialsToInsert, { onConflict: "watchlist_id,network" });

    if (insertError) {
      console.error("[watchlist/socials] Error inserting socials:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to add social profiles" },
        { status: 500 }
      );
    }

    // Run baseline scan for newly added social profiles (fire-and-forget)
    console.log("[watchlist/socials] triggering baseline scan for newly added socials", watchlist_id);
    runWatchlistMonitor({ 
      onlyWatchlistId: watchlist_id, 
      initialBaseline: true 
    }).catch((err) => {
      console.error("[watchlist/socials] Baseline scan failed for watchlist_id:", watchlist_id, err);
    });

    return NextResponse.json({
      ok: true,
      added: socialsToInsert.length,
    });
  } catch (error: any) {
    console.error("[watchlist/socials] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

