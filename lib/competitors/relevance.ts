/**
 * Competitor relevance filtering and category matching.
 * 
 * Provides deterministic, fast category matching without AI calls.
 */

import type { NormalizedPlaceResult } from '@/lib/google/places';

export interface CanonicalCategory {
  slug: string;
  keywords: string[];
  googleTypes: string[];
}

export interface BusinessData {
  name: string;
  primary_category?: string | null;
  category?: string | null;
  categories?: string[] | null;
  rating_avg?: number | null;
  reviews_total?: number | null;
}

/**
 * Derive a canonical category for a business.
 * 
 * Maps business categories to a small set of archetypes with keywords and Google types.
 */
export function getCanonicalCategory(
  business: BusinessData,
  snapshotRaw?: any
): CanonicalCategory {
  // Collect all category strings
  const allCategories: string[] = [];
  
  // Priority 1: primary_category
  if (business.primary_category) {
    allCategories.push(business.primary_category.toLowerCase());
  }
  
  // Priority 2: category
  if (business.category) {
    allCategories.push(business.category.toLowerCase());
  }
  
  // Priority 3: categories array
  if (Array.isArray(business.categories)) {
    allCategories.push(...business.categories.map(c => c.toLowerCase()));
  }
  
  // Priority 4: snapshot raw types
  if (snapshotRaw && typeof snapshotRaw === 'object') {
    if (Array.isArray(snapshotRaw.types)) {
      allCategories.push(...snapshotRaw.types.map((t: string) => t.toLowerCase()));
    }
  }

  // Normalize to canonical categories
  // Restaurant
  const restaurantKeywords = ['restaurant', 'food', 'dining', 'bistro', 'eatery', 'pizzeria', 'bakery', 'diner'];
  if (allCategories.some(cat => restaurantKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'restaurant',
      keywords: ['restaurant', 'food', 'dining'],
      googleTypes: ['restaurant', 'food', 'meal_takeaway'],
    };
  }

  // Coffee shop
  const coffeeKeywords = ['coffee', 'cafe', 'café'];
  if (allCategories.some(cat => coffeeKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'coffee_shop',
      keywords: ['coffee', 'cafe'],
      googleTypes: ['cafe', 'coffee_shop', 'restaurant'],
    };
  }

  // Bar
  const barKeywords = ['bar', 'pub', 'tavern', 'lounge', 'nightclub'];
  if (allCategories.some(cat => barKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'bar',
      keywords: ['bar', 'pub'],
      googleTypes: ['bar'],
    };
  }

  // Clothing store
  const clothingKeywords = ['clothing', 'fashion', 'boutique', 'apparel', 'clothes', 'wear'];
  if (allCategories.some(cat => clothingKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'clothing_store',
      keywords: ['clothing', 'fashion', 'boutique', 'apparel'],
      googleTypes: ['clothing_store', 'shoe_store', 'store', 'shopping_mall'],
    };
  }

  // Grocery/Supermarket
  const groceryKeywords = ['grocery', 'supermarket', 'foods', 'market', 'convenience_store'];
  if (allCategories.some(cat => groceryKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'grocery_supermarket',
      keywords: ['grocery', 'supermarket', 'foods'],
      googleTypes: ['supermarket', 'grocery_or_supermarket', 'convenience_store'],
    };
  }

  // Hair salon
  const hairKeywords = ['hair', 'salon', 'barber', 'haircut', 'hairstylist'];
  if (allCategories.some(cat => hairKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'hair_salon',
      keywords: ['hair', 'salon', 'barber'],
      googleTypes: ['hair_care', 'beauty_salon'],
    };
  }

  // Beauty spa
  const beautyKeywords = ['beauty', 'spa', 'aesthetics', 'massage', 'facial', 'nail'];
  if (allCategories.some(cat => beautyKeywords.some(kw => cat.includes(kw)))) {
    return {
      slug: 'beauty_spa',
      keywords: ['beauty', 'spa', 'aesthetics'],
      googleTypes: ['beauty_salon', 'spa'],
    };
  }

  // Default fallback
  return {
    slug: 'local_service',
    keywords: ['business', 'service', 'local'],
    googleTypes: ['establishment', 'point_of_interest'],
  };
}

/**
 * Hard-excluded types that should never be considered competitors.
 */
const HARD_EXCLUDED_TYPES = [
  'lodging',
  'hotel',
  'church',
  'place_of_worship',
  'school',
  'university',
  'hospital',
  'doctor',
  'bank',
  'atm',
  'car_dealer',
  'car_repair',
  'car_wash',
  'real_estate_agency',
  'storage',
  'parking',
  'gas_station',
  'pharmacy',
  'funeral_home',
  'cemetery',
];

/**
 * Check if a candidate is a relevant competitor for the subject business.
 * 
 * This is a fast, deterministic filter that checks:
 * 1. Type matching (Google Places types)
 * 2. Keyword matching (name/categories)
 * 3. Hard exclusions
 * 4. Distance (must be <= 6000m)
 * 5. Strength thresholds (rating >= subject, reviews >= subject, with protections for low-data subjects)
 */
export function isRelevantCompetitor(
  subject: BusinessData,
  candidate: NormalizedPlaceResult,
  canonical: CanonicalCategory,
  distanceMeters: number,
  subjectRating: number | null,
  subjectReviews: number | null
): boolean {
  // 1. Distance check
  if (distanceMeters > 6000) {
    return false;
  }

  // 2. Hard exclusions
  const candidateTypes = (candidate.types || []).map(t => t.toLowerCase());
  if (candidateTypes.some(type => HARD_EXCLUDED_TYPES.some(excluded => type.includes(excluded)))) {
    return false;
  }

  // 3. Type match: if candidate shares any canonical Google types → strong yes
  const hasTypeMatch = candidateTypes.some(type => 
    canonical.googleTypes.some(canonicalType => type.includes(canonicalType))
  );

  // 4. Keyword match: check candidate name and types for canonical keywords
  const candidateNameLower = candidate.name.toLowerCase();
  const candidateText = `${candidateNameLower} ${candidateTypes.join(' ')}`;
  const hasKeywordMatch = canonical.keywords.some(keyword => 
    candidateText.includes(keyword.toLowerCase())
  );

  // Must have either type match or keyword match
  if (!hasTypeMatch && !hasKeywordMatch) {
    return false;
  }

  // 5. Strength thresholds
  // Protect low-data subjects: if subject has < 20 reviews, require candidate >= 20
  const minReviewsForCandidate = (subjectReviews || 0) < 20 ? 20 : (subjectReviews || 0);
  
  if (candidate.user_ratings_total === undefined || candidate.user_ratings_total < minReviewsForCandidate) {
    return false;
  }

  // Rating check: if subject has a rating, candidate must be >=
  if (subjectRating !== null && subjectRating > 0) {
    if (candidate.rating === undefined || candidate.rating < subjectRating) {
      return false;
    }
  }

  return true;
}

/**
 * Generate short reasons why a competitor is ahead.
 * 
 * Returns 2-5 word tags like "Higher rating", "More reviews", etc.
 * This is deterministic and fast - no AI calls.
 */
export function generateShortReasons(
  subject: BusinessData,
  candidate: NormalizedPlaceResult,
  subjectRating: number | null,
  subjectReviews: number | null
): string[] {
  const reasons: string[] = [];

  // Rating gap
  if (subjectRating !== null && candidate.rating !== undefined) {
    const ratingGap = candidate.rating - subjectRating;
    if (ratingGap >= 0.5) {
      reasons.push('Higher rating');
    } else if (ratingGap >= 0.2) {
      reasons.push('Better rating');
    }
  }

  // Reviews gap
  if (subjectReviews !== null && candidate.user_ratings_total !== undefined) {
    const reviewsGap = candidate.user_ratings_total - subjectReviews;
    if (reviewsGap >= 100) {
      reasons.push('More reviews');
    } else if (reviewsGap >= 50) {
      reasons.push('Better reviewed');
    }
  }

  // If no specific reasons, add generic ones based on what we know
  if (reasons.length === 0) {
    if (candidate.rating !== undefined && candidate.rating >= 4.5) {
      reasons.push('High rating');
    }
    if (candidate.user_ratings_total !== undefined && candidate.user_ratings_total >= 100) {
      reasons.push('Well reviewed');
    }
  }

  return reasons.slice(0, 3); // Max 3 reasons
}

