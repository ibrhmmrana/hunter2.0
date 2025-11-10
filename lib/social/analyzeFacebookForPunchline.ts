/**
 * Simplified Facebook analysis for punchline generation.
 * 
 * This module is server-only.
 */

import { ApifyClient } from 'apify-client';
import { generateFacebookPunchline, type FacebookMetrics } from './facebookPunchline';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = '4Hv5RhChiaDk6iwad'; // Profile info actor
const APIFY_POSTS_ACTOR_ID = 'KoJrdxJCTtpon81KY'; // Posts actor

export type FacebookAnalysisResult = {
  metrics: FacebookMetrics;
  punchline: {
    punchline: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } | null;
  rawData: any; // Full Apify item data for snapshot storage
  postsData: {
    posts: any[]; // Array of post items
    postsLast30Days: number | null;
    daysSinceLastPost: number | null;
    engagementRate: number | null;
  };
};

/**
 * Normalize Facebook page from various input formats.
 */
export function normalizeFacebookPage(raw: string): { handle: string; pageUrl: string } | null {
  if (!raw) return null;
  let input = raw.trim();

  // If it's not a URL, treat as slug
  if (!/^https?:\/\//i.test(input) && !input.includes("facebook.com")) {
    const slug = input.replace(/^@/, "").split(/[?#]/)[0].replace(/\/+$/, "");
    if (!slug) return null;
    return {
      handle: slug,
      pageUrl: `https://www.facebook.com/${slug}/`,
    };
  }

  // Normalize URL form
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);
    if (!url.hostname.includes("facebook.com")) return null;
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (!slug) return null;
    return {
      handle: slug,
      pageUrl: `https://www.facebook.com/${slug}/`,
    };
  } catch {
    return null;
  }
}

type FacebookApifyItem = {
  facebookUrl?: string;
  pageUrl?: string;
  pageName?: string;
  pageId?: string;
  title?: string;
  likes?: number;
  followers?: number;
  followings?: number;
  ratingOverall?: number;
  ratingCount?: number;
  rating?: string;
  ratings?: string;
  business_hours?: string;
  website?: string;
  websites?: string[];
  phone?: string;
  email?: string;
  category?: string;
  categories?: string[];
  intro?: string;
  address?: string;
  whatsapp_number?: string;
  wa_number?: string;
  wa_link?: string;
  messenger?: string | null;
  profilePictureUrl?: string;
  coverPhotoUrl?: string;
  instagram?: Array<{ username?: string; url?: string }>;
  [key: string]: any; // Allow other fields
};

/**
 * Analyze Facebook page and generate a punchline.
 */
export async function analyzeFacebookForPunchline(
  facebookInput: string,
  businessId: string,
  businessName: string,
  category: string | null
): Promise<FacebookAnalysisResult | null> {
  if (!APIFY_TOKEN) {
    console.error('[analyzeFacebookForPunchline] APIFY_TOKEN not configured');
    return null;
  }

  const client = new ApifyClient({ token: APIFY_TOKEN });

  // Normalize input
  const normalized = normalizeFacebookPage(facebookInput);
  if (!normalized) {
    console.warn('[analyzeFacebookForPunchline] Invalid Facebook input', {
      businessId,
      rawInput: facebookInput,
    });
    return null;
  }

  const { handle, pageUrl } = normalized;

  console.log('[analyzeFacebookForPunchline] Starting Apify run', { handle, pageUrl, businessName });

  // Build Apify input
  const input = {
    startUrls: [{ url: pageUrl }],
  };

  console.log('[analyzeFacebookForPunchline] Apify input', input);

  // Run the actor
  const run = await client.actor(APIFY_ACTOR_ID).call(input);

  console.log('[analyzeFacebookForPunchline] Apify run completed', { runId: run.id, status: run.status });

  // Wait for dataset
  const dataset = await client.dataset(run.defaultDatasetId).listItems();

  if (!dataset || !dataset.items || dataset.items.length === 0) {
    console.error('[analyzeFacebookForPunchline] No data returned from Apify');
    return null;
  }

  const items = dataset.items;

  console.log('[analyzeFacebookForPunchline] Apify response received', {
    itemsCount: items.length,
    firstItemKeys: items.length > 0 ? Object.keys(items[0]) : [],
  });

  // Parse response - take first item
  const item = items[0] as FacebookApifyItem;

  if (!item) {
    console.error('[analyzeFacebookForPunchline] No item data in response');
    return null;
  }

  // Extract page URL (could be pageUrl or facebookUrl)
  const finalPageUrl = item.pageUrl || item.facebookUrl || pageUrl;
  // Extract page name (could be pageName or title)
  const finalPageName = item.pageName || item.title || null;
  // Extract category (could be category string or first item in categories array)
  const finalCategory = item.category || (Array.isArray(item.categories) && item.categories.length > 0 ? item.categories[0] : null) || null;

  console.log('[analyzeFacebookForPunchline] Profile data received', {
    pageUrl: finalPageUrl,
    pageName: finalPageName,
    category: finalCategory,
    likes: item.likes,
    followers: item.followers,
    ratingOverall: item.ratingOverall,
    ratingCount: item.ratingCount,
    hasBusinessHours: !!item.business_hours,
    hasWebsite: !!(item.website || (Array.isArray(item.websites) && item.websites.length > 0)),
    hasPhone: !!item.phone,
    hasEmail: !!item.email,
  });

  // Build metrics object
  const metrics: FacebookMetrics = {
    pageUrl: finalPageUrl,
    pageName: finalPageName,
    category: finalCategory,
    likes: item.likes ?? null,
    followers: item.followers ?? null,
    ratingOverall: item.ratingOverall ?? null,
    ratingCount: item.ratingCount ?? null,
    hasBusinessHours: Boolean(item.business_hours && item.business_hours.trim().length && item.business_hours.toLowerCase() !== 'closed now'),
    businessHours: item.business_hours ?? null,
    hasWebsite: Boolean(
      item.website || (Array.isArray(item.websites) && item.websites.length > 0)
    ),
    hasPhone: Boolean(item.phone),
    hasEmail: Boolean(item.email),
    intro: item.intro ?? null,
  };

  console.log('[facebook_analyze:summary]', {
    tag: 'facebook_analyze:summary',
    businessId,
    handle,
    summary: {
      likes: metrics.likes,
      followers: metrics.followers,
      ratingOverall: metrics.ratingOverall,
      ratingCount: metrics.ratingCount,
      hasBusinessHours: metrics.hasBusinessHours,
      hasWebsite: metrics.hasWebsite,
      hasPhone: metrics.hasPhone,
      hasEmail: metrics.hasEmail,
    },
  });

  // 2. Fetch posts data using second actor (REQUIRED for Facebook)
  // For Facebook, we need both profile and posts data before showing metrics
  let postsData = {
    posts: [] as any[],
    postsLast30Days: null as number | null,
    daysSinceLastPost: null as number | null,
    engagementRate: null as number | null,
  };

  let postsFetchSuccess = false;

  try {
    console.log('[analyzeFacebookForPunchline] Starting posts fetch (required)', { pageUrl: finalPageUrl });

    const postsInput = {
      startUrls: [{ url: finalPageUrl }],
      resultsLimit: 10,
      captionText: false,
    };

    const postsRun = await client.actor(APIFY_POSTS_ACTOR_ID).call(postsInput);
    console.log('[analyzeFacebookForPunchline] Posts run completed', { runId: postsRun.id, status: postsRun.status });

    const postsDataset = await client.dataset(postsRun.defaultDatasetId).listItems();

    if (postsDataset && postsDataset.items && postsDataset.items.length > 0) {
      const posts = postsDataset.items;
      postsData.posts = posts;

      console.log('[analyzeFacebookForPunchline] Posts data received', {
        postsCount: posts.length,
        firstPostKeys: posts.length > 0 ? Object.keys(posts[0]) : [],
      });

      // Parse posts and calculate metrics
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      // Helper to parse timestamp from post
      const parsePostTimestamp = (post: any): number | null => {
        // Try to extract timestamp from post - Facebook posts API returns 'timestamp' or 'time'
        // Check post-level timestamp first (Unix timestamp in seconds)
        if (post.timestamp) {
          const ts = typeof post.timestamp === 'number'
            ? (post.timestamp < 946684800000 ? post.timestamp * 1000 : post.timestamp)
            : null;
          if (ts) return ts;
        }
        
        // Check post-level time (ISO string)
        if (post.time) {
          const parsed = Date.parse(post.time);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
        
        // Check if media has publish_time (videos often have this at the media level)
        if (post.media && Array.isArray(post.media) && post.media.length > 0) {
          // Collect all timestamps from media items
          const timestamps: number[] = [];
          for (const media of post.media) {
            if (media.publish_time) {
              const ts = typeof media.publish_time === 'number'
                ? (media.publish_time < 946684800000 ? media.publish_time * 1000 : media.publish_time)
                : null;
              if (ts) timestamps.push(ts);
            }
            // Also check nested video objects
            if (media.video && media.video.publish_time) {
              const ts = typeof media.video.publish_time === 'number'
                ? (media.video.publish_time < 946684800000 ? media.video.publish_time * 1000 : media.video.publish_time)
                : null;
              if (ts) timestamps.push(ts);
            }
          }
          // Return the most recent timestamp (highest value)
          if (timestamps.length > 0) {
            return Math.max(...timestamps);
          }
        }
        
        return null;
      };

      // Process posts with timestamps
      const postsWithTimestamps = posts.map((post: any, index: number) => {
        // Try to get actual timestamp from post.timestamp or post.time
        let timestamp = parsePostTimestamp(post);
        
        // If no timestamp found, estimate based on order (fallback)
        if (!timestamp) {
          console.warn(`[analyzeFacebookForPunchline] Post ${index} has no valid timestamp, estimating`, {
            hasTimestamp: !!post.timestamp,
            hasTime: !!post.time,
            postId: post.postId,
          });
          // Estimate: most recent post is "now", older posts are progressively older
          timestamp = now - (index * 24 * 60 * 60 * 1000); // Assume 1 day between posts
        }

        // Extract engagement metrics from post
        const likes = post.likes ?? 0;
        const comments = post.comments ?? 0; // May not exist in response
        const shares = post.shares ?? 0;
        const views = post.viewsCount ?? 0; // For videos
        const totalEngagement = likes + comments + shares;

        return {
          timestamp,
          likes,
          comments,
          shares,
          views,
          totalEngagement,
          isVideo: post.isVideo ?? false,
        };
      }).sort((a: any, b: any) => b.timestamp - a.timestamp); // Most recent first

      console.log('[analyzeFacebookForPunchline] Processed posts with timestamps', {
        totalPosts: postsWithTimestamps.length,
        postsWithValidTimestamps: postsWithTimestamps.filter(p => p.timestamp > 0).length,
        samplePost: postsWithTimestamps.length > 0 ? {
          timestamp: new Date(postsWithTimestamps[0].timestamp).toISOString(),
          likes: postsWithTimestamps[0].likes,
          shares: postsWithTimestamps[0].shares,
          views: postsWithTimestamps[0].views,
        } : null,
      });

      // Count posts in last 30 days
      postsData.postsLast30Days = postsWithTimestamps.filter(
        (p: any) => p.timestamp >= thirtyDaysAgo
      ).length;

      // Find most recent post
      const mostRecentPost = postsWithTimestamps.length > 0 ? postsWithTimestamps[0] : null;
      if (mostRecentPost) {
        postsData.daysSinceLastPost = Math.floor((now - mostRecentPost.timestamp) / (1000 * 60 * 60 * 24));
      }

      // Calculate engagement rate from all posts
      // Engagement rate = (total engagement) / (number of posts * followers)
      if (postsWithTimestamps.length > 0 && metrics.followers && metrics.followers > 0) {
        const totalEngagement = postsWithTimestamps.reduce((sum: number, p: any) => sum + p.totalEngagement, 0);
        const avgEngagementPerPost = totalEngagement / postsWithTimestamps.length;
        // Engagement rate as percentage: (avg engagement per post) / followers
        postsData.engagementRate = avgEngagementPerPost / metrics.followers;
      }

      postsFetchSuccess = true;

      console.log('[analyzeFacebookForPunchline] Posts metrics calculated', {
        postsLast30Days: postsData.postsLast30Days,
        daysSinceLastPost: postsData.daysSinceLastPost,
        engagementRate: postsData.engagementRate,
        totalPosts: posts.length,
      });
    } else {
      console.warn('[analyzeFacebookForPunchline] No posts data returned from Apify');
      // Don't mark as success if no posts data
    }
  } catch (error: any) {
    console.error('[analyzeFacebookForPunchline] Failed to fetch posts', {
      error: error?.message,
      stack: error?.stack,
    });
    // Don't mark as success if posts fetch failed
  }

  // For Facebook, require both API calls to succeed before proceeding
  if (!postsFetchSuccess) {
    console.error('[analyzeFacebookForPunchline] Posts fetch failed or returned no data - cannot proceed without both API calls');
    console.log('[analyzeFacebookForPunchline] Profile data fetched successfully, but posts data is required. Returning null.');
    return null; // Return null to indicate incomplete analysis
  }

  console.log('[analyzeFacebookForPunchline] ✅ Both API calls completed successfully', {
    profileData: {
      followers: metrics.followers,
      likes: metrics.likes,
    },
    postsData: {
      postsCount: postsData.posts.length,
      postsLast30Days: postsData.postsLast30Days,
      daysSinceLastPost: postsData.daysSinceLastPost,
      engagementRate: postsData.engagementRate,
    },
  });

  // Generate punchline using OpenAI
  const punchline = await generateFacebookPunchline(metrics);

  if (punchline) {
    console.log('[facebook_analyze:openai_output]', {
      tag: 'facebook_analyze:openai_output',
      businessId,
      handle,
      result: {
        punchline: punchline.punchline.substring(0, 50) + '...',
        severity: punchline.severity,
      },
    });
  }

  if (!punchline) {
    console.warn('[analyzeFacebookForPunchline] Failed to generate punchline');
    // Return metrics even if punchline generation failed
    return {
      metrics,
      punchline: null,
      rawData: item,
      postsData,
    };
  }

  console.log('[analyzeFacebookForPunchline] ✅ Generated punchline', {
    punchline: punchline.punchline.substring(0, 50) + '...',
    severity: punchline.severity,
  });

  return {
    metrics,
    punchline: {
      punchline: punchline.punchline,
      severity: punchline.severity,
    },
    rawData: item,
    postsData,
  };
}

