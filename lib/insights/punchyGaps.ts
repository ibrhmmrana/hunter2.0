/**
 * Generate punchy, AI-driven gap analysis for businesses.
 * 
 * This module is server-only and should never be imported in client components.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type PunchyLine = {
  source: 'gbp' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  message: string; // max 140 chars, single sentence, no bullets
  severity: 'low' | 'medium' | 'high';
};

interface GBPSituation {
  rating: number | null;
  reviews: number | null;
  hasPhotos: boolean | null;
  hasHours: boolean | null;
  hasWebsite: boolean | null;
}

interface GBPCompetitor {
  rating: number | null;
  reviews: number | null;
  distanceMeters: number | null;
}

interface InstagramSituation {
  connected: boolean;
  followers: number | null;
  lastPostDaysAgo: number | null;
  postsLast30Days: number | null;
}

interface Situation {
  gbp: GBPSituation;
  gbpCompetitors: GBPCompetitor[];
  instagram: InstagramSituation;
}

/**
 * Get punchy gap lines for a business using AI analysis.
 */
export async function getPunchyGapsForBusiness(
  businessId: string,
  supabase: any // Service role client
): Promise<PunchyLine[]> {
  if (!OPENAI_API_KEY) {
    console.error('[punchyGaps] OPENAI_API_KEY not configured');
    return [];
  }

  try {
    // 1. Load GBP metrics
    const gbp = await loadGBPSituation(businessId, supabase);
    
    // 2. Load competitor metrics
    const gbpCompetitors = await loadGBPCompetitors(businessId, supabase);
    
    // 3. Load Instagram summary
    const instagram = await loadInstagramSituation(businessId, supabase);
    
    // 4. Build situation object
    const situation: Situation = {
      gbp,
      gbpCompetitors,
      instagram,
    };
    
    // 5. Call OpenAI
    const lines = await callOpenAIForPunchyGaps(situation);
    
    return lines;
  } catch (error: any) {
    console.error('[punchyGaps] Error generating punchy gaps', {
      businessId,
      error: error.message,
      stack: error.stack,
    });
    return [];
  }
}

/**
 * Load GBP situation from database.
 */
async function loadGBPSituation(businessId: string, supabase: any): Promise<GBPSituation> {
  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('rating, reviews_count, google_maps_url, image_url')
    .eq('place_id', businessId)
    .maybeSingle();
  
  // Get latest snapshot for more accurate data
  const { data: snapshot } = await supabase
    .from('snapshots_gbp')
    .select('rating_avg, reviews_total, raw')
    .eq('business_place_id', businessId)
    .order('snapshot_ts', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Prefer snapshot data, fallback to business table
  const rating = snapshot?.rating_avg ?? business?.rating ?? null;
  const reviews = snapshot?.reviews_total ?? business?.reviews_count ?? null;
  
  // Check for photos (from business image_url or snapshot raw)
  const hasPhotos = !!(business?.image_url || snapshot?.raw?.photos?.length > 0);
  
  // Check for hours (from snapshot raw)
  const hasHours = !!(snapshot?.raw?.opening_hours?.weekday_text?.length > 0);
  
  // Check for website (from snapshot raw or business)
  const hasWebsite = !!(snapshot?.raw?.website || business?.google_maps_url);
  
  return {
    rating,
    reviews,
    hasPhotos,
    hasHours,
    hasWebsite,
  };
}

/**
 * Load GBP competitor metrics.
 */
async function loadGBPCompetitors(businessId: string, supabase: any): Promise<GBPCompetitor[]> {
  const { data: competitors } = await supabase
    .from('business_competitors')
    .select('rating_avg, reviews_total, distance_m')
    .eq('business_place_id', businessId)
    .order('is_stronger', { ascending: false })
    .order('reviews_total', { ascending: false })
    .order('rating_avg', { ascending: false })
    .limit(5);
  
  if (!competitors || competitors.length === 0) {
    return [];
  }
  
  return competitors.map((c: any) => ({
    rating: c.rating_avg ?? null,
    reviews: c.reviews_total ?? null,
    distanceMeters: c.distance_m ?? null,
  }));
}

/**
 * Load Instagram situation from database.
 */
async function loadInstagramSituation(businessId: string, supabase: any): Promise<InstagramSituation> {
  // Check if Instagram profile exists
  const { data: profile } = await supabase
    .from('social_profiles')
    .select('handle')
    .eq('business_id', businessId)
    .eq('network', 'instagram')
    .maybeSingle();
  
  if (!profile) {
    return {
      connected: false,
      followers: null,
      lastPostDaysAgo: null,
      postsLast30Days: null,
    };
  }
  
  // Get insights - try both analysis and old fields
  const { data: insights } = await supabase
    .from('social_insights')
    .select('analysis, days_since_last_post, posts_last_30d')
    .eq('business_id', businessId)
    .eq('network', 'instagram')
    .maybeSingle();
  
  if (!insights) {
    // Profile exists but no insights yet
    return {
      connected: true,
      followers: null,
      lastPostDaysAgo: null,
      postsLast30Days: null,
    };
  }
  
  // Prefer old fields if available (more accurate)
  if (insights.days_since_last_post !== null || insights.posts_last_30d !== null) {
    return {
      connected: true,
      followers: null,
      lastPostDaysAgo: insights.days_since_last_post ?? null,
      postsLast30Days: insights.posts_last_30d ?? null,
    };
  }
  
  // Fallback: try to infer from analysis score
  if (insights.analysis) {
    const analysis = insights.analysis as any;
    const postingScore = analysis.score?.posting_consistency ?? null;
    
    // If posting score is very low (< 30), likely inactive
    // This is a heuristic
    return {
      connected: true,
      followers: null,
      lastPostDaysAgo: postingScore !== null && postingScore < 30 ? 30 : null,
      postsLast30Days: null,
    };
  }
  
  return {
    connected: true,
    followers: null,
    lastPostDaysAgo: null,
    postsLast30Days: null,
  };
}

/**
 * Call OpenAI to generate punchy gap lines.
 */
async function callOpenAIForPunchyGaps(situation: Situation): Promise<PunchyLine[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = `You are an analyst for local businesses.

You receive a small JSON object called "situation" with:

* The business's Google Business Profile metrics.
* A few nearby competitors' GBP metrics.
* Optionally, Instagram activity summary.

Your job:

* Decide if there is a CLEAR, DATA-SUPPORTED gap worth mentioning for each source.
* For each relevant source (gbp, instagram, etc.), produce at most ONE punchy line:

  * Short, concrete, commercially useful.
  * Based ONLY on provided numbers.
  * Example style:

    * "You have 12 Google reviews; nearby leaders average 645."
    * "You last posted on Instagram 6 weeks ago; customers think you're inactive."

Very important rules:

1. Output must be a JSON array of objects, no extra keys, no markdown.
2. Each object must match exactly:
   {
   "source": "gbp" | "instagram" | "facebook" | "tiktok" | "linkedin",
   "message": "string, max 140 chars, single sentence",
   "severity": "low" | "medium" | "high"
   }
3. Use at most ONE object per source.
4. Only create a line if there is a real, defensible gap:

   * GBP examples:

     * Much fewer reviews than competitors.
     * Rating clearly lower than competitors.
     * No photos, no hours, or missing website while others have them.
   * Instagram examples:

     * No posts in last 30 days.
     * Very few posts vs a healthy baseline.

5. If the business is doing fine on a source:

   * Either omit that source OR give a positive/neutral reassurance with severity "low".

6. Never invent competitor social data if it was not provided.
7. Never mention that you are an AI or reference JSON or "situation" in the messages.
8. Messages must be truthful, specific, and immediately understandable.`;

  const userMessage = JSON.stringify({ situation }, null, 2);

  console.log('[punchyGaps] Calling OpenAI', {
    hasApiKey: !!OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    gbpHasData: !!(situation.gbp.rating || situation.gbp.reviews),
    competitorsCount: situation.gbpCompetitors.length,
    instagramConnected: situation.instagram.connected,
  });

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
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[punchyGaps] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[punchyGaps] No content in OpenAI response');
      return [];
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON array in the content
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as PunchyLine[];

    // Validate structure
    if (!Array.isArray(parsed)) {
      console.error('[punchyGaps] Response is not an array', { parsed });
      return [];
    }

    // Validate and clean each line
    const validLines: PunchyLine[] = [];
    for (const line of parsed) {
      if (
        typeof line === 'object' &&
        line !== null &&
        ['gbp', 'instagram', 'facebook', 'tiktok', 'linkedin'].includes(line.source) &&
        typeof line.message === 'string' &&
        line.message.length > 0 &&
        line.message.length <= 140 &&
        ['low', 'medium', 'high'].includes(line.severity)
      ) {
        // Ensure message is a single sentence (no bullets, no line breaks)
        const cleanMessage = line.message
          .replace(/^[•\-\*]\s*/, '') // Remove leading bullets
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .trim();
        
        if (cleanMessage.length > 0 && cleanMessage.length <= 140) {
          validLines.push({
            source: line.source,
            message: cleanMessage,
            severity: line.severity,
          });
        }
      }
    }

    console.log('[punchyGaps] ✅ Generated punchy lines', {
      count: validLines.length,
      sources: validLines.map(l => l.source),
    });

    return validLines;
  } catch (error: any) {
    console.error('[punchyGaps] Error calling OpenAI', {
      error: error.message,
      stack: error.stack,
    });
    return [];
  }
}

