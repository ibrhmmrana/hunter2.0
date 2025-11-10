/**
 * Build creator matches for a business.
 * 
 * Returns deterministic mocked data based on business details.
 * Safe for local dev - no external API calls.
 */

export type CreatorMatch = {
  id: string;
  name: string;
  niche: string;
  avatarUrl: string; // URL to avatar/photo
  distanceLabel: string; // e.g. "2.3km away"
  followers: string; // formatted (e.g. "3.2k")
  engagement: string; // "4.8"
  platformsLabel: string; // "IG + TikTok"
  fitScore: number; // 70-98
  reasons: string[]; // 2-3 short bullets, 2-5 words each
};

interface BuildCreatorMatchesInput {
  businessName?: string | null;
  category?: string | null;
  city?: string | null;
  queries?: string[];
}

export function buildCreatorMatches(input: BuildCreatorMatchesInput): CreatorMatch[] {
  const { businessName, category, city, queries = [] } = input;
  
  const categoryLower = (category || "").toLowerCase();
  const cityName = city || "your area";
  const isRestaurant = categoryLower.includes("restaurant") || categoryLower.includes("food") || categoryLower.includes("cafe") || categoryLower.includes("bar");
  const isRetail = categoryLower.includes("store") || categoryLower.includes("shop") || categoryLower.includes("clothing");
  const isSalon = categoryLower.includes("salon") || categoryLower.includes("beauty") || categoryLower.includes("spa");
  const isGrocery = categoryLower.includes("grocery") || categoryLower.includes("supermarket");

  // Base pool of creators with variations
  const baseCreators: Array<{
    name: string;
    niche: string;
    avatarUrl: string;
    followers: number;
    engagement: number;
    distance: number;
    platforms: string[];
    fitScore: number;
    reasonTemplates: string[];
  }> = [
    {
      name: "Sarah Chen",
      niche: isRestaurant ? "Foodie" : isRetail ? "Lifestyle" : "Local",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      followers: 3200,
      engagement: 5.2,
      distance: 2.3,
      platforms: ["IG", "TikTok"],
      fitScore: 88,
      reasonTemplates: [
        isRestaurant ? `Reviews ${category || "restaurants"} in ${cityName}` : `Loves ${category || "local"} spots nearby`,
        `Audience: ${cityName} locals`,
        "Known for honest reviews",
      ],
    },
    {
      name: "Mike Johnson",
      niche: isRestaurant ? "Foodie" : "Lifestyle",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      followers: 5800,
      engagement: 4.8,
      distance: 4.1,
      platforms: ["IG"],
      fitScore: 82,
      reasonTemplates: [
        isRestaurant ? `Creates ${category || "dining"} content` : `Covers ${category || "local"} businesses`,
        `Drives Google review actions`,
        `Active in ${cityName}`,
      ],
    },
    {
      name: "Emma Williams",
      niche: "Local",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
      followers: 2100,
      engagement: 6.1,
      distance: 1.8,
      platforms: ["IG", "TikTok"],
      fitScore: 91,
      reasonTemplates: [
        `Neighborhood expert in ${cityName}`,
        "High engagement rate",
        "Great at interior shots",
      ],
    },
    {
      name: "David Brown",
      niche: isRestaurant ? "Foodie" : isSalon ? "Lifestyle" : "Local",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      followers: 4500,
      engagement: 5.5,
      distance: 3.7,
      platforms: ["IG", "TikTok"],
      fitScore: 85,
      reasonTemplates: [
        isRestaurant ? `Specializes in ${category || "restaurant"} reviews` : `Reviews ${category || "local"} spots`,
        `Within ${cityName} radius`,
        "Drives review responses",
      ],
    },
    {
      name: "Lisa Anderson",
      niche: isSalon ? "Beauty" : isRetail ? "Fashion" : "Lifestyle",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
      followers: 3700,
      engagement: 5.8,
      distance: 2.9,
      platforms: ["IG"],
      fitScore: 87,
      reasonTemplates: [
        isSalon ? `Beauty & ${category || "wellness"} content` : `Covers ${category || "local"} businesses`,
        `Audience: ${cityName} area`,
        "Strong visual content",
      ],
    },
  ];

  // Convert to CreatorMatch format
  return baseCreators.map((creator, index) => ({
    id: `creator-${index + 1}`,
    name: creator.name,
    niche: creator.niche,
    avatarUrl: creator.avatarUrl,
    distanceLabel: creator.distance < 1 ? `${Math.round(creator.distance * 1000)}m away` : `${creator.distance.toFixed(1)}km away`,
    followers: creator.followers >= 1000 ? `${(creator.followers / 1000).toFixed(1)}k` : creator.followers.toString(),
    engagement: creator.engagement.toFixed(1),
    platformsLabel: creator.platforms.join(" + "),
    fitScore: creator.fitScore,
    reasons: creator.reasonTemplates.slice(0, 3), // Take first 3 reasons
  }));
}

