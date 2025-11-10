import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { analyzeFacebookForPunchline, normalizeFacebookPage } from "@/lib/social/analyzeFacebookForPunchline";
import { storePunchline } from "@/lib/insights/storePunchline";
import { storeSocialSnapshot } from "@/lib/social/storeSocialSnapshot";

export const dynamic = "force-dynamic";

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
    const { placeId, handle }: { placeId?: string; handle?: string } = body;

    if (!placeId || typeof placeId !== "string" || !placeId.trim()) {
      return NextResponse.json({ ok: false, error: "placeId is required" }, { status: 400 });
    }

    if (!handle || typeof handle !== "string" || !handle.trim()) {
      return NextResponse.json({ ok: false, error: "handle is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    console.log('[facebook_analyze:start]', {
      tag: 'facebook_analyze:start',
      businessId: placeId,
      handleFromBody: handle,
    });

    // 3. Verify business exists and user owns it
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id, name, category, primary_category, city")
      .eq("place_id", placeId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // 4. Normalize handle
    const normalized = normalizeFacebookPage(handle);
    if (!normalized) {
      return NextResponse.json(
        { ok: false, error: "Invalid Facebook page. Use a full URL or page handle." },
        { status: 400 }
      );
    }

    const { handle: normalizedHandle, pageUrl } = normalized;

    // 5. Persist handle to social_profiles
    const { error: profileError } = await serviceSupabase
      .from("social_profiles")
      .upsert(
        {
          business_id: placeId,
          network: "facebook",
          handle: normalizedHandle,
          profile_url: pageUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,network" }
      );

    if (profileError) {
      console.error("[facebook/analyze] Failed to save profile", profileError);
      // Continue anyway - we can still analyze
    } else {
      console.log('[facebook_analyze:profile_saved]', {
        tag: 'facebook_analyze:profile_saved',
        businessId: placeId,
        handle: normalizedHandle,
      });
    }

    console.log('[facebook_analyze:queued]', {
      tag: 'facebook_analyze:queued',
      businessId: placeId,
      handle: normalizedHandle,
    });

    // 6. Kick off analysis in background (non-blocking)
    // Use void to explicitly mark as fire-and-forget
    void (async () => {
      try {
        console.log("[facebook/analyze] Starting analysis", {
          placeId,
          handle: normalizedHandle,
          pageUrl,
          businessName: business.name,
        });

        console.log('[facebook_analyze:apify:start]', {
          tag: 'facebook_analyze:apify:start',
          businessId: placeId,
          handle: normalizedHandle,
        });

        // Analyze Facebook and generate punchline
        const result = await analyzeFacebookForPunchline(
          pageUrl,
          placeId,
          business.name || 'Business',
          business.primary_category || business.category || null
        );

        if (!result) {
          console.error("[facebook/analyze] Analysis returned null - both API calls (profile + posts) must succeed before storing snapshot");
          console.log("[facebook/analyze] Will retry on next analysis attempt. Profile saved, but waiting for posts data.");
          return;
        }

        const { metrics, punchline, rawData, postsData } = result;

        // 7. Store snapshot with full Apify data
        try {
          const snapshotData = {
            business_id: placeId,
            network: 'facebook',
            posts_total: postsData.posts.length > 0 ? postsData.posts.length : null,
            posts_last_30d: postsData.postsLast30Days,
            days_since_last_post: postsData.daysSinceLastPost,
            engagement_rate: postsData.engagementRate,
            followers: metrics.followers,
            likes: metrics.likes,
            raw_data: {
              profile: rawData,
              posts: postsData.posts,
            }, // Store both profile and posts data
          };
          
          console.log("[facebook/analyze] Attempting to store snapshot", {
            business_id: snapshotData.business_id,
            network: snapshotData.network,
            followers: snapshotData.followers,
            likes: snapshotData.likes,
            posts_total: snapshotData.posts_total,
            posts_last_30d: snapshotData.posts_last_30d,
            days_since_last_post: snapshotData.days_since_last_post,
            engagement_rate: snapshotData.engagement_rate,
          });
          
          await storeSocialSnapshot(serviceSupabase, snapshotData);
          
          console.log("[facebook/analyze] ✅ Snapshot stored successfully", {
            business_id: placeId,
            network: 'facebook',
            followers: metrics.followers,
            likes: metrics.likes,
            posts_total: snapshotData.posts_total,
            posts_last_30d: snapshotData.posts_last_30d,
            days_since_last_post: snapshotData.days_since_last_post,
            engagement_rate: snapshotData.engagement_rate,
          });
        } catch (err: any) {
          console.error("[facebook/analyze] ❌ Failed to store snapshot", {
            error: err?.message,
            stack: err?.stack,
            business_id: placeId,
            network: 'facebook',
          });
          // Continue - snapshot storage is not critical
        }

        // 8. Store punchline using storePunchline helper
        if (punchline) {
          try {
            console.log('[facebook_analyze:store]', {
              tag: 'facebook_analyze:store',
              businessId: placeId,
              network: 'facebook',
            });
            await storePunchline(
              placeId,
              'facebook',
              {
                source: 'facebook',
                label: 'FACEBOOK',
                punchline: punchline.punchline,
                severity: punchline.severity,
              },
              metrics, // Store the metrics object
              serviceSupabase
            );
            console.log("[facebook/analyze] ✅ Punchline stored successfully", {
              placeId,
              punchline: punchline.punchline.substring(0, 50) + '...',
              severity: punchline.severity,
            });
          } catch (err) {
            console.error("[facebook/analyze] Failed to store punchline", err);
            // Continue - we still want to log that analysis completed
          }
        } else {
          console.warn("[facebook/analyze] No punchline generated, but metrics extracted", { metrics });
        }
      } catch (error: any) {
        console.error("[facebook/analyze] Analysis failed", {
          placeId,
          handle: normalizedHandle,
          error: error.message,
          stack: error.stack,
        });
        // Don't throw - we want to return success to user even if analysis fails
      }
    })();

    // Return immediately (don't wait for analysis)
    return NextResponse.json({ ok: true, status: "queued" }, { status: 202 });
  } catch (error: any) {
    console.error("[facebook/analyze] Error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

