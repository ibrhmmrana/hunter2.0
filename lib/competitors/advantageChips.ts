// lib/competitors/advantageChips.ts

export interface AdvantageBase {
  rating?: number | null;
  reviews?: number | null;
}

export interface AdvantageChip {
  label: string;
  tone: 'neutral' | 'warning';
}

export interface AdvantageChipsOptions {
  leader: AdvantageBase;
  you: AdvantageBase;
  // optional: thresholds
  ratingEpsilon?: number;
  minReviewGap?: number;
}

/**
 * Build advantage chips comparing a leader's stats to the user's stats.
 * Used for both competitor cards and top search leader cards.
 */
export function buildAdvantageChips({
  leader,
  you,
  ratingEpsilon = 0.05,
  minReviewGap = 10,
}: AdvantageChipsOptions): AdvantageChip[] {
  const chips: AdvantageChip[] = [];

  // Rating comparison
  if (leader.rating != null && you.rating != null) {
    if (leader.rating - you.rating > ratingEpsilon) {
      chips.push({ label: 'Better rating', tone: 'warning' });
    } else if (you.rating - leader.rating > ratingEpsilon) {
      chips.push({ label: 'Lower rating', tone: 'neutral' });
    }
  }

  // Reviews comparison
  if (leader.reviews != null && you.reviews != null) {
    const diff = leader.reviews - you.reviews;
    if (diff >= minReviewGap) {
      chips.push({ label: 'More reviews', tone: 'warning' });
      chips.push({
        label: `Close the gap: +${diff} reviews`,
        tone: 'warning',
      });
    }
  }

  return chips;
}

