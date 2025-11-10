import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { analyzeInstagramForPunchline } from "@/lib/social/analyzeInstagramForPunchline";
import { storePunchline } from "@/lib/insights/storePunchline";
import { storeSocialSnapshot } from "@/lib/social/storeSocialSnapshot";
import { extractInstagramSummary } from "@/lib/social/instagramSummary";

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

    // 4. Normalize handle (remove @, trim, remove trailing slash)
    let normalizedHandle = handle.replace(/^@/, '').trim();
    if (normalizedHandle.endsWith('/')) {
      normalizedHandle = normalizedHandle.slice(0, -1);
    }
    normalizedHandle = normalizedHandle.trim();
    const profileUrl = `https://www.instagram.com/${normalizedHandle}`; // No trailing slash

    // 5. Persist handle to social_profiles (use normalized URL without trailing slash)
    const { error: profileError } = await serviceSupabase
      .from("social_profiles")
      .upsert(
        {
          business_id: placeId,
          network: "instagram",
          handle: normalizedHandle,
          profile_url: profileUrl, // Already normalized (no trailing slash)
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,network" }
      );

    if (profileError) {
      console.error("[instagram/analyze] Failed to save profile", profileError);
      // Continue anyway - we can still analyze
    } else {
      console.log('[instagram_analyze:profile_saved]', {
        tag: 'instagram_analyze:profile_saved',
        businessId: placeId,
        handle: normalizedHandle,
      });
    }

    console.log('[instagram_analyze:start]', {
      tag: 'instagram_analyze:start',
      businessId: placeId,
      handle: normalizedHandle,
    });

    // 6. Kick off analysis in background (non-blocking)
    // Use void to explicitly mark as fire-and-forget
    void (async () => {
      try {
        console.log("[instagram/analyze] Starting analysis", { 
          placeId, 
          handle: normalizedHandle,
          businessName: business.name,
        });

        console.log('[instagram_analyze:apify:start]', {
          tag: 'instagram_analyze:apify:start',
          businessId: placeId,
          handle: normalizedHandle,
        });

        // Analyze Instagram and generate punchline
        const result = await analyzeInstagramForPunchline(
          normalizedHandle,
          business.name || 'Business',
          business.primary_category || business.category || null
        );

        if (!result) {
          console.error("[instagram/analyze] Analysis returned null");
          return;
        }

        const { metrics, punchline, profile } = result;

        // 7. Store snapshot with full Apify data
        try {
          const summary = extractInstagramSummary(profile);
          
          // Combine all post types for engagement calculation
          const allPosts: any[] = [];
          if (Array.isArray(profile.latestPosts)) {
            allPosts.push(...profile.latestPosts);
          }
          if (Array.isArray(profile.latestIgtvVideos)) {
            allPosts.push(...profile.latestIgtvVideos);
          }
          if (Array.isArray(profile.latestReels)) {
            allPosts.push(...profile.latestReels);
          }
          // Sort by timestamp (most recent first)
          allPosts.sort((a, b) => {
            const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tsB - tsA;
          });

          // Calculate engagement rate from last 10 posts
          const last10Posts = allPosts.slice(0, 10);
          let engagementRate: number | null = null;
          if (last10Posts.length > 0 && summary.followers && summary.followers > 0) {
            const totalEngagement = last10Posts.reduce((sum: number, post: any) => {
              const likes = post.likesCount ?? 0;
              const comments = post.commentsCount ?? 0;
              return sum + likes + comments;
            }, 0);
            const avgEngagement = totalEngagement / last10Posts.length;
            engagementRate = avgEngagement / summary.followers;
          }

          // Try to get total posts count - might be in different fields
          const postsTotal = profile.postsCount ?? 
                            profile.mediaCount ?? 
                            (allPosts.length > 0 ? allPosts.length : null);

          const snapshotData = {
            business_id: placeId,
            network: 'instagram',
            posts_total: postsTotal,
            posts_last_30d: summary.postsLast30Days,
            days_since_last_post: summary.daysSinceLastPost,
            engagement_rate: engagementRate,
            followers: summary.followers,
            likes: null, // Not applicable for Instagram
            raw_data: profile, // Store full Apify response
          };
          
          console.log("[instagram/analyze] Attempting to store snapshot", {
            business_id: snapshotData.business_id,
            network: snapshotData.network,
            posts_total: snapshotData.posts_total,
            posts_last_30d: snapshotData.posts_last_30d,
            followers: snapshotData.followers,
          });
          
          await storeSocialSnapshot(serviceSupabase, snapshotData);
          
          console.log("[instagram/analyze] ✅ Snapshot stored successfully", {
            business_id: placeId,
            network: 'instagram',
            posts_total: postsTotal,
            posts_last_30d: summary.postsLast30Days,
            days_since_last_post: summary.daysSinceLastPost,
            engagement_rate: engagementRate,
            followers: summary.followers,
          });
        } catch (err: any) {
          console.error("[instagram/analyze] ❌ Failed to store snapshot", {
            error: err?.message,
            stack: err?.stack,
            business_id: placeId,
            network: 'instagram',
          });
          // Continue - snapshot storage is not critical
        }

        // 8. Store punchline using storePunchline helper
        if (punchline) {
          try {
            console.log('[instagram_analyze:store]', {
              tag: 'instagram_analyze:store',
              businessId: placeId,
              network: 'instagram',
            });
            await storePunchline(
              placeId,
              'instagram',
              {
                source: 'instagram',
                label: 'INSTAGRAM',
                punchline: punchline.punchline,
                severity: punchline.severity,
              },
              metrics, // Store the metrics object
              serviceSupabase
            );
            console.log("[instagram/analyze] ✅ Punchline stored successfully", {
              placeId,
              punchline: punchline.punchline.substring(0, 50) + '...',
              severity: punchline.severity,
            });
          } catch (err) {
            console.error("[instagram/analyze] Failed to store punchline", err);
            // Continue - we still want to log that analysis completed
          }
        } else {
          console.warn("[instagram/analyze] No punchline generated, but metrics extracted", { metrics });
        }
      } catch (error: any) {
        console.error("[instagram/analyze] Analysis failed", {
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
    console.error("[instagram/analyze] Error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

