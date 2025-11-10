import { MOCK_SOCIAL, type SocialChannel } from "./mock";

export interface SocialAggregates {
  totalFollowers: number;
  engagementRate: number;
  posts7d: number;
  streak: number;
}

export interface SocialBands {
  followersBand: "low" | "ok" | "good";
  engagementBand: "low" | "ok" | "good";
  postsBand: "low" | "ok" | "good";
  streakBand: "low" | "ok" | "good";
}

export interface SocialMicrocopy {
  followers: string;
  engagement: string;
  posts: string;
  streak: string;
}

/**
 * Aggregate social metrics from enabled channels
 */
export function aggregateSocial(
  channels: SocialChannel[] = MOCK_SOCIAL.channels
): SocialAggregates {
  const enabled = channels.filter((ch) => ch.on);

  const totalFollowers = enabled.reduce((sum, ch) => sum + (ch.followers || 0), 0);

  const engagementRate =
    enabled.length > 0
      ? enabled.reduce((sum, ch) => sum + (ch.engagement_rate || 0), 0) /
        enabled.length
      : 0;

  const posts7d = enabled.reduce((sum, ch) => sum + (ch.posts_7d || 0), 0);

  const streak = enabled.length > 0
    ? Math.max(...enabled.map((ch) => ch.streak_weeks || 0))
    : 0;

  return {
    totalFollowers,
    engagementRate,
    posts7d,
    streak,
  };
}

/**
 * Score social metrics into severity bands
 */
export function scoreSocial(agg: SocialAggregates): SocialBands {
  const followersBand =
    agg.totalFollowers < 1000
      ? "low"
      : agg.totalFollowers <= 5000
        ? "ok"
        : "good";

  const engagementBand =
    agg.engagementRate < 0.7
      ? "low"
      : agg.engagementRate <= 1.5
        ? "ok"
        : "good";

  const postsBand =
    agg.posts7d <= 1 ? "low" : agg.posts7d <= 3 ? "ok" : "good";

  const streakBand = agg.streak === 0 ? "low" : agg.streak <= 2 ? "ok" : "good";

  return {
    followersBand,
    engagementBand,
    postsBand,
    streakBand,
  };
}

/**
 * Generate microcopy based on severity bands
 */
export function socialMicrocopy(bands: SocialBands): SocialMicrocopy {
  return {
    followers:
      bands.followersBand === "low"
        ? "below local median"
        : bands.followersBand === "ok"
          ? "growing base"
          : "strong presence",
    engagement:
      bands.engagementBand === "low"
        ? "audience isn't reacting"
        : bands.engagementBand === "ok"
          ? "steady engagement"
          : "high engagement",
    posts:
      bands.postsBand === "low"
        ? "no posting cadence"
        : bands.postsBand === "ok"
          ? "regular posting"
          : "consistent cadence",
    streak:
      bands.streakBand === "low"
        ? "streak broken"
        : bands.streakBand === "ok"
          ? "building momentum"
          : "strong streak",
  };
}

