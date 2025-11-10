/**
 * Instagram analysis service using Apify + OpenAI.
 * 
 * This module is server-only and should never be imported in client components.
 */

import { ApifyClient } from 'apify-client';
import { extractInstagramSummary, type InstagramSummary } from './instagramSummary';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = 'shu8hvrXbJbY3Eb9W';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type InstagramAnalysisInput = {
  username: string | null;
  followersCount: number | null;
  postsCount: number | null;
  biography: string | null;
  externalUrl: string | null;
  latestPosts: {
    timestamp: string; // ISO
    likesCount: number | null;
    commentsCount: number | null;
    caption: string | null;
    isVideo: boolean;
    videoViewCount: number | null;
  }[];
};

export type InstagramAnalysisResult = {
  network: 'instagram';
  headline: string;
  score: {
    posting_consistency: number;
    profile_clarity: number;
    content_to_offer: number;
    engagement_effectiveness: number;
    cta_usage: number;
    responsiveness: number;
  };
  bullets: string[];
};

/**
 * Analyze Instagram profile and posts to generate insights using AI.
 */
export async function analyzeInstagramForBusiness(
  instagramHandle: string,
  businessId: string,
  businessContext?: {
    category?: string | null;
    city?: string | null;
  }
): Promise<{ analysis: InstagramAnalysisResult | null; summary: InstagramSummary } | null> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const client = new ApifyClient({ token: APIFY_TOKEN });
  
  // 1. Sanitize handle: trim, remove @, remove trailing /
  let cleanHandle = instagramHandle.trim();
  if (cleanHandle.startsWith('@')) {
    cleanHandle = cleanHandle.slice(1);
  }
  if (cleanHandle.endsWith('/')) {
    cleanHandle = cleanHandle.slice(0, -1);
  }
  cleanHandle = cleanHandle.trim();
  
  const profileUrl = `https://www.instagram.com/${cleanHandle}`; // No trailing slash

  console.log('[instagram] Starting Apify run', { handle: cleanHandle, businessId });

  // 2. Build the exact payload required
  const input = {
    addParentData: false,
    directUrls: [profileUrl],
    enhanceUserSearchWithFacebookPage: false,
    isUserReelFeedURL: false,
    isUserTaggedFeedURL: false,
    resultsLimit: 20,
    resultsType: 'details',
    searchLimit: 1,
    searchType: 'hashtag',
  };

  console.log('[instagram] apify input', input);

  // Run the actor
  const run = await client.actor(APIFY_ACTOR_ID).call(input);

  console.log('[instagram] Apify run completed', { runId: run.id, status: run.status });

  // Wait for dataset
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  
  if (!dataset || !dataset.items || dataset.items.length === 0) {
    throw new Error('No data returned from Apify');
  }

  const items = dataset.items;

  // 3. Parse response as full profile (details response returns profile object with latestPosts)
  const profile = items[0] as any | undefined;

  if (!profile) {
    console.error('[instagram] No profile data in response');
    return null;
  }

  // Extract summary for punchline generation
  const summary = extractInstagramSummary(profile);
  console.log('[instagram] extracted summary', summary);

  // 4. Build minimal analysis input
  const analysisInput = buildAnalysisInput(profile);

  if (!analysisInput) {
    console.error('[instagram] Failed to build analysis input from profile');
    return null;
  }

  console.log('[instagram] analysisInput', {
    username: analysisInput.username,
    followersCount: analysisInput.followersCount,
    postsCount: analysisInput.postsCount,
    postsSample: analysisInput.latestPosts.length,
  });

  // 5. Call OpenAI with strict system prompt
  const aiResult = await callOpenAIForAnalysis(analysisInput);

  if (!aiResult) {
    console.error('[instagram] OpenAI analysis failed');
    return null;
  }

  return {
    analysis: aiResult,
    summary,
  };
}

/**
 * Build minimal analysis input from Apify profile response.
 */
function buildAnalysisInput(profile: any): InstagramAnalysisInput | null {
  try {
    const latestPosts = (profile.latestPosts || []).slice(0, 20);
    
    // Helper to parse timestamp to ISO string
    const parseTimestamp = (ts: any): string | null => {
      if (!ts) return null;
      if (typeof ts === 'number') {
        // If it's less than a year 2000 timestamp in seconds, assume it's in seconds
        const ms = ts < 946684800000 ? ts * 1000 : ts;
        return new Date(ms).toISOString();
      }
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        if (isNaN(parsed)) return null;
        return new Date(parsed).toISOString();
      }
      return null;
    };

    // Helper to determine if post is video
    const isVideo = (post: any): boolean => {
      return post.type === 'Video' || 
             post.type === 'Reel' || 
             post.type === 'Clip' ||
             post.isVideo === true ||
             (post.videoUrl && post.videoUrl.length > 0);
    };

    // Build posts array
    const posts = latestPosts.map((post: any) => ({
      timestamp: parseTimestamp(post.timestamp) || new Date().toISOString(),
      likesCount: post.likesCount ?? null,
      commentsCount: post.commentsCount ?? null,
      caption: post.caption ? post.caption.substring(0, 200) : null,
      isVideo: isVideo(post),
      videoViewCount: post.videoViewCount ?? null,
    }));

    // Truncate biography
    const biography = profile.biography 
      ? profile.biography.substring(0, 300)
      : null;

    // Get external URL (prefer externalUrl, fallback to externalUrls array)
    const externalUrl = profile.externalUrl || 
      (profile.externalUrls && profile.externalUrls.length > 0 ? profile.externalUrls[0] : null) ||
      null;

    return {
      username: profile.username || null,
      followersCount: profile.followersCount ?? null,
      postsCount: profile.postsCount ?? null,
      biography,
      externalUrl,
      latestPosts: posts,
    };
  } catch (error: any) {
    console.error('[instagram] Error building analysis input', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Call OpenAI to analyze Instagram profile.
 */
async function callOpenAIForAnalysis(
  analysisInput: InstagramAnalysisInput
): Promise<InstagramAnalysisResult | null> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = `You are an assistant that diagnoses a local business's Instagram presence for growth, discovery, and trust.

You receive a compact JSON summary of:

* basic profile info,
* recent posts (counts, timestamps, likes, comments, captions),
  and nothing else.

Your job:

1. Evaluate how effective this profile is at helping real customers discover, understand, and trust the business.
2. Focus ONLY on:

   * Posting consistency
   * Profile clarity (what they do, where they are, how to contact)
   * Content-to-offer focus (do posts clearly show what they sell?)
   * Engagement effectiveness (for their size)
   * Call-to-action usage
   * Responsiveness (only if signals exist)

3. Be concrete, sharp, and commercially useful.

Output MUST be a single JSON object with EXACTLY this shape, no extra keys, no prose, no markdown:

{
  "network": "instagram",
  "headline": "string, max 90 characters",
  "score": {
    "posting_consistency": number,   // 0-100
    "profile_clarity": number,       // 0-100
    "content_to_offer": number,      // 0-100
    "engagement_effectiveness": number, // 0-100
    "cta_usage": number,             // 0-100
    "responsiveness": number         // 0-100 (use 50 if insufficient data)
  },
  "bullets": [
    "short, punchy insight, max 80 chars",
    "short, punchy insight, max 80 chars",
    "short, punchy quick-win action, max 80 chars"
  ]
}

Rules:

* All scores must be integers 0-100.
* "bullets" must be directly actionable or diagnostic, no fluff.
* If data is missing for an aspect, infer cautiously and keep scores moderate (40-60).
* Never mention that you are an AI or that data came from Apify.
* Do not include any explanation outside the JSON.`;

  const userMessage = JSON.stringify({ profile: analysisInput }, null, 2);

  console.log('[instagram] Calling OpenAI for analysis', {
    hasApiKey: !!OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    inputUsername: analysisInput.username,
    postsCount: analysisInput.latestPosts.length,
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
        temperature: 0.3, // Lower temperature for more consistent structured output
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[instagram] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('[instagram] No content in OpenAI response');
      return null;
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON object in the content
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned) as InstagramAnalysisResult;

    // Validate structure
    if (
      parsed.network === 'instagram' &&
      typeof parsed.headline === 'string' &&
      typeof parsed.score === 'object' &&
      Array.isArray(parsed.bullets) &&
      typeof parsed.score.posting_consistency === 'number' &&
      typeof parsed.score.profile_clarity === 'number' &&
      typeof parsed.score.content_to_offer === 'number' &&
      typeof parsed.score.engagement_effectiveness === 'number' &&
      typeof parsed.score.cta_usage === 'number' &&
      typeof parsed.score.responsiveness === 'number'
    ) {
      // Ensure scores are integers 0-100
      parsed.score.posting_consistency = Math.round(Math.max(0, Math.min(100, parsed.score.posting_consistency)));
      parsed.score.profile_clarity = Math.round(Math.max(0, Math.min(100, parsed.score.profile_clarity)));
      parsed.score.content_to_offer = Math.round(Math.max(0, Math.min(100, parsed.score.content_to_offer)));
      parsed.score.engagement_effectiveness = Math.round(Math.max(0, Math.min(100, parsed.score.engagement_effectiveness)));
      parsed.score.cta_usage = Math.round(Math.max(0, Math.min(100, parsed.score.cta_usage)));
      parsed.score.responsiveness = Math.round(Math.max(0, Math.min(100, parsed.score.responsiveness)));

      // Ensure bullets are max 80 chars
      parsed.bullets = parsed.bullets
        .slice(0, 3)
        .map(bullet => bullet.length > 80 ? bullet.substring(0, 77) + '...' : bullet);

      // Ensure headline is max 90 chars
      if (parsed.headline.length > 90) {
        parsed.headline = parsed.headline.substring(0, 87) + '...';
      }

      console.log('[instagram] ✅ OpenAI analysis complete', {
        headline: parsed.headline,
        bulletsCount: parsed.bullets.length,
        scores: parsed.score,
      });

      return parsed;
    } else {
      console.error('[instagram] Invalid structure in OpenAI response', { parsed });
      return null;
    }
  } catch (error: any) {
    console.error('[instagram] Error calling OpenAI', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}
