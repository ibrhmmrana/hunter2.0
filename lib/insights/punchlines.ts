/**
 * Generate punchy, one-line insights for each channel.
 * 
 * This module is server-only.
 */

import type { GoogleSummary } from './googleSummary';
import type { InstagramSummary } from '../social/instagramSummary';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type Punchline = {
  source: 'google' | 'instagram' | string;
  label: string; // e.g. "GOOGLE", "INSTAGRAM"
  punchline: string; // one short sentence
  severity: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Get Google punchline from summary.
 */
export async function getGooglePunchline(
  summary: GoogleSummary
): Promise<Punchline | null> {
  if (!OPENAI_API_KEY) {
    console.error('[punchlines] OPENAI_API_KEY not configured');
    return null;
  }

  const systemPrompt = `You are analyzing local search competitiveness on Google Business Profile.

You will receive ONLY structured metrics from one business and nearby leaders.

Use ONLY these metrics; never assume data that is not provided.

CRITICAL RULES:
1. Your punchline MUST include at least one explicit number or concrete fact from the metrics.
2. Never contradict the metrics (e.g., don't say "no hours" if hasBusinessHours is true).
3. If there's no meaningful gap, return a protective punchline with severity "low" (not null).

Respond with exactly one short, punchy sentence (max 160 characters)
explaining the biggest gap or confirming they are in a strong position.

Examples you should produce (depending on actual metrics):
* "You have 12 Google reviews; nearby leaders average 645 — you're nearly invisible in local search."
* "Your rating is 4.1 vs 4.6 for leaders — close the gap with a review push."
* "You're missing opening hours while competitors show them — customers can't tell when you're open."
* "You match leaders on rating and reviews — protect that lead by keeping reviews flowing."

Focus on clear, concrete facts:
* Reviews volume vs leaders (include actual numbers)
* Rating vs leaders (include actual ratings)
* Missing hours/website/photos only if explicitly marked as missing (hasBusinessHours: false, etc.)

Return JSON:
{ "punchline": "<sentence>", "severity": "<low|medium|high|critical>" }

Severity should reflect how serious the gap is based only on metrics.`;

  const userMessage = JSON.stringify(summary, null, 2);

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('[punchlines] OpenAI API error for Google', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    // Parse JSON
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as { punchline: string; severity: string };

    if (
      typeof parsed.punchline === 'string' &&
      parsed.punchline.length > 0 &&
      parsed.punchline.length <= 160 &&
      ['low', 'medium', 'high', 'critical'].includes(parsed.severity)
    ) {
      return {
        source: 'google',
        label: 'GOOGLE',
        punchline: parsed.punchline.trim(),
        severity: parsed.severity as 'low' | 'medium' | 'high' | 'critical',
      };
    }

    return null;
  } catch (error: any) {
    console.error('[punchlines] Error generating Google punchline', error);
    return null;
  }
}

/**
 * Get Instagram punchline from summary.
 */
export async function getInstagramPunchline(
  summary: InstagramSummary
): Promise<Punchline | null> {
  if (!OPENAI_API_KEY) {
    console.error('[punchlines] OPENAI_API_KEY not configured');
    return null;
  }

  // Don't generate punchline if no profile
  if (!summary.hasProfile) {
    return null;
  }

  const systemPrompt = `You are analyzing an Instagram business account's basic health.

You will receive ONLY structured metrics (followers, postsLast30Days,
daysSinceLastPost, average engagement).

Use ONLY these metrics; never invent missing data.

CRITICAL RULES:
1. Your punchline MUST include at least one explicit number or concrete fact from the metrics.
2. Never contradict the metrics (e.g., don't say "no recent posts" if daysSinceLastPost is small).
3. If hasProfile is false or metrics are empty, you should not generate a punchline (return null).

Respond with one short, punchy sentence (max 160 characters)
about the most important insight. Include actual numbers from the metrics.

Examples you should produce (depending on actual metrics):
* "You haven't posted on Instagram for 24 days; active spots post at least once a week."
* "You haven't posted on Instagram in the last 30 days — customers may assume you're inactive."
* "You've posted 9 times in the last month and stayed active this week — your Instagram presence looks healthy."
* "You posted 15 times in 30 days, but average only 2 likes — your content isn't engaging your audience yet."

Behavior rules:
* If daysSinceLastPost >= 21: highlight inactivity with the actual number of days.
* If postsLast30Days == 0: mention no posts in 30 days.
* If postsLast30Days >= 8 and daysSinceLastPost <= 3: praise consistency with actual numbers.
* If engagement numbers are very low despite many posts: mention the gap with actual numbers.

If metrics look good overall, say it's healthy with specific numbers.

Output JSON only:
{ "punchline": "<sentence>", "severity": "<low|medium|high|critical>" }`;

  const userMessage = JSON.stringify(summary, null, 2);

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('[punchlines] OpenAI API error for Instagram', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    // Parse JSON
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as { punchline: string; severity: string };

    if (
      typeof parsed.punchline === 'string' &&
      parsed.punchline.length > 0 &&
      parsed.punchline.length <= 160 &&
      ['low', 'medium', 'high', 'critical'].includes(parsed.severity)
    ) {
      return {
        source: 'instagram',
        label: 'INSTAGRAM',
        punchline: parsed.punchline.trim(),
        severity: parsed.severity as 'low' | 'medium' | 'high' | 'critical',
      };
    }

    return null;
  } catch (error: any) {
    console.error('[punchlines] Error generating Instagram punchline', error);
    return null;
  }
}

