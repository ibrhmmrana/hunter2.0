import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { analyzeTikTokForPunchline } from "@/lib/social/analyzeTikTokForPunchline";
import { storePunchline } from "@/lib/insights/storePunchline";
import { storeSocialSnapshot } from "@/lib/social/storeSocialSnapshot";

export const dynamic = "force-dynamic";

/**
 * Normalize TikTok handle from various input formats.
 */
function normalizeTikTokHandle(raw: string): string {
  if (!raw) return '';
  let h = raw.trim();
  
  // Extract handle from URL if present
  h = h.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '');
  
  // Remove leading @
  h = h.replace(/^@/, '');
  
  // Remove trailing slashes
  h = h.replace(/\/+$/, '');
  
  return h.trim();
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
    const { placeId, handle }: { placeId?: string; handle?: string } = body;

    if (!placeId || typeof placeId !== "string" || !placeId.trim()) {
      return NextResponse.json({ ok: false, error: "placeId is required" }, { status: 400 });
    }

    if (!handle || typeof handle !== "string" || !handle.trim()) {
      return NextResponse.json({ ok: false, error: "handle is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    console.log('[tiktok_analyze:start]', {
      tag: 'tiktok_analyze:start',
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
    const normalizedHandle = normalizeTikTokHandle(handle);
    const profileUrl = `https://www.tiktok.com/@${normalizedHandle}`;

    // 5. Persist handle to social_profiles
    const { error: profileError } = await serviceSupabase
      .from("social_profiles")
      .upsert(
        {
          business_id: placeId,
          network: "tiktok",
          handle: normalizedHandle,
          profile_url: profileUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,network" }
      );

    if (profileError) {
      console.error("[tiktok/analyze] Failed to save profile", profileError);
      // Continue anyway - we can still analyze
    } else {
      console.log('[tiktok_analyze:profile_saved]', {
        tag: 'tiktok_analyze:profile_saved',
        businessId: placeId,
        handle: normalizedHandle,
      });
    }

    console.log('[tiktok_analyze:queued]', {
      tag: 'tiktok_analyze:queued',
      businessId: placeId,
      handle: normalizedHandle,
    });

    // 6. Kick off analysis in background (non-blocking)
    // Use void to explicitly mark as fire-and-forget
    void (async () => {
      try {
        console.log("[tiktok/analyze] Starting analysis", { 
          placeId, 
          handle: normalizedHandle,
          businessName: business.name,
        });

        console.log('[tiktok_analyze:apify:start]', {
          tag: 'tiktok_analyze:apify:start',
          businessId: placeId,
          handle: normalizedHandle,
        });

        // Analyze TikTok and generate punchline
        const result = await analyzeTikTokForPunchline(
          normalizedHandle,
          placeId, // Pass businessId for logging
          business.name || 'Business',
          business.primary_category || business.category || null
        );

        if (!result) {
          console.error("[tiktok/analyze] Analysis returned null");
          return;
        }

        const { metrics, punchline, rawData } = result;

        // 7. Store snapshot with full Apify data
        try {
          // Calculate engagement rate from last 10 videos
          // For TikTok, engagement rate = (avg likes + avg comments) / avg views
          let engagementRate: number | null = null;
          if (rawData.videos.length > 0) {
            const last10Videos = rawData.videos.slice(0, 10);
            let totalViews = 0;
            let totalLikes = 0;
            let totalComments = 0;
            
            last10Videos.forEach((video: any) => {
              const views = video.playCount || video.viewCount || video.stats?.playCount || video.stats?.viewCount || video.play || 0;
              const likes = video.diggCount || video.likeCount || video.stats?.diggCount || video.stats?.likeCount || video.digg || video.heartCount || 0;
              const comments = video.commentCount || video.stats?.commentCount || video.comment || 0;
              
              totalViews += views;
              totalLikes += likes;
              totalComments += comments;
            });
            
            if (last10Videos.length > 0 && totalViews > 0) {
              const avgViews = totalViews / last10Videos.length;
              const avgLikes = totalLikes / last10Videos.length;
              const avgComments = totalComments / last10Videos.length;
              // Engagement rate as (likes + comments) / views
              engagementRate = (avgLikes + avgComments) / avgViews;
            }
          }

          const snapshotData = {
            business_id: placeId,
            network: 'tiktok',
            posts_total: metrics.totalVideos,
            posts_last_30d: metrics.postsLast30Days,
            days_since_last_post: metrics.daysSinceLastPost,
            engagement_rate: engagementRate,
            followers: metrics.followers,
            likes: null, // Not applicable for TikTok
            raw_data: rawData, // Store full Apify response
          };
          
          console.log("[tiktok/analyze] Attempting to store snapshot", {
            business_id: snapshotData.business_id,
            network: snapshotData.network,
            posts_total: snapshotData.posts_total,
            posts_last_30d: snapshotData.posts_last_30d,
            followers: snapshotData.followers,
            engagement_rate: snapshotData.engagement_rate,
          });
          
          await storeSocialSnapshot(serviceSupabase, snapshotData);
          
          console.log("[tiktok/analyze] ✅ Snapshot stored successfully", {
            business_id: placeId,
            network: 'tiktok',
            posts_total: metrics.totalVideos,
            posts_last_30d: metrics.postsLast30Days,
            days_since_last_post: metrics.daysSinceLastPost,
            engagement_rate: engagementRate,
            followers: metrics.followers,
          });
        } catch (err: any) {
          console.error("[tiktok/analyze] ❌ Failed to store snapshot", {
            error: err?.message,
            stack: err?.stack,
            business_id: placeId,
            network: 'tiktok',
          });
          // Continue - snapshot storage is not critical
        }

        // 8. Store punchline using storePunchline helper
        if (punchline) {
          try {
            console.log('[tiktok_analyze:store]', {
              tag: 'tiktok_analyze:store',
              businessId: placeId,
              network: 'tiktok',
            });
            await storePunchline(
              placeId,
              'tiktok',
              {
                source: 'tiktok',
                label: 'TIKTOK',
                punchline: punchline.punchline,
                severity: punchline.severity,
              },
              metrics, // Store the metrics object
              serviceSupabase
            );
            console.log("[tiktok/analyze] ✅ Punchline stored successfully", {
              placeId,
              punchline: punchline.punchline.substring(0, 50) + '...',
              severity: punchline.severity,
            });
          } catch (err) {
            console.error("[tiktok/analyze] Failed to store punchline", err);
            // Continue - we still want to log that analysis completed
          }
        } else {
          console.warn("[tiktok/analyze] No punchline generated, but metrics extracted", { metrics });
        }
      } catch (error: any) {
        console.error("[tiktok/analyze] Analysis failed", {
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
    console.error("[tiktok/analyze] Error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

