import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { openai } from "@/lib/openaiClient";

export const dynamic = "force-dynamic";

/**
 * POST /api/social/benchmark/analyze
 * Analyzes social media data and generates a performance score (0-100)
 * Body: { businessId: string, network: 'instagram' | 'tiktok' | 'facebook' }
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
    const { businessId, network } = body;

    if (!businessId || !network) {
      return NextResponse.json(
        { ok: false, error: "businessId and network are required" },
        { status: 400 }
      );
    }

    if (!['instagram', 'tiktok', 'facebook'].includes(network)) {
      return NextResponse.json(
        { ok: false, error: "network must be instagram, tiktok, or facebook" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify business ownership
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json(
        { ok: false, error: "Business not found" },
        { status: 404 }
      );
    }

    if (business.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Check if we should force refresh (from query param)
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

    // Check if stored score exists and snapshot hasn't changed
    if (!forceRefresh) {
      const { data: storedScore, error: storedError } = await serviceSupabase
        .from("benchmark_scores")
        .select("*")
        .eq("business_id", businessId)
        .eq("network", network)
        .maybeSingle();

      if (!storedError && storedScore) {
        // Check if snapshot is still current
        const { data: latestSnapshot } = await serviceSupabase
          .from("social_snapshots")
          .select("snapshot_ts")
          .eq("business_id", businessId)
          .eq("network", network)
          .order("snapshot_ts", { ascending: false })
          .limit(1)
          .maybeSingle();

        // If snapshot matches or is older, return stored score
        if (latestSnapshot && storedScore.snapshot_ts && 
            new Date(storedScore.snapshot_ts) >= new Date(latestSnapshot.snapshot_ts)) {
          return NextResponse.json({
            ok: true,
            data: {
              score: Number(storedScore.current_score),
              reasoning: storedScore.current_reasoning || "Score generated based on social media metrics",
              network,
            },
          });
        }
      }
    }

    // Fetch latest snapshot for this network
    const { data: snapshot, error: snapshotError } = await serviceSupabase
      .from("social_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .eq("network", network)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { ok: false, error: "No snapshot found for this network" },
        { status: 404 }
      );
    }

    // Prepare data for analysis
    const socialData = {
      network,
      posts_total: snapshot.posts_total,
      posts_last_30d: snapshot.posts_last_30d,
      days_since_last_post: snapshot.days_since_last_post,
      engagement_rate: snapshot.engagement_rate,
      followers: snapshot.followers,
    };

    // Generate score using OpenAI
    const prompt = `You are analyzing ${network} social media performance data. Based on the following metrics, generate a performance score from 0 to 100.

Metrics:
- Total posts: ${socialData.posts_total ?? 'N/A'}
- Posts in last 30 days: ${socialData.posts_last_30d ?? 'N/A'}
- Days since last post: ${socialData.days_since_last_post ?? 'N/A'}
- Engagement rate: ${socialData.engagement_rate ? (socialData.engagement_rate * 100).toFixed(2) + '%' : 'N/A'}
- Followers: ${socialData.followers ? socialData.followers.toLocaleString() : 'N/A'}

Consider:
- Posting frequency (more recent posts = better)
- Engagement rate (higher = better)
- Follower count (context matters, but growth is key)
- Consistency (regular posting = better)

Return ONLY a JSON object with this exact structure:
{
  "score": <number between 0 and 100>,
  "reasoning": "<brief explanation of the score>"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a social media analytics expert. Analyze performance data and return scores as JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const score = Math.max(0, Math.min(100, result.score || 50));

    // Store the score in database
    await serviceSupabase
      .from("benchmark_scores")
      .upsert({
        business_id: businessId,
        network,
        current_score: score,
        current_reasoning: result.reasoning || "Score generated based on social media metrics",
        snapshot_ts: snapshot.snapshot_ts,
      }, {
        onConflict: "business_id,network",
      });

    return NextResponse.json({
      ok: true,
      data: {
        score,
        reasoning: result.reasoning || "Score generated based on social media metrics",
        network,
      },
    });
  } catch (error: any) {
    console.error("[social/benchmark/analyze] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

