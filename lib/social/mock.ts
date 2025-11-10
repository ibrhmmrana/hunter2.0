export interface SocialChannel {
  key: string;
  name: string;
  on: boolean;
  followers: number;
  engagement_rate: number;
  posts_7d: number;
  streak_weeks: number;
}

export const MOCK_SOCIAL = {
  channels: [
    {
      key: "instagram",
      name: "Instagram",
      on: true,
      followers: 280,
      engagement_rate: 0.35,
      posts_7d: 0,
      streak_weeks: 0,
    },
    {
      key: "facebook",
      name: "Facebook",
      on: true,
      followers: 340,
      engagement_rate: 0.22,
      posts_7d: 1,
      streak_weeks: 0,
    },
    {
      key: "youtube",
      name: "YouTube",
      on: true,
      followers: 95,
      engagement_rate: 0.18,
      posts_7d: 0,
      streak_weeks: 0,
    },
    {
      key: "tiktok",
      name: "TikTok",
      on: false,
      followers: 0,
      engagement_rate: 0,
      posts_7d: 0,
      streak_weeks: 0,
    },
    {
      key: "x",
      name: "X (Twitter)",
      on: false,
      followers: 0,
      engagement_rate: 0,
      posts_7d: 0,
      streak_weeks: 0,
    },
    {
      key: "linkedin",
      name: "LinkedIn",
      on: false,
      followers: 0,
      engagement_rate: 0,
      posts_7d: 0,
      streak_weeks: 0,
    },
  ] as SocialChannel[],
};

