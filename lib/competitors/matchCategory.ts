// lib/competitors/matchCategory.ts

/**
 * Normalize a string for category matching.
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\&]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Category mapping from stored primary_category to allowed Google Places types.
 */
const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  "thai restaurant": ["restaurant", "thai_restaurant"],
  "restaurant": ["restaurant"],
  "coffee shop": ["cafe", "coffee_shop"],
  "cafe": ["cafe", "coffee_shop"],
  "grocery store": ["grocery_or_supermarket", "supermarket", "convenience_store"],
  "supermarket": ["grocery_or_supermarket", "supermarket", "convenience_store"],
  "clothing store": ["clothing_store"],
  "fashion": ["clothing_store"],
  "cell phone store": ["electronics_store", "mobile_phone_store"],
  "mobile phone store": ["electronics_store", "mobile_phone_store"],
  "cell phone repair": ["electronics_store", "mobile_phone_store"],
  "phone repair": ["electronics_store", "mobile_phone_store"],
  "electronics store": ["electronics_store"],
  "hair salon": ["hair_care", "beauty_salon"],
  "beauty salon": ["beauty_salon"],
  "nail salon": ["beauty_salon"],
  "spa": ["beauty_salon", "spa"],
  "gym": ["gym"],
  "fitness center": ["gym"],
  "bar": ["bar"],
  "pub": ["bar"],
  "pizza": ["restaurant", "meal_delivery", "meal_takeaway"],
  "italian restaurant": ["restaurant"],
  "chinese restaurant": ["restaurant"],
  "indian restaurant": ["restaurant"],
  "japanese restaurant": ["restaurant"],
  "mexican restaurant": ["restaurant"],
};

/**
 * Get anchor category tokens from a primary category label.
 */
export function getAnchorCategoryTokens(
  primaryCategory: string | null | undefined
): {
  anchorLabel: string | null;
  allowedTypes: string[];
  keywordTokens: string[];
} {
  if (!primaryCategory) {
    return {
      anchorLabel: null,
      allowedTypes: [],
      keywordTokens: [],
    };
  }

  const normalized = normalize(primaryCategory);
  
  // Look up in map
  const allowedTypes = CATEGORY_TYPE_MAP[normalized] || [];
  
  // Extract keyword tokens (words of length >= 3)
  const keywordTokens = normalized
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .filter(word => !["the", "and", "for", "with"].includes(word));

  // If no mapping found, try to infer from normalized label
  if (allowedTypes.length === 0) {
    // Try partial matches
    for (const [key, types] of Object.entries(CATEGORY_TYPE_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return {
          anchorLabel: normalized,
          allowedTypes: types,
          keywordTokens,
        };
      }
    }
    
    // Fallback: if it contains common words, map them
    if (normalized.includes("restaurant")) {
      return {
        anchorLabel: normalized,
        allowedTypes: ["restaurant"],
        keywordTokens,
      };
    }
    if (normalized.includes("coffee") || normalized.includes("cafe")) {
      return {
        anchorLabel: normalized,
        allowedTypes: ["cafe", "coffee_shop"],
        keywordTokens,
      };
    }
    if (normalized.includes("grocery") || normalized.includes("supermarket")) {
      return {
        anchorLabel: normalized,
        allowedTypes: ["grocery_or_supermarket", "supermarket"],
        keywordTokens,
      };
    }
    if (normalized.includes("clothing") || normalized.includes("fashion")) {
      return {
        anchorLabel: normalized,
        allowedTypes: ["clothing_store"],
        keywordTokens,
      };
    }
    if (normalized.includes("cell phone") || normalized.includes("mobile phone") || normalized.includes("phone repair") || normalized.includes("phone store")) {
      return {
        anchorLabel: normalized,
        allowedTypes: ["electronics_store", "mobile_phone_store"],
        keywordTokens,
      };
    }
  }

  return {
    anchorLabel: normalized,
    allowedTypes,
    keywordTokens,
  };
}

/**
 * Check if a candidate matches the anchor category.
 */
export function matchesCategoryAnchor(
  candidate: {
    types?: string[];
    name?: string | null;
  },
  anchor: ReturnType<typeof getAnchorCategoryTokens>
): boolean {
  // If no anchor label, don't block (rely on other filters)
  if (!anchor.anchorLabel) {
    return true;
  }

  // Normalize candidate types
  const candidateTypes = (candidate.types || []).map(t => normalize(t));
  const candidateName = candidate.name ? normalize(candidate.name) : "";

  // Rule 1: Check if any candidate type is in allowed types
  if (anchor.allowedTypes.length > 0) {
    const normalizedAllowedTypes = anchor.allowedTypes.map(t => normalize(t));
    if (candidateTypes.some(t => normalizedAllowedTypes.includes(t))) {
      return true;
    }
  }

  // Rule 2: Check if all keyword tokens appear in candidate name
  if (anchor.keywordTokens.length > 0 && candidateName) {
    const allTokensMatch = anchor.keywordTokens.every(token => 
      candidateName.includes(token)
    );
    if (allTokensMatch) {
      return true;
    }
  }

  return false;
}

