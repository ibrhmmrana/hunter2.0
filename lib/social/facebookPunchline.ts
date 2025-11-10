/**
 * Generate Facebook punchline from Apify data.
 * 
 * This module is server-only.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type FacebookMetrics = {
  pageUrl: string;
  pageName: string | null;
  category: string | null;
  likes: number | null;
  followers: number | null;
  ratingOverall: number | null;
  ratingCount: number | null;
  hasBusinessHours: boolean;
  businessHours: string | null;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  intro: string | null;
};

export type FacebookPunchlineResult = {
  network: 'facebook';
  punchline: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Generate a single punchy line for Facebook based on metrics.
 */
export async function generateFacebookPunchline(
  metrics: FacebookMetrics
): Promise<FacebookPunchlineResult | null> {
  if (!OPENAI_API_KEY) {
    console.error('[facebookPunchline] OPENAI_API_KEY not configured');
    return null;
  }

  const systemPrompt = `You are a sharp, no-BS growth consultant for local businesses.
You receive structured metrics for ONE Facebook Page.

Your job: produce ONE punchy, metric-based sentence that exposes
a clear weakness or missed opportunity, using ONLY the metrics provided.

Rules:

- Output ONLY a single JSON object. No markdown, no extra text.
- Format exactly:
  {
    "network": "facebook",
    "punchline": string,
    "severity": "low" | "medium" | "high" | "critical"
  }
- The punchline:
  - MUST reference at least one concrete metric from the input
    (likes, followers, rating, review count, missing website/phone/email/hours, etc).
  - MUST feel specific (numbers or explicit facts), not generic fluff.
  - MUST be max ~160 characters.
  - DO NOT invent data.
  - DO NOT mention competitors unless explicit competitor metrics are provided (they are not here).
- If everything looks strong, return a mild optimization angle
  but still tied to real metrics (e.g. "1,000 followers but only 8 reviews").
- If you have no useful metrics at all, return:
  {"network":"facebook","punchline":"","severity":"low"}.`;

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
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error('[facebookPunchline] OpenAI API error', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[facebookPunchline] No content in OpenAI response');
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
    const punchline = (parsed.punchline || '').toString().trim();
    if (!punchline || punchline.length === 0) {
      console.error('[facebookPunchline] Invalid or empty punchline in response', parsed);
      return null;
    }

    if (!parsed.severity || typeof parsed.severity !== 'string') {
      console.error('[facebookPunchline] Invalid severity in response', parsed);
      return null;
    }

    // Normalize severity to lowercase
    const normalizedSeverity = parsed.severity.toLowerCase().trim();
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedSeverity)) {
      console.error('[facebookPunchline] Invalid severity value', normalizedSeverity);
      return null;
    }

    return {
      network: 'facebook',
      punchline: punchline,
      severity: normalizedSeverity as 'low' | 'medium' | 'high' | 'critical',
    };
  } catch (error: any) {
    console.error('[facebookPunchline] Error generating punchline', error);
    return null;
  }
}

