import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ensureGbpSnapshotUpToDate } from "@/lib/onboard/ensureGbpSnapshot";
import { syncCompetitorsForBusiness } from "@/lib/competitors/syncCompetitorsForBusiness";
import { markAnalysisRunComplete, markAnalysisRunError } from "@/lib/onboard/analysisRuns";
import { getDiscoveryQueriesForBusiness } from "@/lib/ai/discoveryQueries";
import { getTopSearchResultForBusiness } from "@/lib/competitors/topSearchLeaders";
import { buildGoogleSummary } from "@/lib/insights/googleSummary";
import { getGooglePunchline } from "@/lib/insights/punchlines";
import { storePunchline } from "@/lib/insights/storePunchline";
import { analyzeGoogleReviews } from "@/lib/social/analyzeGoogleReviews";

export const dynamic = "force-dynamic";

interface BusinessSnapshot {
  place_id: string;
  name?: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  google_maps_url?: string;
  primary_category?: string;
  rating?: number;
  reviews_count?: number;
  categories?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body = await request.json();
    const { businessPlaceId, businessSnapshot }: { businessPlaceId?: string; businessSnapshot?: BusinessSnapshot } = body;

    if (!businessPlaceId || typeof businessPlaceId !== "string" || businessPlaceId.trim() === "") {
      return NextResponse.json({ ok: false, error: "businessPlaceId is required" }, { status: 400 });
    }

    const placeId = businessPlaceId.trim();
    const serviceSupabase = createServiceRoleClient();

    // 3. Check if business exists (with or without owner_id)
    const { data: existingBusiness } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", placeId)
      .maybeSingle();

    // 4. Ensure business exists with correct owner_id
    // If business exists but owner_id is null, update it
    // If business doesn't exist, create it
    // If business exists with different owner_id, we still update it (user is claiming it)
      const businessData: any = {
        place_id: placeId,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      };

    // Add snapshot data if provided
    if (businessSnapshot) {
      businessData.name = businessSnapshot.name || null;
      businessData.address = businessSnapshot.formatted_address || null;
      businessData.lat = businessSnapshot.lat || null;
      businessData.lng = businessSnapshot.lng || null;
      businessData.image_url = businessSnapshot.image_url || null;
      businessData.google_maps_url = businessSnapshot.google_maps_url || null;
      businessData.primary_category = businessSnapshot.primary_category || null;
      businessData.rating = businessSnapshot.rating || null;
      businessData.reviews_count = businessSnapshot.reviews_count || null;
      businessData.categories = businessSnapshot.categories || null;
    } else if (existingBusiness) {
      // If no snapshot but business exists, preserve existing data
      // We'll just update owner_id via upsert
    }

    // Remove null values for cleaner upsert (except owner_id which is required)
      Object.keys(businessData).forEach((key) => {
      if (key !== "owner_id" && key !== "place_id" && businessData[key] === null) {
        delete businessData[key];
      }
      });

    // Upsert business - this will create or update, always setting owner_id
      const { error: upsertError } = await serviceSupabase
        .from("businesses")
        .upsert(businessData, { onConflict: "place_id" });

      if (upsertError) {
      console.error("[Kickoff] Error upserting business:", upsertError);
      return NextResponse.json(
        { ok: false, error: "Failed to save business. Please try again." },
        { status: 500 }
      );
    }

    // Update user's default_business_place_id in profiles if not already set
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("default_business_place_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.default_business_place_id) {
      const { error: profileUpdateError } = await serviceSupabase
        .from("profiles")
        .update({ 
          default_business_place_id: placeId,
        })
        .eq("user_id", user.id);

      if (profileUpdateError) {
        console.warn("[Kickoff] Failed to update default_business_place_id:", profileUpdateError);
        // Don't fail the request - this is not critical
      } else {
        console.log(`[Kickoff] Set default_business_place_id to ${placeId} for user ${user.id}`);
      }
    }

    // 5. Check existing analysis_runs
    const { data: existingRun } = await serviceSupabase
      .from("analysis_runs")
      .select("*")
      .eq("owner_id", user.id)
      .eq("business_place_id", placeId)
      .maybeSingle();

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // If there's a recent run that's running or complete, don't start again
    if (existingRun) {
      const startedAt = new Date(existingRun.started_at || existingRun.last_started_at || 0);
      
      if (
        (existingRun.status === "running" || existingRun.status === "complete") &&
        startedAt > thirtyMinutesAgo
      ) {
        console.log(`[Kickoff] Reusing existing run for ${placeId}, status: ${existingRun.status}`);
        return NextResponse.json({ ok: true, placeId }, { status: 202 });
      }
    }

    // 6. Upsert analysis_runs row (one per owner_id + place_id)
    const runData: any = {
      owner_id: user.id,
          business_place_id: placeId,
          status: "running",
      started_at: now.toISOString(),
      completed_at: null,
      error_message: null,
          updated_at: now.toISOString(),
    };

    // Handle both old and new column names for migration period
    if (!existingRun || (!existingRun.started_at && !existingRun.last_started_at)) {
      runData.last_started_at = now.toISOString();
    }

    // Try to update existing row first, then insert if needed
    let upsertRunError;
    if (existingRun) {
      // Update existing row
      const { error } = await serviceSupabase
        .from("analysis_runs")
        .update(runData)
        .eq("owner_id", user.id)
        .eq("business_place_id", placeId);
      upsertRunError = error;
    } else {
      // Insert new row
      const { error } = await serviceSupabase
        .from("analysis_runs")
        .insert(runData);
      upsertRunError = error;
    }

    if (upsertRunError) {
      console.error("[Kickoff] Error upserting analysis_runs:", upsertRunError);
      // Continue anyway - background work will handle it
    } else {
      console.log(`[Kickoff] Created/updated analysis run for ${placeId}`);
    }

    // 7. Fire-and-forget background work (non-blocking)
    (async () => {
      try {
        console.log(`[Kickoff] Starting background analysis for ${placeId}`);

        // (a) Ensure GBP snapshot
        await ensureGbpSnapshotUpToDate(placeId);
        console.log(`[Kickoff] GBP snapshot done for ${placeId}`);

        // (a.1) Analyze Google reviews (creates google_review_snapshots with summaries)
        try {
          await analyzeGoogleReviews(placeId, placeId);
          console.log(`[Kickoff] Google reviews analysis done for ${placeId}`);
        } catch (err) {
          console.error("[kickoff] Google reviews analysis failed", err);
          // Continue - review analysis is not critical for onboarding
        }

        // (b) Sync competitors
        await syncCompetitorsForBusiness(placeId);
        console.log(`[Kickoff] Competitor sync done for ${placeId}`);

        // (b.1) Generate and store Google punchline
        try {
          const googleSummary = await buildGoogleSummary(placeId, serviceSupabase);
          const googlePunchline = await getGooglePunchline(googleSummary);
          if (googlePunchline) {
            await storePunchline(placeId, 'google', googlePunchline, googleSummary, serviceSupabase);
            console.log(`[Kickoff] Google punchline stored for ${placeId}`);
          }
        } catch (err) {
          console.error("[kickoff] Google punchline generation failed", err);
          // Continue - punchline generation is not critical
        }

        // (c) Precompute insights (discovery queries + top search ranking)
        // Fetch full business data for insights
        const { data: fullBusiness } = await serviceSupabase
          .from("businesses")
          .select("*")
          .eq("place_id", placeId)
          .single();

        if (fullBusiness) {
          // Fire in parallel; failures should not break the response
          const [discoveryQueries, topSearch] = await Promise.all([
            (async () => {
              try {
                return await getDiscoveryQueriesForBusiness({
                  name: fullBusiness.name,
                  category: fullBusiness.category || null,
                  primary_category: fullBusiness.primary_category || null,
                  address: fullBusiness.address || fullBusiness.formatted_address || null,
                });
              } catch (err) {
                console.error("[kickoff] discovery queries failed", err);
                return null;
              }
            })(),
            (async () => {
              try {
                return await getTopSearchResultForBusiness({
                  place_id: fullBusiness.place_id,
                  name: fullBusiness.name || '',
                  primary_category: fullBusiness.primary_category || null,
                  category: fullBusiness.category || null,
                  formatted_address: fullBusiness.formatted_address || null,
                  address: fullBusiness.address || null,
                  lat: fullBusiness.lat || null,
                  lng: fullBusiness.lng || null,
                });
              } catch (err) {
                console.error("[kickoff] top search ranking failed", err);
                return null;
              }
            })(),
          ]);

          if (discoveryQueries || topSearch) {
            const { error: biError } = await serviceSupabase
              .from("business_insights")
              .upsert(
                {
                  business_place_id: placeId,
                  discovery_queries: discoveryQueries || null,
                  top_search: topSearch || null,
            updated_at: new Date().toISOString(),
                },
                { onConflict: "business_place_id" }
              );

            if (biError) {
              console.error("[kickoff] failed to upsert business_insights", biError);
            } else {
              console.log(`[Kickoff] Insights precomputed for ${placeId}`);
            }
          }
        }

        // (d) Mark as complete
        await markAnalysisRunComplete(serviceSupabase, user.id, placeId);
        console.log(`[Kickoff] Analysis complete for ${placeId}`);
      } catch (error: any) {
        console.error(`[Kickoff] Background work error for ${placeId}:`, error);
        await markAnalysisRunError(
          serviceSupabase,
          user.id,
          placeId,
          error.message || "Unknown error"
        );
      }
    })();

    // Return immediately with placeId (202 Accepted for async processing)
    return NextResponse.json({ ok: true, placeId }, { status: 202 });
  } catch (error: any) {
    console.error("Kickoff error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}


