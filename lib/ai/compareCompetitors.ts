/**
 * AI-powered competitor comparison and reasoning.
 * Server-side only - uses OpenAI API.
 */

interface BusinessSummary {
  name: string;
  rating_avg: number | null;
  reviews_total: number | null;
  has_gbp: boolean;
  photos_count?: number;
  listing_completeness?: number;
  owner_posts_recency_days?: number;
}

interface CompetitorSummary {
  name: string;
  rating_avg: number | null;
  reviews_total: number | null;
  distance_m: number;
  photo_reference?: string;
  open_now?: boolean;
}

export interface ComparisonResult {
  bullets: string[];
  reasons_short: string[]; // 2-5 word phrases
  source: 'ai' | 'heuristic';
}

/**
 * Summarize business for prompt context.
 */
export function summarizeBusinessForPrompt(business: BusinessSummary): string {
  const parts: string[] = [];

  parts.push(`${business.name} is a local business`);

  if (business.has_gbp) {
    parts.push('with a Google Business Profile');
  } else {
    parts.push('without a Google Business Profile');
  }

  if (business.rating_avg !== null && business.rating_avg !== undefined) {
    parts.push(`rated ${business.rating_avg.toFixed(1)} stars`);
  }

  if (business.reviews_total !== null && business.reviews_total !== undefined) {
    parts.push(`with ${business.reviews_total} total reviews`);
  }

  if (business.photos_count !== undefined && business.photos_count > 0) {
    parts.push(`${business.photos_count} photos`);
  }

  if (business.listing_completeness !== undefined) {
    parts.push(`listing completeness: ${business.listing_completeness}%`);
  }

  if (business.owner_posts_recency_days !== undefined) {
    if (business.owner_posts_recency_days <= 7) {
      parts.push('posted recently (within last week)');
    } else if (business.owner_posts_recency_days <= 30) {
      parts.push(`last posted ${business.owner_posts_recency_days} days ago`);
    } else {
      parts.push('inactive on social media');
    }
  }

  return parts.join(', ') + '.';
}

/**
 * Build heuristic short reasons from measurable differences (2-5 words each).
 */
export function buildReasonsShort(
  user: BusinessSummary,
  comp: CompetitorSummary,
  userReviewsLast30?: number | null
): string[] {
  const reasons: string[] = [];

  // Rating comparison
  if (
    comp.rating_avg !== null &&
    user.rating_avg !== null &&
    comp.rating_avg > user.rating_avg + 0.1
  ) {
    reasons.push('Higher rating');
  }

  // Reviews volume
  if (
    comp.reviews_total !== null &&
    user.reviews_total !== null &&
    comp.reviews_total >= user.reviews_total * 2
  ) {
    reasons.push('More review proof');
  } else if (
    comp.reviews_total !== null &&
    user.reviews_total !== null &&
    comp.reviews_total > user.reviews_total
  ) {
    reasons.push('More reviews');
  }

  // Fresh reviews
  if (userReviewsLast30 !== null && userReviewsLast30 !== undefined) {
    // We'd need competitor's reviews_last_30, but for now use placeholder logic
    // If we had it, check: comp.reviews_last_30 > userReviewsLast30
  }

  // Photos
  if (comp.photo_reference && (!user.photos_count || user.photos_count < 5)) {
    reasons.push('Better photos');
  }

  // Distance advantage (if significantly closer)
  if (comp.distance_m < 500) {
    reasons.push('Closer to searcher');
  }

  // GBP presence
  if (!user.has_gbp) {
    reasons.push('On Google Maps');
  }

  // Fallback if no specific reasons
  if (reasons.length === 0) {
    reasons.push('Stronger presence');
  }

  return reasons.slice(0, 4);
}

/**
 * Build heuristic reasons from measurable differences (long format for backward compatibility).
 */
export function buildReasonsHeuristic(
  user: BusinessSummary,
  comp: CompetitorSummary
): string[] {
  const bullets: string[] = [];

  // Rating comparison
  if (
    comp.rating_avg !== null &&
    user.rating_avg !== null &&
    comp.rating_avg > user.rating_avg
  ) {
    bullets.push(
      `Higher rating (${comp.rating_avg.toFixed(1)}★ vs ${user.rating_avg.toFixed(1)}★)`
    );
  }

  // Reviews volume
  if (
    comp.reviews_total !== null &&
    user.reviews_total !== null &&
    comp.reviews_total > user.reviews_total
  ) {
    const diff = comp.reviews_total - user.reviews_total;
    if (diff > 50) {
      bullets.push(`${diff}+ more reviews — customers see them as more proven`);
    } else {
      bullets.push(`More reviews (${comp.reviews_total} vs ${user.reviews_total})`);
    }
  }

  // Photos
  if (comp.photo_reference && (!user.photos_count || user.photos_count < 5)) {
    bullets.push('Richer photo gallery');
  }

  // Distance advantage
  if (comp.distance_m < 1000) {
    bullets.push('Closer to city center');
  }

  // Open now
  if (comp.open_now) {
    bullets.push('Currently open');
  }

  // GBP presence
  if (!user.has_gbp) {
    bullets.push('Appears on Google Maps (you don\'t yet)');
  }

  // Social activity
  if (user.owner_posts_recency_days !== undefined && user.owner_posts_recency_days > 30) {
    bullets.push('More active on social media');
  }

  // Fallback if no specific reasons
  if (bullets.length === 0) {
    bullets.push('Stronger overall presence in local search results');
  }

  return bullets.slice(0, 4);
}

/**
 * Get AI-generated short reasons using OpenAI (2-5 words each).
 */
async function getReasonsShortAI(
  user: BusinessSummary,
  comp: CompetitorSummary,
  phrasePills: string[]
): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const userSummary = summarizeBusinessForPrompt(user);
    const compSummary = `Competitor: ${comp.name}, rated ${comp.rating_avg?.toFixed(1) || 'N/A'} stars, ${comp.reviews_total || 0} reviews, ${comp.distance_m < 1000 ? `${comp.distance_m}m` : `${(comp.distance_m / 1000).toFixed(1)}km`} away.`;

    const systemPrompt = `You are a local SEO coach. Compare two Google Business Profiles and return 3-4 SHORT reason phrases (2-5 words each) why the competitor is winning. Each phrase should be comparative/advantage-focused. Output as JSON: { "reasons_short": string[] }`;

    const userPrompt = `User business: ${userSummary}

${compSummary}

Searches: ${phrasePills.join(', ')}

Return 3-4 short phrases (2-5 words each) like: "Higher rating", "More review proof", "Fresher reviews", "Better photos". No full sentences, just short comparative advantages.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content);
      if (parsed.reasons_short && Array.isArray(parsed.reasons_short)) {
        // Filter and validate: 2-5 words each
        return parsed.reasons_short
          .filter((r: any) => typeof r === 'string')
          .map((r: string) => r.trim())
          .filter((r: string) => {
            const words = r.split(/\s+/).length;
            return words >= 2 && words <= 5;
          })
          .slice(0, 4);
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
    }

    return null;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null;
  }
}

/**
 * Get AI-generated reasons using OpenAI (long format for backward compatibility).
 */
async function getReasonsAI(
  user: BusinessSummary,
  comp: CompetitorSummary,
  phrasePills: string[]
): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const userSummary = summarizeBusinessForPrompt(user);
    const compSummary = `Competitor: ${comp.name}, rated ${comp.rating_avg?.toFixed(1) || 'N/A'} stars, ${comp.reviews_total || 0} reviews, ${comp.distance_m < 1000 ? `${comp.distance_m}m` : `${(comp.distance_m / 1000).toFixed(1)}km`} away.`;

    const systemPrompt = `You are a local SEO coach. Compare two Google Business Profiles and return 3-4 concise, factual reasons why the competitor is winning for the given searches. Avoid hype or guesses; use only the provided facts. Output as JSON: { "bullets": string[] }`;

    const userPrompt = `User business: ${userSummary}

${compSummary}

Searches: ${phrasePills.join(', ')}

Why is the competitor winning these searches? Return 3-4 concise bullets.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content);
      if (parsed.bullets && Array.isArray(parsed.bullets)) {
        return parsed.bullets.filter((b: any) => typeof b === 'string').slice(0, 4);
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
    }

    return null;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null;
  }
}

/**
 * Explain why a competitor is outranking the user.
 */
export async function explainWhyOutranking(
  user: BusinessSummary,
  comp: CompetitorSummary,
  phrasePills: string[],
  userReviewsLast30?: number | null
): Promise<ComparisonResult> {
  // Try AI for short reasons first
  const aiReasonsShort = await getReasonsShortAI(user, comp, phrasePills);
  const aiBullets = await getReasonsAI(user, comp, phrasePills);

  if (aiReasonsShort && aiReasonsShort.length > 0) {
    return {
      bullets: aiBullets || buildReasonsHeuristic(user, comp),
      reasons_short: aiReasonsShort,
      source: 'ai',
    };
  }

  // Fallback to heuristic
  return {
    bullets: buildReasonsHeuristic(user, comp),
    reasons_short: buildReasonsShort(user, comp, userReviewsLast30),
    source: 'heuristic',
  };
}

