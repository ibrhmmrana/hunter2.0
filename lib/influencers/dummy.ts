/**
 * Generate dummy influencer descriptions based on business category.
 * Server-side helper for creating contextual creator chips.
 */

export interface CreatorChip {
  name: string;
  tag: string;
  distance: string;
  description: string;
}

export function generateCreatorChips(
  category: string | null,
  city: string | null
): CreatorChip[] {
  const categoryLower = (category || "").toLowerCase();
  const cityName = city || "your area";

  const chips: CreatorChip[] = [];

  // Food/restaurant related
  if (
    categoryLower.includes("restaurant") ||
    categoryLower.includes("food") ||
    categoryLower.includes("cafe") ||
    categoryLower.includes("bar")
  ) {
    chips.push({
      name: "Leah",
      tag: "Foodie",
      distance: "3km away",
      description: `Reviews local ${categoryLower.includes("cafe") ? "coffee spots" : "restaurants"} and posts ${categoryLower.includes("cafe") ? "cafe" : "food"} reels; audience: ${cityName} foodies.`,
    });
    chips.push({
      name: "Thabo",
      tag: categoryLower.includes("coffee") ? "Coffee vlogger" : "Lifestyle",
      distance: "5.2km away",
      description: `5.2k followers in ${cityName}; specializes in ${categoryLower.includes("coffee") ? "coffee" : "dining"} content.`,
    });
    chips.push({
      name: "Sarah",
      tag: "Local",
      distance: "2.1km away",
      description: `Creates content about ${category || "local spots"} in ${cityName}; high engagement.`,
    });
  }
  // Beauty/salon
  else if (
    categoryLower.includes("beauty") ||
    categoryLower.includes("salon") ||
    categoryLower.includes("spa")
  ) {
    chips.push({
      name: "Emma",
      tag: "Beauty",
      distance: "2.5km away",
      description: `Beauty influencer in ${cityName}; reviews salons and shares self-care content.`,
    });
    chips.push({
      name: "Maya",
      tag: "Lifestyle",
      distance: "4km away",
      description: `Lifestyle creator covering beauty and wellness spots in ${cityName}.`,
    });
    chips.push({
      name: "Zara",
      tag: "Local",
      distance: "1.8km away",
      description: `Hyperlocal creator; audience loves ${cityName} beauty recommendations.`,
    });
  }
  // Generic/local business
  else {
    chips.push({
      name: "Leah",
      tag: "Local",
      distance: "3km away",
      description: `Reviews local businesses in ${cityName}; authentic following.`,
    });
    chips.push({
      name: "Thabo",
      tag: "Lifestyle",
      distance: "5.2km away",
      description: `5.2k followers in ${cityName}; creates content about local spots.`,
    });
    chips.push({
      name: "Sarah",
      tag: "Community",
      distance: "2.1km away",
      description: `Community-focused creator; helps ${cityName} locals discover new places.`,
    });
  }

  return chips.slice(0, 3);
}




