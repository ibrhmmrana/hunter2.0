/**
 * Simplified Instagram analysis for punchline generation.
 * 
 * This module is server-only.
 */

import { ApifyClient } from 'apify-client';
import { generateInstagramPunchline, type InstagramMetrics } from './instagramPunchline';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = 'shu8hvrXbJbY3Eb9W';

export type InstagramAnalysisResult = {
  metrics: InstagramMetrics;
  punchline: {
    punchline: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } | null;
  profile: any; // Full Apify profile data for snapshot storage
};

/**
 * Analyze Instagram profile and generate a punchline.
 * 
 * This is a simplified version that:
 * 1. Calls Apify to get profile data
 * 2. Extracts key metrics (followers, postsLast30, daysSinceLastPost)
 * 3. Generates a single punchline using OpenAI
 */
export async function analyzeInstagramForPunchline(
  instagramHandle: string,
  businessName: string,
  category: string | null
): Promise<InstagramAnalysisResult | null> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  const client = new ApifyClient({ token: APIFY_TOKEN });
  
  // 1. Sanitize handle: trim, remove @, remove trailing /
  let username = instagramHandle.replace(/^@/, '').trim();
  if (username.endsWith('/')) {
    username = username.slice(0, -1);
  }
  username = username.trim();
  
  const profileUrl = `https://www.instagram.com/${username}`; // No trailing slash

  console.log('[analyzeInstagramForPunchline] Starting Apify run', { handle: username, businessName });

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

  console.log('[analyzeInstagramForPunchline] Apify input', input);

  // 3. Run the actor
  const run = await client.actor(APIFY_ACTOR_ID).call(input);

  console.log('[analyzeInstagramForPunchline] Apify run completed', { runId: run.id, status: run.status });

  // 4. Wait for dataset
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  
  if (!dataset || !dataset.items || dataset.items.length === 0) {
    console.error('[analyzeInstagramForPunchline] No data returned from Apify');
    return null;
  }

  const items = dataset.items;

  // 5. Parse response - pick the first item as the profile
  const profile = items[0] as any | undefined;

  if (!profile) {
    console.error('[analyzeInstagramForPunchline] No profile data in response');
    return null;
  }

  // Combine all post types: latestPosts, latestIgtvVideos, latestReels, etc.
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

  console.log('[analyzeInstagramForPunchline] Profile data received', {
    username: profile.username,
    followersCount: profile.followersCount,
    hasLatestPosts: !!profile.latestPosts,
    latestPostsCount: Array.isArray(profile.latestPosts) ? profile.latestPosts.length : 0,
    hasLatestIgtvVideos: !!profile.latestIgtvVideos,
    latestIgtvVideosCount: Array.isArray(profile.latestIgtvVideos) ? profile.latestIgtvVideos.length : 0,
    totalPostsCombined: allPosts.length,
  });

  // 6. Extract key metrics
  const followersCount = profile.followersCount ?? 0;
  const latestPosts = allPosts; // Use combined posts
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // Helper to parse timestamp
  const parseTimestamp = (ts: any): number | null => {
    if (!ts) return null;
    if (typeof ts === 'number') {
      // If it's less than a year 2000 timestamp in seconds, assume it's in seconds
      return ts < 946684800000 ? ts * 1000 : ts;
    }
    if (typeof ts === 'string') {
      // Handle ISO format strings like "2022-07-22T19:23:13.000Z"
      const parsed = Date.parse(ts);
      if (!isNaN(parsed)) {
        return parsed;
      }
      // Try parsing as Unix timestamp string
      const num = parseInt(ts, 10);
      if (!isNaN(num)) {
        return num < 946684800000 ? num * 1000 : num;
      }
    }
    return null;
  };

  // Filter posts with valid timestamps
  const postsWithTimestamps = latestPosts
    .map((post: any) => {
      const ts = parseTimestamp(post.timestamp);
      if (ts === null) return null;
      return { 
        timestamp: ts,
        likesCount: post.likesCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
      };
    })
    .filter((p: any) => p !== null);

  // Count posts in last 30 days
  const postsLast30 = postsWithTimestamps.filter(
    (p: any) => p.timestamp >= thirtyDaysAgo
  ).length;

  // Find most recent post
  const mostRecentPost = postsWithTimestamps.length > 0
    ? postsWithTimestamps.reduce((latest: any, post: any) => 
        post.timestamp > latest.timestamp ? post : latest
      )
    : null;

  const daysSinceLastPost = mostRecentPost
    ? Math.floor((now - mostRecentPost.timestamp) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate engagement rate from last 10 posts (use postsWithTimestamps which has engagement data)
  const last10Posts = postsWithTimestamps.slice(0, 10);
  let engagementRate: number | null = null;
  if (last10Posts.length > 0 && followersCount > 0) {
    const totalEngagement = last10Posts.reduce((sum: number, post: any) => {
      const likes = post.likesCount ?? 0;
      const comments = post.commentsCount ?? 0;
      return sum + likes + comments;
    }, 0);
    const avgEngagement = totalEngagement / last10Posts.length;
    engagementRate = avgEngagement / followersCount; // Engagement rate as decimal (e.g., 0.0234 = 2.34%)
  }

  // Build metrics object
  const metrics: InstagramMetrics = {
    followers: followersCount,
    postsLast30,
    daysSinceLastPost,
  };

  console.log('[analyzeInstagramForPunchline] Extracted metrics', {
    ...metrics,
    engagementRate: engagementRate ? `${(engagementRate * 100).toFixed(2)}%` : null,
  });

  // 7. Generate punchline using OpenAI
  const punchline = await generateInstagramPunchline(businessName, category, metrics);

  if (!punchline) {
    console.warn('[analyzeInstagramForPunchline] Failed to generate punchline');
    // Return metrics even if punchline generation failed
    return {
      metrics,
      punchline: null,
      profile, // Return full profile for snapshot storage
    };
  }

  console.log('[analyzeInstagramForPunchline] ✅ Generated punchline', {
    punchline: punchline.punchline.substring(0, 50) + '...',
    severity: punchline.severity,
  });

  return {
    metrics,
    punchline,
    profile, // Return full profile for snapshot storage
  };
}

