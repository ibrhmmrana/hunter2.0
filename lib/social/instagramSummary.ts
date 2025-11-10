/**
 * Extract compact Instagram summary from Apify response.
 * 
 * This module is server-only.
 */

export type InstagramSummary = {
  hasProfile: boolean;
  followers: number | null;
  postsLast30Days: number;
  daysSinceLastPost: number | null; // null if no posts
  avgLikesLast10: number | null;
  avgCommentsLast10: number | null;
};

/**
 * Extract Instagram summary from Apify profile response.
 */
export function extractInstagramSummary(profile: any): InstagramSummary {
  if (!profile) {
    return {
      hasProfile: false,
      followers: null,
      postsLast30Days: 0,
      daysSinceLastPost: null,
      avgLikesLast10: null,
      avgCommentsLast10: null,
    };
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
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? null : parsed;
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
  const postsLast30Days = postsWithTimestamps.filter(
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

  // Calculate averages from last 10 posts
  const last10Posts = postsWithTimestamps.slice(0, 10);
  const avgLikesLast10 = last10Posts.length > 0
    ? last10Posts.reduce((sum: number, p: any) => sum + p.likesCount, 0) / last10Posts.length
    : null;
  const avgCommentsLast10 = last10Posts.length > 0
    ? last10Posts.reduce((sum: number, p: any) => sum + p.commentsCount, 0) / last10Posts.length
    : null;

  return {
    hasProfile: true,
    followers: profile.followersCount ?? null,
    postsLast30Days,
    daysSinceLastPost,
    avgLikesLast10: avgLikesLast10 !== null ? Math.round(avgLikesLast10) : null,
    avgCommentsLast10: avgCommentsLast10 !== null ? Math.round(avgCommentsLast10) : null,
  };
}

