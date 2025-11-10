/**
 * Category matching utilities for competitor selection.
 * 
 * Provides deterministic category matching with vertical-based matching.
 */

/**
 * Business vertical categories for high-precision competitor matching.
 */
export type CategoryVertical =
  | "food_dining"
  | "grocery_retail"
  | "beauty"
  | "fitness"
  | "health"
  | "auto"
  | "lodging"
  | "other";

/**
 * Generic types that should be filtered out.
 */
const GENERIC = new Set([
  "point of interest",
  "establishment",
  "store",
  "food",
  "shopping mall",
]);

/**
 * Normalize a category value for comparison.
 */
export function normalize(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/_/g, " ").toLowerCase().trim();
  if (!clean || GENERIC.has(clean)) return null;
  return clean;
}

/**
 * Detect vertical from a category string.
 */
export function detectVerticalFromCategory(cat: string | null): CategoryVertical {
  if (!cat) return "other";
  
  const normalized = cat.toLowerCase();
  
  if (normalized.includes("restaurant") || normalized.includes("cafe") || 
      normalized.includes("coffee") || normalized.includes("bar")) {
    return "food_dining";
  }
  
  if (normalized.includes("grocery") || normalized.includes("supermarket") || 
      normalized.includes("hypermarket") || normalized.includes("butcher")) {
    return "grocery_retail";
  }
  
  if (normalized.includes("salon") || normalized.includes("spa") || 
      normalized.includes("nail") || normalized.includes("hair")) {
    return "beauty";
  }
  
  if (normalized.includes("gym") || normalized.includes("fitness")) {
    return "fitness";
  }
  
  if (normalized.includes("clinic") || normalized.includes("dentist") || 
      normalized.includes("medical") || normalized.includes("pharmacy")) {
    return "health";
  }
  
  if (normalized.includes("hotel") || normalized.includes("lodge") || 
      normalized.includes("guest house")) {
    return "lodging";
  }
  
  if (normalized.includes("auto") || normalized.includes("car ") || 
      normalized.includes("tyre") || normalized.includes("tire")) {
    return "auto";
  }
  
  return "other";
}

/**
 * Business category context with vertical detection.
 */
export interface BusinessCategoryContext {
  primary: string | null;
  top3: string[];
  vertical: CategoryVertical;
}

/**
 * Build business category context from business data.
 */
export function buildBusinessCategoryContext(b: {
  primary_category?: string | null;
  category?: string | null;
  categories?: string[] | null;
}): BusinessCategoryContext {
  const raw: string[] = [];
  
  if (b.primary_category) raw.push(b.primary_category);
  if (b.category) raw.push(b.category);
  if (Array.isArray(b.categories)) raw.push(...b.categories);
  
  const norm = Array.from(
    new Set(
      raw
        .map(normalize)
        .filter((v): v is string => !!v)
    )
  );
  
  const primary = norm[0] ?? null;
  const top3 = norm.slice(0, 3);
  const vertical = detectVerticalFromCategory(primary || norm[0] || null);
  
  return { primary, top3, vertical };
}

/**
 * Extract candidate categories from a Google Places result.
 * Returns both normalized categories and raw type information for vertical detection.
 */
export function extractCandidateCategories(place: {
  types?: string[] | null;
  primary_type?: string | null;
  name?: string | null;
}): string[] {
  const fromTypes =
    (place.types || [])
      .map(normalize)
      .filter((v): v is string => !!v);
  
  const fromPrimary = normalize(place.primary_type);
  
  const hints: string[] = [];
  const name = (place.name || "").toLowerCase();
  
  // Extract business type hints from name (most reliable)
  if (name.includes("thai")) hints.push("thai restaurant");
  if (name.includes("coffee")) hints.push("coffee shop");
  if (name.includes("restaurant") || name.includes("bistro") || name.includes("eatery")) hints.push("restaurant");
  if (name.includes("burger") || name.includes("rocomamas") || name.includes("bossa")) hints.push("restaurant");
  if (name.includes("grocery") || name.includes("supermarket") || name.includes("spar") || name.includes("woolworths")) hints.push("grocery store");
  if (name.includes("salon") || name.includes("spa")) hints.push("beauty salon");
  if (name.includes("gym") || name.includes("fitness")) hints.push("gym");
  
  // Check raw types for vertical detection (before normalization filters them out)
  const rawTypes = (place.types || []).map(t => t.toLowerCase());
  
  // Restaurant detection - check for restaurant-related types
  const hasRestaurantType = rawTypes.some(t => 
    t === "restaurant" || 
    t.includes("restaurant") || 
    t === "meal_takeaway" || 
    t === "meal_delivery" ||
    t === "cafe" ||
    t === "bar"
  );
  
  // Grocery/supermarket detection - must be clearly grocery-related
  const hasGroceryType = rawTypes.some(t => 
    t === "supermarket" || 
    t === "grocery_or_supermarket" || 
    t.includes("grocery") || 
    t.includes("supermarket")
  );
  
  // Add type-based hints (prioritize grocery over restaurant if both present)
  if (hasGroceryType) {
    hints.push("grocery store");
  } else if (hasRestaurantType) {
    hints.push("restaurant");
  } else if (rawTypes.includes("food")) {
    // Generic "food" type - only add if we have no other signals
    // This is ambiguous, but better than nothing
    // The vertical detection will need to handle this carefully
    hints.push("restaurant"); // Default to restaurant for "food" type
  }
  
  return Array.from(
    new Set(
      [
        ...fromTypes,
        fromPrimary,
        ...hints,
      ].filter((v): v is string => !!v)
    )
  );
}

/**
 * Detect vertical from raw Google Places types (for more accurate detection).
 */
export function detectVerticalFromRawTypes(types?: string[] | null): CategoryVertical {
  if (!types || types.length === 0) return "other";
  
  const normalized = types.map(t => t.toLowerCase());
  
  // Check for restaurant indicators first
  if (normalized.some(t => 
    t === "restaurant" || 
    t.includes("restaurant") || 
    t === "meal_takeaway" || 
    t === "meal_delivery" ||
    t === "cafe" ||
    t === "bar"
  )) {
    return "food_dining";
  }
  
  // Check for grocery indicators
  if (normalized.some(t => 
    t === "supermarket" || 
    t === "grocery_or_supermarket" || 
    t.includes("grocery") || 
    t.includes("supermarket")
  )) {
    return "grocery_retail";
  }
  
  // Generic "food" type - ambiguous, but more likely restaurant than grocery
  if (normalized.includes("food") && !normalized.some(t => t.includes("grocery") || t.includes("supermarket"))) {
    return "food_dining";
  }
  
  return "other";
}

/**
 * Get category match score between business context and candidate categories.
 */
export function getCategoryMatchScore(
  biz: BusinessCategoryContext,
  candidateCats: string[]
): { score: number; verticalMatch: boolean } {
  const set = new Set(candidateCats);
  let score = 0;
  
  if (biz.primary && set.has(biz.primary)) score += 3;
  if (biz.top3.some(c => set.has(c))) score += 2;
  
  // soft match like "thai restaurant" vs "restaurant"
  if (biz.primary && biz.primary.includes("restaurant") && set.has("restaurant")) {
    score += 1;
  }
  
  // Determine candidate vertical by checking ALL categories, not just the first
  // This is critical for accurate vertical matching
  let candidateVertical: CategoryVertical = "other";
  for (const cat of candidateCats) {
    const vert = detectVerticalFromCategory(cat);
    if (vert !== "other") {
      candidateVertical = vert;
      break; // Use first non-"other" vertical found
    }
  }
  
  // If still "other", check the first category as fallback
  if (candidateVertical === "other" && candidateCats.length > 0) {
    candidateVertical = detectVerticalFromCategory(candidateCats[0]);
  }
  
  return {
    score,
    verticalMatch: candidateVertical === biz.vertical,
  };
}

/**
 * Category synonyms for matching.
 * Maps normalized category names to arrays of synonyms.
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  // Restaurant categories
  "thai restaurant": ["thai restaurant", "thai", "restaurant", "thai food", "thai cuisine"],
  "restaurant": ["restaurant", "dining", "eatery", "bistro", "food"],
  "italian restaurant": ["italian restaurant", "italian", "pizzeria", "trattoria"],
  "chinese restaurant": ["chinese restaurant", "chinese", "chinese food"],
  "indian restaurant": ["indian restaurant", "indian", "curry", "indian food"],
  "japanese restaurant": ["japanese restaurant", "japanese", "sushi", "ramen"],
  "mexican restaurant": ["mexican restaurant", "mexican", "taco", "mexican food"],
  
  // Coffee shops
  "coffee shop": ["coffee shop", "cafe", "coffee", "coffee roaster", "café"],
  "cafe": ["cafe", "coffee shop", "coffee", "café"],
  
  // Bars
  "bar": ["bar", "pub", "tavern", "lounge"],
  "pub": ["pub", "bar", "tavern"],
  
  // Clothing
  "clothing store": ["clothing store", "fashion store", "boutique", "apparel", "clothes", "clothing"],
  "fashion": ["fashion", "clothing", "boutique", "apparel"],
  "boutique": ["boutique", "fashion", "clothing store"],
  
  // Grocery
  "grocery store": ["grocery store", "supermarket", "grocery", "food market"],
  "supermarket": ["supermarket", "grocery store", "grocery"],
  
  // Beauty & Hair
  "hair salon": ["hair salon", "salon", "barber", "haircut", "hairstylist", "hair care"],
  "beauty salon": ["beauty salon", "salon", "beauty", "spa", "aesthetics"],
  "spa": ["spa", "beauty salon", "massage", "wellness"],
  
  // General
  "store": ["store", "shop", "retail"],
  "shop": ["shop", "store", "retail"],
};

/**
 * Check if two categories match.
 * 
 * Uses exact match, synonym matching, and loose word matching.
 */
export function categoryMatches(target: string, candidate: string): boolean {
  const t = normalize(target);
  const c = normalize(candidate);
  
  // Exact match
  if (t === c) {
    return true;
  }
  
  // Synonym match
  const syns = CATEGORY_SYNONYMS[t];
  if (syns) {
    if (syns.some(s => c === s || c.includes(s) || s.includes(c))) {
      return true;
    }
  }
  
  // Reverse lookup: check if candidate is a key with target in its synonyms
  for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (c === key && synonyms.some(s => t === s || t.includes(s) || s.includes(t))) {
      return true;
    }
  }
  
  // Loose match: check if they share a core word
  const targetWords = t.split(/\s+/).filter(w => w.length > 2);
  const candidateWords = c.split(/\s+/).filter(w => w.length > 2);
  
  // If they share any significant word, consider it a match
  for (const tw of targetWords) {
    if (candidateWords.some(cw => cw.includes(tw) || tw.includes(cw))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract categories from a Google Places result.
 * 
 * Uses types array and primary_type if available.
 * Also extracts meaningful words from the name as fallback.
 */
export function getCandidateCategories(candidate: {
  types?: string[];
  primary_type?: string;
  name?: string;
}): string[] {
  const categories: string[] = [];
  
  // Add primary type if available
  if (candidate.primary_type) {
    categories.push(candidate.primary_type);
  }
  
  // Add all types (these are the most reliable)
  if (Array.isArray(candidate.types)) {
    categories.push(...candidate.types);
  }
  
  // Extract meaningful words from name as fallback (e.g., "Thai Restaurant" from "Simply Asia Thai Restaurant")
  if (candidate.name) {
    const name = candidate.name.toLowerCase();
    const hints: string[] = [];
    
    if (name.includes("thai")) hints.push("thai restaurant");
    if (name.includes("coffee")) hints.push("coffee shop");
    if (name.includes("spa")) hints.push("spa");
    if (name.includes("gym")) hints.push("gym");
    if (name.includes("salon")) hints.push("hair salon");
    if (name.includes("restaurant")) hints.push("restaurant");
    if (name.includes("cafe") || name.includes("café")) hints.push("cafe");
    if (name.includes("bar")) hints.push("bar");
    if (name.includes("grocery") || name.includes("supermarket")) hints.push("grocery store");
    
    categories.push(...hints);
  }
  
  // Normalize and dedupe, filtering out nulls
  return Array.from(
    new Set(
      categories
        .map(normalize)
        .filter((v): v is string => Boolean(v))
    )
  );
}

/**
 * Get top categories from a business.
 * 
 * Extracts categories from business data and snapshot raw.
 */
export function getBusinessCategories(
  business: {
    primary_category?: string | null;
    category?: string | null;
    categories?: string[] | null;
  },
  snapshotRaw?: any
): string[] {
  const allCategories: string[] = [];
  
  // Priority 1: primary_category
  if (business.primary_category) {
    allCategories.push(business.primary_category);
  }
  
  // Priority 2: category
  if (business.category) {
    allCategories.push(business.category);
  }
  
  // Priority 3: categories array
  if (Array.isArray(business.categories)) {
    allCategories.push(...business.categories);
  }
  
  // Priority 4: snapshot raw types
  if (snapshotRaw && typeof snapshotRaw === 'object') {
    if (Array.isArray(snapshotRaw.types)) {
      allCategories.push(...snapshotRaw.types);
    }
  }
  
  // Normalize and dedupe
  const normalized = Array.from(new Set(allCategories.map(normalize).filter((v): v is string => Boolean(v))));
  
  // Return top 3
  return normalized.slice(0, 3);
}

/**
 * Map a category to a Google Places type.
 * 
 * Returns the most appropriate Google type for a category, or null if no mapping.
 */
export function categoryToGoogleType(category: string): string | null {
  const normalized = normalize(category);
  
  const typeMap: Record<string, string> = {
    "restaurant": "restaurant",
    "thai restaurant": "restaurant",
    "italian restaurant": "restaurant",
    "chinese restaurant": "restaurant",
    "indian restaurant": "restaurant",
    "japanese restaurant": "restaurant",
    "mexican restaurant": "restaurant",
    "coffee shop": "cafe",
    "cafe": "cafe",
    "bar": "bar",
    "pub": "bar",
    "clothing store": "clothing_store",
    "fashion": "clothing_store",
    "boutique": "clothing_store",
    "grocery store": "supermarket",
    "supermarket": "supermarket",
    "hair salon": "hair_care",
    "beauty salon": "beauty_salon",
    "spa": "spa",
    "store": "store",
    "shop": "store",
  };
  
  // Direct match
  if (typeMap[normalized]) {
    return typeMap[normalized];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(typeMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return null;
}

