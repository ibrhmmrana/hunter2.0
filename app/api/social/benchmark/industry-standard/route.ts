import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { openai } from "@/lib/openaiClient";

export const dynamic = "force-dynamic";

/**
 * POST /api/social/benchmark/industry-standard
 * Gets industry standard benchmark score for a social media network
 * Body: { businessId: string, network: 'instagram' | 'tiktok' | 'facebook', businessCategory?: string }
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
    const { businessId, network, businessCategory } = body;

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
      .select("place_id, owner_id, primary_category")
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

    // Check if stored benchmark exists
    if (!forceRefresh) {
      const { data: storedScore, error: storedError } = await serviceSupabase
        .from("benchmark_scores")
        .select("benchmark_score, benchmark_reasoning")
        .eq("business_id", businessId)
        .eq("network", network)
        .maybeSingle();

      if (!storedError && storedScore && storedScore.benchmark_score !== null) {
        return NextResponse.json({
          ok: true,
          data: {
            score: Number(storedScore.benchmark_score),
            reasoning: storedScore.benchmark_reasoning || "Industry standard benchmark",
            network,
            category: businessCategory || business.primary_category || "general business",
          },
        });
      }
    }

    const category = businessCategory || business.primary_category || "general business";

    // Use OpenAI to research industry standards
    // Note: For production, you might want to use OpenAI's web search capabilities or a separate service
    const prompt = `Research and provide the industry standard performance score for ${network} social media accounts in the "${category}" industry.

Consider typical benchmarks for:
- Posting frequency (posts per week/month)
- Engagement rates
- Follower growth rates
- Content consistency

Based on current industry standards and best practices for ${network} in ${category}, what would be a reasonable benchmark score (0-100) that represents "good" or "industry standard" performance?

Return ONLY a JSON object with this exact structure:
{
  "score": <number between 0 and 100 representing industry standard>,
  "reasoning": "<brief explanation of the benchmark>",
  "sources": "<mention if this is based on general industry knowledge>"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a social media industry research expert. You have knowledge of current industry benchmarks and standards for social media performance across different industries. Provide realistic benchmark scores based on industry standards.`,
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
    const benchmarkScore = Math.max(0, Math.min(100, result.score || 70));

    // Store the benchmark score in database
    await serviceSupabase
      .from("benchmark_scores")
      .upsert({
        business_id: businessId,
        network,
        benchmark_score: benchmarkScore,
        benchmark_reasoning: result.reasoning || "Industry standard benchmark",
      }, {
        onConflict: "business_id,network",
      });

    return NextResponse.json({
      ok: true,
      data: {
        score: benchmarkScore,
        reasoning: result.reasoning || "Industry standard benchmark",
        network,
        category,
      },
    });
  } catch (error: any) {
    console.error("[social/benchmark/industry-standard] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

