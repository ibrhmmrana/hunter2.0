/**
 * Simplified TikTok analysis for punchline generation.
 * 
 * This module is server-only.
 */

import { ApifyClient } from 'apify-client';
import { generateTikTokPunchline, type TikTokMetrics } from './tiktokPunchline';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = 'GdWCkxBtKWOsKjdch';

export type TikTokAnalysisResult = {
  metrics: TikTokMetrics;
  punchline: {
    punchline: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } | null;
  rawData: {
    authorMeta: any;
    videos: any[];
  }; // Full Apify data for snapshot storage
};

/**
 * Normalize TikTok handle from various input formats.
 */
function normalizeTikTokHandle(input: string): string {
  let handle = input.trim();

  // Extract handle from URL if present
  const urlMatch = handle.match(/tiktok\.com\/@?([^\/\?]+)/i);
  if (urlMatch) {
    handle = urlMatch[1];
  }

  // Remove leading @
  if (handle.startsWith('@')) {
    handle = handle.slice(1);
  }

  // Remove trailing slash
  if (handle.endsWith('/')) {
    handle = handle.slice(0, -1);
  }

  return handle.trim();
}

/**
 * Analyze TikTok profile and generate a punchline.
 */
export async function analyzeTikTokForPunchline(
  tiktokHandle: string,
  businessId: string,
  businessName: string,
  category: string | null
): Promise<TikTokAnalysisResult | null> {
  if (!APIFY_TOKEN) {
    console.error('[analyzeTikTokForPunchline] APIFY_TOKEN not configured');
    return null;
  }

  const client = new ApifyClient({ token: APIFY_TOKEN });
  
  // 1. Normalize handle
  const handle = normalizeTikTokHandle(tiktokHandle);

  console.log('[analyzeTikTokForPunchline] Starting Apify run', { handle, businessName });

  // 2. Build the exact payload required
  const input = {
    excludePinnedPosts: true,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    profiles: [handle],
    proxyCountryCode: "None",
    resultsPerPage: 10,
    scrapeRelatedVideos: false,
    shouldDownloadAvatars: false,
    shouldDownloadCovers: false,
    shouldDownloadMusicCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadSubtitles: false,
    shouldDownloadVideos: false,
    searchSection: "",
    maxProfilesPerQuery: 10,
  };

  console.log('[analyzeTikTokForPunchline] Apify input', input);

  // 3. Run the actor
  const run = await client.actor(APIFY_ACTOR_ID).call(input);

  console.log('[analyzeTikTokForPunchline] Apify run completed', { runId: run.id, status: run.status });

  // 4. Wait for dataset
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  
  if (!dataset || !dataset.items || dataset.items.length === 0) {
    console.error('[analyzeTikTokForPunchline] No data returned from Apify');
    return null;
  }

  const items = dataset.items;

  // 5. Parse response - find profile and videos
  // Apify returns items that are videos, each with authorMeta embedded
  // Extract profile info from first video's authorMeta, and collect all videos
  const videos: any[] = [];
  let authorMeta: any = null;

  for (const item of items) {
    // Each item is typically a video with authorMeta
    if (item.authorMeta) {
      // Use first video's authorMeta as profile data
      if (!authorMeta) {
        authorMeta = item.authorMeta;
      }
      // Collect as video
      videos.push(item);
    } else if (item.createTime || item.createTimeISO) {
      // Video without authorMeta (shouldn't happen, but handle it)
      videos.push(item);
    }
  }

  // If we still don't have authorMeta, try to get it from first item
  if (!authorMeta && items.length > 0 && items[0].authorMeta) {
    authorMeta = items[0].authorMeta;
  }

  if (!authorMeta) {
    console.error('[analyzeTikTokForPunchline] No authorMeta/profile data in response', {
      itemsCount: items.length,
      firstItemKeys: items.length > 0 ? Object.keys(items[0]) : [],
    });
    return null;
  }

  // Extract handle from authorMeta (could be name, uniqueId, or nickName)
  const profileHandle = authorMeta.name || authorMeta.uniqueId || authorMeta.nickName || handle;

  console.log('[analyzeTikTokForPunchline] Profile data received', {
    handle: profileHandle,
    followers: authorMeta.fans,
    totalVideos: authorMeta.video,
    videosCount: videos.length,
    authorMetaKeys: Object.keys(authorMeta),
  });

  // 6. Extract key metrics
  const followers = authorMeta.fans ?? 0;
  const totalVideos = authorMeta.video ?? 0;

  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // Helper to parse timestamp
  const parseTimestamp = (ts: any): number | null => {
    if (!ts) return null;
    if (typeof ts === 'number') {
      // TikTok timestamps are often in seconds
      return ts < 946684800000 ? ts * 1000 : ts;
    }
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Process videos
  const videosWithTimestamps = videos
    .map((video: any, index: number) => {
      // Try multiple timestamp fields (createTime is Unix timestamp in seconds)
      const ts = parseTimestamp(
        video.createTime || 
        video.createTimeISO || 
        video.createdAt || 
        video.timestamp ||
        video.videoMeta?.createTime
      );
      
      if (ts === null) {
        console.warn(`[analyzeTikTokForPunchline] Video ${index} has no valid timestamp`, {
          hasCreateTime: !!video.createTime,
          hasCreateTimeISO: !!video.createTimeISO,
          videoKeys: Object.keys(video),
        });
        return null;
      }
      
      // Extract video metrics (fields may vary)
      const views = video.playCount || video.viewCount || video.stats?.playCount || video.stats?.viewCount || video.play || 0;
      const likes = video.diggCount || video.likeCount || video.stats?.diggCount || video.stats?.likeCount || video.digg || video.heartCount || 0;
      const comments = video.commentCount || video.stats?.commentCount || video.comment || 0;
      const shares = video.shareCount || video.stats?.shareCount || video.share || 0;
      
      return {
        timestamp: ts,
        views,
        likes,
        comments,
        shares,
        text: (video.text || video.description || video.desc || '').toLowerCase(),
      };
    })
    .filter((v: any) => v !== null)
    .sort((a: any, b: any) => b.timestamp - a.timestamp); // Most recent first

  console.log('[analyzeTikTokForPunchline] Processed videos', {
    totalVideos: videos.length,
    videosWithTimestamps: videosWithTimestamps.length,
    sampleVideo: videosWithTimestamps.length > 0 ? {
      timestamp: new Date(videosWithTimestamps[0].timestamp).toISOString(),
      views: videosWithTimestamps[0].views,
      likes: videosWithTimestamps[0].likes,
    } : null,
  });

  // Count posts in last 30 days
  const postsLast30Days = videosWithTimestamps.filter(
    (v: any) => v.timestamp >= thirtyDaysAgo
  ).length;

  // Find most recent post
  const mostRecentPost = videosWithTimestamps.length > 0 ? videosWithTimestamps[0] : null;
  const lastPostAt = mostRecentPost
    ? new Date(mostRecentPost.timestamp).toISOString()
    : null;
  const daysSinceLastPost = mostRecentPost
    ? Math.floor((now - mostRecentPost.timestamp) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate metrics from last 10 videos
  const last10Videos = videosWithTimestamps.slice(0, 10);
  const avgViewsLast10 = last10Videos.length > 0
    ? Math.round(last10Videos.reduce((sum: number, v: any) => sum + v.views, 0) / last10Videos.length)
    : null;
  const medianViewsLast10 = last10Videos.length > 0
    ? (() => {
        const sorted = [...last10Videos].sort((a: any, b: any) => a.views - b.views);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1].views + sorted[mid].views) / 2)
          : Math.round(sorted[mid].views);
      })()
    : null;
  const avgLikesLast10 = last10Videos.length > 0
    ? Math.round(last10Videos.reduce((sum: number, v: any) => sum + v.likes, 0) / last10Videos.length)
    : null;
  const avgCommentsLast10 = last10Videos.length > 0
    ? Math.round(last10Videos.reduce((sum: number, v: any) => sum + v.comments, 0) / last10Videos.length)
    : null;

  // Calculate promo post percentage (rough heuristic)
  const promoKeywords = ['price', 'booking', 'order', 'menu', 'link in bio', 'phone', 'whatsapp', 'call', 'buy', 'shop', 'sale', 'discount'];
  const promoPosts = last10Videos.filter((v: any) =>
    promoKeywords.some(keyword => v.text.includes(keyword))
  ).length;
  const percentPromoPostsLast10 = last10Videos.length > 0
    ? Math.round((promoPosts / last10Videos.length) * 100)
    : 0;

  // Calculate engagement quality
  let engagementQuality: 'strong' | 'ok' | 'weak' = 'ok';
  if (last10Videos.length > 0 && avgViewsLast10 && avgViewsLast10 > 0) {
    const avgEngagement = (avgLikesLast10 || 0) + (avgCommentsLast10 || 0);
    const engagementRate = avgEngagement / avgViewsLast10;
    if (engagementRate > 0.05) {
      engagementQuality = 'strong';
    } else if (engagementRate < 0.01) {
      engagementQuality = 'weak';
    }
  }

  // Build metrics object
  const metrics: TikTokMetrics = {
    network: 'tiktok',
    handle: profileHandle, // Use the handle from authorMeta
    followers,
    totalVideos,
    lastPostAt,
    daysSinceLastPost,
    postsLast30Days,
    avgViewsLast10,
    medianViewsLast10,
    avgLikesLast10,
    avgCommentsLast10,
    percentPromoPostsLast10,
    engagementQuality,
  };

  console.log('[tiktok_analyze:summary]', {
    tag: 'tiktok_analyze:summary',
    businessId,
    handle,
    summary: {
      followers,
      totalVideos,
      postsLast30Days,
      daysSinceLastPost,
      avgViewsLast10,
      avgLikesLast10,
    },
  });

  // 7. Generate punchline using OpenAI
  const punchline = await generateTikTokPunchline(metrics);

  if (punchline) {
    console.log('[tiktok_analyze:openai_output]', {
      tag: 'tiktok_analyze:openai_output',
      businessId,
      handle,
      result: {
        punchline: punchline.punchline.substring(0, 50) + '...',
        severity: punchline.severity,
      },
    });
  }

  if (!punchline) {
    console.warn('[analyzeTikTokForPunchline] Failed to generate punchline');
    // Return metrics even if punchline generation failed
    return {
      metrics,
      punchline: null,
      rawData: {
        authorMeta,
        videos,
      },
    };
  }

  console.log('[analyzeTikTokForPunchline] ✅ Generated punchline', {
    punchline: punchline.punchline.substring(0, 50) + '...',
    severity: punchline.severity,
  });

  return {
    metrics,
    punchline: {
      punchline: punchline.punchline,
      severity: punchline.severity,
    },
    rawData: {
      authorMeta,
      videos,
    },
  };
}

