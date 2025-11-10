/**
 * Generate Instagram punchline from Apify data.
 * 
 * This module is server-only.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type InstagramMetrics = {
  followers: number;
  postsLast30: number;
  daysSinceLastPost: number | null;
};

export type InstagramPunchlineResult = {
  punchline: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Generate a single punchy line for Instagram based on metrics.
 */
export async function generateInstagramPunchline(
  businessName: string,
  category: string | null,
  metrics: InstagramMetrics
): Promise<InstagramPunchlineResult | null> {
  if (!OPENAI_API_KEY) {
    console.error('[instagramPunchline] OPENAI_API_KEY not configured');
    return null;
  }

  const systemPrompt = `You are helping a local business understand how their Instagram presence affects customer discovery.

Return a single punchy diagnostic line that feels specific to their numbers, not generic.

Always include at least one concrete metric (like days since last post, posts in last 30 days, or followers).

Do not focus on positive activity. We want to highlight a problem, or something that can be improved.

Output **only** a JSON object with this shape:
{
  "punchline": "string",
  "severity": "low" | "medium" | "high" | "critical"
}

No extra keys, no commentary, no markdown.`;

  // Build user prompt with available data
  let userPrompt = `Business: ${businessName}`;
  if (category) {
    userPrompt += ` (${category})`;
  }
  userPrompt += `\nFollowers: ${metrics.followers}`;
  userPrompt += `\nPosts in last 30 days: ${metrics.postsLast30}`;
  if (metrics.daysSinceLastPost !== null) {
    userPrompt += `\nDays since last post: ${metrics.daysSinceLastPost}`;
  } else {
    userPrompt += `\nDays since last post: No posts found`;
  }
  userPrompt += `\n\nBased on these numbers, produce the JSON response as specified.`;

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
      console.error('[instagramPunchline] OpenAI API error', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[instagramPunchline] No content in OpenAI response');
      return null;
    }

    // Parse JSON
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as { punchline?: string; severity?: string };

    // Validate
    if (!parsed.punchline || typeof parsed.punchline !== 'string' || parsed.punchline.trim().length === 0) {
      console.error('[instagramPunchline] Invalid punchline in response', parsed);
      return null;
    }

    if (!parsed.severity || typeof parsed.severity !== 'string') {
      console.error('[instagramPunchline] Invalid severity in response', parsed);
      return null;
    }

    // Normalize severity to lowercase
    const normalizedSeverity = parsed.severity.toLowerCase().trim();
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedSeverity)) {
      console.error('[instagramPunchline] Invalid severity value', normalizedSeverity);
      return null;
    }

    return {
      punchline: parsed.punchline.trim(),
      severity: normalizedSeverity as 'low' | 'medium' | 'high' | 'critical',
    };
  } catch (error: any) {
    console.error('[instagramPunchline] Error generating punchline', error);
    return null;
  }
}

