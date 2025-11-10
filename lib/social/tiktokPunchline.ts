/**
 * Generate TikTok punchline from Apify data.
 * 
 * This module is server-only.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type TikTokMetrics = {
  network: 'tiktok';
  handle: string;
  followers: number;
  totalVideos: number;
  lastPostAt: string | null; // ISO timestamp
  daysSinceLastPost: number | null;
  postsLast30Days: number;
  avgViewsLast10: number | null;
  medianViewsLast10: number | null;
  avgLikesLast10: number | null;
  avgCommentsLast10: number | null;
  percentPromoPostsLast10: number;
  engagementQuality: 'strong' | 'ok' | 'weak';
};

export type TikTokPunchlineResult = {
  network: 'tiktok';
  punchline: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Generate a single punchy line for TikTok based on metrics.
 */
export async function generateTikTokPunchline(
  metrics: TikTokMetrics
): Promise<TikTokPunchlineResult | null> {
  if (!OPENAI_API_KEY) {
    console.error('[tiktokPunchline] OPENAI_API_KEY not configured');
    return null;
  }

  const systemPrompt = `You are an assistant that turns TikTok profile metrics into a single punchy diagnostic line for a local business.

Rules:

* Output JSON only, no prose, no code fences.
* Shape:
  {
  "network": "tiktok",
  "punchline": string,
  "severity": "low" | "medium" | "high" | "critical"
  }
* The punchline must:

  * Reference at least one concrete metric you received (e.g. followers, days since last post, posts in last 30 days, average views).
  * Be specific enough that it's obviously about THIS account, not generic.
  * Be one sentence, max ~25 words.
  * Focus on what's hurting discovery or growth the most (inconsistency, weak engagement, low output, etc.).
* Severity:

  * "critical": very stale or almost no content, extremely weak activity vs size.
  * "high": clear issues (low posting, weak metrics) that likely hurt growth.
  * "medium": mixed performance; room to improve.
  * "low": account is active and healthy; highlight strength or next-level tweak.
* If metrics indicate they're doing well, still give a punchy, data-backed line (not fear-based), and severity "low".
* If you get obviously incomplete or nonsense metrics, return:
  {
  "network": "tiktok",
  "punchline": "",
  "severity": "medium"
  }`;

  // Build user prompt with metrics
  const userPrompt = JSON.stringify(metrics, null, 2);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('[tiktokPunchline] OpenAI API error', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[tiktokPunchline] No content in OpenAI response');
      return null;
    }

    // Parse JSON
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as { network?: string; punchline?: string; severity?: string };

    // Validate
    if (!parsed.punchline || typeof parsed.punchline !== 'string' || parsed.punchline.trim().length === 0) {
      console.error('[tiktokPunchline] Invalid or empty punchline in response', parsed);
      return null;
    }

    if (!parsed.severity || typeof parsed.severity !== 'string') {
      console.error('[tiktokPunchline] Invalid severity in response', parsed);
      return null;
    }

    // Normalize severity to lowercase
    const normalizedSeverity = parsed.severity.toLowerCase().trim();
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedSeverity)) {
      console.error('[tiktokPunchline] Invalid severity value', normalizedSeverity);
      return null;
    }

    return {
      network: 'tiktok',
      punchline: parsed.punchline.trim(),
      severity: normalizedSeverity as 'low' | 'medium' | 'high' | 'critical',
    };
  } catch (error: any) {
    console.error('[tiktokPunchline] Error generating punchline', error);
    return null;
  }
}

