// lib/categories.ts

export type CanonicalCategory =
  | "coffee_shop"
  | "restaurant"
  | "thai_restaurant"
  | "grocery_store"
  | "clothing_store"
  | "beauty_salon"
  | "hair_salon"
  | "other";

const EXCLUDED_TYPES = [
  "lodging",
  "hotel",
  "car_dealer",
  "car_rental",
  "car_repair",
  "gas_station",
  "storage",
  "church",
  "school",
  "university",
  "museum",
  "park",
  "shopping_mall",
  "library",
  "local_government_office",
];

function hasExcludedType(types?: string[]): boolean {
  if (!types) return false;
  const t = types.map(x => x.toLowerCase());
  return EXCLUDED_TYPES.some(x => t.includes(x));
}

/**
 * From a human label like "Thai restaurant", "Grocery store", "Coffee shop"
 */
export function canonicalFromLabel(label?: string | null): CanonicalCategory | null {
  if (!label) return null;
  const v = label.toLowerCase();
  if (v.includes("thai") && v.includes("restaurant")) return "thai_restaurant";
  if (v.includes("coffee") || v.includes("cafe")) return "coffee_shop";
  if (v.includes("grocery") || v.includes("supermarket")) return "grocery_store";
  if (v.includes("clothing") || v.includes("fashion")) return "clothing_store";
  if (v.includes("hair")) return "hair_salon";
  if (v.includes("beauty") || v.includes("salon")) return "beauty_salon";
  if (v.includes("restaurant")) return "restaurant";
  return "other";
}

/**
 * From Google Place types + name.
 * This is what we use for candidates.
 */
export function canonicalFromTypes(types?: string[], name?: string | null): CanonicalCategory | null {
  if (!types || types.length === 0) return null;

  const t = types.map(x => x.toLowerCase());
  const nm = (name || "").toLowerCase();

  if (hasExcludedType(types)) return null;

  if (t.includes("grocery_or_supermarket") || t.includes("supermarket")) {
    return "grocery_store";
  }

  if (t.includes("clothing_store")) {
    return "clothing_store";
  }

  if (t.includes("hair_care")) {
    return "hair_salon";
  }

  if (t.includes("beauty_salon")) {
    return "beauty_salon";
  }

  // Thai restaurant: restaurant + thai signal
  if (t.includes("restaurant") && (t.includes("thai") || nm.includes("thai"))) {
    return "thai_restaurant";
  }

  // Coffee shop / cafe
  if (t.includes("cafe") || t.includes("coffee_shop")) {
    return "coffee_shop";
  }

  if (t.includes("restaurant")) {
    return "restaurant";
  }

  return "other";
}

/**
 * Strict equality: only match when both sides resolve to a non-"other"
 * canonical category and are equal.
 */
export function isSameCanonicalCategory(
  userCategoryLabel: string | null | undefined,
  candidateTypes?: string[],
  candidateName?: string | null
): boolean {
  const userCanonical = canonicalFromLabel(userCategoryLabel);
  if (!userCanonical || userCanonical === "other") return false;

  const candidateCanonical = canonicalFromTypes(candidateTypes, candidateName);
  if (!candidateCanonical || candidateCanonical === "other") return false;

  return userCanonical === candidateCanonical;
}

