/**
 * Influencer recommendation logic for businesses.
 * 
 * Server-side only - currently returns dummy data, but structured for future DB integration.
 */

export type RecommendedInfluencer = {
  id: string;
  name: string;
  avatarUrl: string;
  tag: string; // e.g. "Foodie", "Lifestyle", "Family"
  followers: number;
  engagementRate: number; // %
  distanceKm: number;
  matchReason: string; // short, 1 line
};

/**
 * Get recommended influencers for a business.
 * 
 * Currently returns dummy data tuned to create urgency and relevance.
 * Future: will query a real influencers table based on category, city, and matching criteria.
 */
export async function getInfluencersForBusiness(input: {
  city: string | null;
  category: string | null;
}): Promise<RecommendedInfluencer[]> {
  // Dummy data - tuned for nano/micro influencers (1.5k-8k followers)
  const allInfluencers: RecommendedInfluencer[] = [
    {
      id: 'inf-1',
      name: 'Sarah Chen',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      tag: 'Foodie',
      followers: 3200,
      engagementRate: 5.2,
      distanceKm: 2.3,
      matchReason: 'Regularly reviews local restaurants in your area',
    },
    {
      id: 'inf-2',
      name: 'Mike Johnson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
      tag: 'Lifestyle',
      followers: 5800,
      engagementRate: 4.8,
      distanceKm: 4.1,
      matchReason: 'Creates content about dining experiences',
    },
    {
      id: 'inf-3',
      name: 'Emma Williams',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
      tag: 'Local',
      followers: 2100,
      engagementRate: 6.1,
      distanceKm: 1.8,
      matchReason: 'Active in your neighborhood, high engagement',
    },
    {
      id: 'inf-4',
      name: 'David Brown',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
      tag: 'Foodie',
      followers: 4500,
      engagementRate: 5.5,
      distanceKm: 3.7,
      matchReason: 'Specializes in restaurant reviews and food content',
    },
    {
      id: 'inf-5',
      name: 'Lisa Anderson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
      tag: 'Family',
      followers: 6800,
      engagementRate: 4.2,
      distanceKm: 5.2,
      matchReason: 'Family-focused content creator in your city',
    },
    {
      id: 'inf-6',
      name: 'James Wilson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
      tag: 'Lifestyle',
      followers: 2900,
      engagementRate: 5.9,
      distanceKm: 2.9,
      matchReason: 'Local lifestyle influencer with authentic following',
    },
    {
      id: 'inf-7',
      name: 'Maria Garcia',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
      tag: 'Foodie',
      followers: 5200,
      engagementRate: 4.6,
      distanceKm: 6.8,
      matchReason: 'Food blogger covering restaurants in your area',
    },
    {
      id: 'inf-8',
      name: 'Tom Martinez',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tom',
      tag: 'Local',
      followers: 3800,
      engagementRate: 5.3,
      distanceKm: 3.4,
      matchReason: 'Hyperlocal creator, strong community presence',
    },
  ];

  // Filter based on category if provided
  let filtered = allInfluencers;

  if (input.category) {
    const categoryLower = input.category.toLowerCase();
    
    // If it's a restaurant/food category, prioritize foodies
    if (categoryLower.includes('restaurant') || categoryLower.includes('food') || 
        categoryLower.includes('cafe') || categoryLower.includes('bar')) {
      filtered = allInfluencers.filter(inf => 
        inf.tag === 'Foodie' || inf.tag === 'Lifestyle'
      );
    }
    // If it's beauty/salon, prioritize lifestyle
    else if (categoryLower.includes('beauty') || categoryLower.includes('salon') || 
             categoryLower.includes('spa')) {
      filtered = allInfluencers.filter(inf => 
        inf.tag === 'Lifestyle' || inf.tag === 'Local'
      );
    }
    // For grocery, prioritize family and local
    else if (categoryLower.includes('grocery') || categoryLower.includes('supermarket') || 
             categoryLower.includes('store')) {
      filtered = allInfluencers.filter(inf => 
        inf.tag === 'Family' || inf.tag === 'Local'
      );
    }
  }

  // Return 4-5 influencers (enough to show value, not overwhelming)
  return filtered.slice(0, 5);
}




