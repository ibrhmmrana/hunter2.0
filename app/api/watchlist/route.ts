import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { extractSocialsFromRawData, extractWatchlistSocialsFromGBP } from "@/lib/watchlist/extractSocials";
import { runWatchlistMonitor } from "@/lib/watchlist/runWatchlistMonitor";

export const dynamic = "force-dynamic";

/**
 * POST /api/watchlist
 * Add a competitor to the user's watchlist
 * Body: { competitor_place_id, competitor_name, competitor_address }
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
    const { competitor_place_id, competitor_name, competitor_address } = body;

    console.log("[watchlist] manual-add competitor", {
      place_id: competitor_place_id,
      name: competitor_name,
      user_id: user.id,
    });

    if (!competitor_place_id || !competitor_name) {
      return NextResponse.json(
        { ok: false, error: "competitor_place_id and competitor_name are required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get user's default business
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_business_place_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[watchlist] Error fetching profile:", profileError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (!profile?.default_business_place_id) {
      return NextResponse.json(
        { ok: false, error: "No default business configured. Please set up a business first." },
        { status: 400 }
      );
    }

    const business_place_id = profile.default_business_place_id;

    // Check if already in watchlist (active)
    const { data: existing, error: checkError } = await serviceSupabase
      .from("watchlist_competitors")
      .select("id")
      .eq("user_id", user.id)
      .eq("competitor_place_id", competitor_place_id)
      .eq("active", true)
      .maybeSingle();

    if (checkError) {
      console.error("[watchlist] Error checking existing:", checkError);
      return NextResponse.json(
        { ok: false, error: "Failed to check watchlist" },
        { status: 500 }
      );
    }

    let watchlist_id: string;

    if (existing) {
      // Already in watchlist
      watchlist_id = existing.id;
    } else {
      // Deactivate any existing inactive entry
      await serviceSupabase
        .from("watchlist_competitors")
        .update({ active: false })
        .eq("user_id", user.id)
        .eq("competitor_place_id", competitor_place_id)
        .eq("active", false);

      // Insert new watchlist entry
      const { data: watchlistEntry, error: insertError } = await serviceSupabase
        .from("watchlist_competitors")
        .insert({
          user_id: user.id,
          business_place_id,
          competitor_place_id,
          competitor_name,
          competitor_address: competitor_address || null,
          active: true,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[watchlist] Error inserting:", insertError);
        return NextResponse.json(
          { ok: false, error: "Failed to add to watchlist" },
          { status: 500 }
        );
      }

      watchlist_id = watchlistEntry.id;
    }

    // Try to extract socials from competitor data for prefilling
    // Check multiple sources: business_competitors, snapshots_gbp
    let gbpRawData: any = null;
    
    // First, check business_competitors
    const { data: competitorData } = await serviceSupabase
      .from("business_competitors")
      .select("raw")
      .eq("business_place_id", business_place_id)
      .eq("competitor_place_id", competitor_place_id)
      .maybeSingle();

    if (competitorData?.raw) {
      gbpRawData = competitorData.raw;
    } else {
      // Fallback: check snapshots_gbp for the competitor
      const { data: snapshotData } = await serviceSupabase
        .from("snapshots_gbp")
        .select("raw")
        .eq("business_place_id", competitor_place_id)
        .order("snapshot_ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotData?.raw) {
        gbpRawData = snapshotData.raw;
      }
    }

    // Extract prefilled socials (just usernames for modal)
    const prefilledSocials = gbpRawData ? extractWatchlistSocialsFromGBP(gbpRawData) : {};

    // Extract and save socials to watchlist_social_profiles (full URLs for storage)
    const foundNetworks: string[] = [];
    const missingNetworks: string[] = ['google']; // Always include Google for reviews

    if (gbpRawData) {
      // Extract socials from raw data
      const extractedSocials = extractSocialsFromRawData(gbpRawData);

      // Upsert social profiles (store full URLs)
      for (const social of extractedSocials) {
        const { error: socialError } = await serviceSupabase
          .from("watchlist_social_profiles")
          .upsert(
            {
              watchlist_id,
              network: social.network,
              handle_or_url: social.handle_or_url,
              source: social.source,
            },
            { onConflict: "watchlist_id,network" }
          );

        if (!socialError) {
          foundNetworks.push(social.network);
        }
      }
    }

    // Determine which networks are missing
    const allNetworks = ['instagram', 'tiktok', 'facebook'];
    for (const network of allNetworks) {
      if (!foundNetworks.includes(network)) {
        missingNetworks.push(network);
      }
    }

    // Always add Google to watchlist (for reviews)
    await serviceSupabase
      .from("watchlist_social_profiles")
      .upsert(
        {
          watchlist_id,
          network: 'google',
          handle_or_url: competitor_place_id, // Use place_id for Google
          source: 'gbp',
        },
        { onConflict: "watchlist_id,network" }
      );

    // Run baseline scan immediately (fire-and-forget to keep API response fast)
    console.log("[watchlist] triggering initial baseline scan for", watchlist_id);
    runWatchlistMonitor({ 
      onlyWatchlistId: watchlist_id, 
      initialBaseline: true 
    }).catch((err) => {
      console.error("[watchlist] Initial baseline scan failed for watchlist_id:", watchlist_id, err);
    });

    return NextResponse.json({
      ok: true,
      watchlist_id,
      foundNetworks: ['google', ...foundNetworks],
      missingNetworks: missingNetworks.filter(n => n !== 'google'),
      prefilledSocials, // Return usernames for modal prefilling
    });
  } catch (error: any) {
    console.error("[watchlist] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/watchlist
 * Get user's watchlist with social profiles
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Get watchlist entries
    const { data: watchlist, error: watchlistError } = await serviceSupabase
      .from("watchlist_competitors")
      .select("id, competitor_place_id, competitor_name, competitor_address, business_place_id, created_at")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (watchlistError) {
      console.error("[watchlist] Error fetching watchlist:", watchlistError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    if (!watchlist || watchlist.length === 0) {
      return NextResponse.json({
        ok: true,
        watchlist: [],
      });
    }

    // Get social profiles for each watchlist entry
    const watchlistIds = watchlist.map((w) => w.id);
    const { data: socialProfiles, error: socialError } = await serviceSupabase
      .from("watchlist_social_profiles")
      .select("watchlist_id, network, handle_or_url")
      .in("watchlist_id", watchlistIds);

    if (socialError) {
      console.error("[watchlist] Error fetching social profiles:", socialError);
      // Continue without social profiles
    }

    // Combine watchlist entries with their social profiles
    const watchlistWithSocials = watchlist.map((entry) => {
      const socials = (socialProfiles || [])
        .filter((sp) => sp.watchlist_id === entry.id)
        .map((sp) => ({
          network: sp.network,
          handle_or_url: sp.handle_or_url,
        }));

      return {
        id: entry.id,
        competitor_name: entry.competitor_name,
        competitor_address: entry.competitor_address,
        competitor_place_id: entry.competitor_place_id,
        business_place_id: entry.business_place_id,
        created_at: entry.created_at,
        socials,
      };
    });

    return NextResponse.json({
      ok: true,
      watchlist: watchlistWithSocials,
    });
  } catch (error: any) {
    console.error("[watchlist] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

