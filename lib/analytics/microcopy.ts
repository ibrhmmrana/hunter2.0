/**
 * Helper to format percentage
 */
function fmtPct(x: number | null | undefined, digits: number = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) {
    return "—";
  }
  return `${x.toFixed(digits)}%`;
}

/**
 * Distribution data structure
 */
export interface StarDistribution {
  five?: number;
  four?: number;
  three?: number;
  two?: number;
  one?: number;
}

/**
 * Format distribution into percentage array
 * Returns array of {label, pct} with percentages rounded to whole numbers
 * Sum is clamped to 100%
 */
export function formatDistribution(
  dist: StarDistribution | null | undefined,
  total: number | null | undefined
): Array<{ label: string; pct: number }> {
  if (!dist || !total || total === 0) {
    return [];
  }

  const counts = {
    five: dist.five || 0,
    four: dist.four || 0,
    three: dist.three || 0,
    two: dist.two || 0,
    one: dist.one || 0,
  };

  const rawPcts = [
    { label: "5★", pct: (counts.five / total) * 100 },
    { label: "4★", pct: (counts.four / total) * 100 },
    { label: "3★", pct: (counts.three / total) * 100 },
    { label: "2★", pct: (counts.two / total) * 100 },
    { label: "1★", pct: (counts.one / total) * 100 },
  ];

  // Round to whole numbers
  const rounded = rawPcts.map((item) => ({
    ...item,
    pct: Math.round(item.pct),
  }));

  // Clamp sum to 100% (adjust the largest value if needed)
  const sum = rounded.reduce((acc, item) => acc + item.pct, 0);
  if (sum !== 100 && rounded.length > 0) {
    const diff = 100 - sum;
    const maxIdx = rounded.reduce(
      (maxIdx, item, idx) => (item.pct > rounded[maxIdx].pct ? idx : maxIdx),
      0
    );
    rounded[maxIdx].pct += diff;
  }

  return rounded;
}

/**
 * Render distribution as a single line string (horizontal)
 */
export function renderDistributionLine(
  dist: StarDistribution | null | undefined,
  total: number | null | undefined
): string {
  const formatted = formatDistribution(dist, total);
  if (formatted.length === 0) {
    return "—";
  }

  return formatted.map((item) => `${item.label} ${item.pct}%`).join(" • ");
}

/**
 * Get formatted distribution array for vertical display
 * Returns an array of formatted strings ready to be rendered
 */
export function getDistributionVertical(
  dist: StarDistribution | null | undefined,
  total: number | null | undefined
): string[] {
  const formatted = formatDistribution(dist, total);
  if (formatted.length === 0) {
    return [];
  }

  return formatted.map((item) => `${item.label} ${item.pct}%`);
}

/**
 * Derive a simple split from rating_avg and negative_share_percent
 * This is a fallback when distribution data is not available
 */
export function deriveDistributionFromRating(
  rating: number | null | undefined,
  negPct: number | null | undefined,
  total: number | null | undefined
): StarDistribution | null {
  if (!rating || !total || total === 0 || negPct === null || negPct === undefined) {
    return null;
  }

  // Very rough estimate: assume negative % is split between 1★ and 2★
  // Positive % is split between 3★, 4★, and 5★ based on rating
  const posPct = 100 - negPct;
  const negCount = Math.round((total * negPct) / 100);
  const posCount = total - negCount;

  // Split negatives: 60% to 1★, 40% to 2★
  const oneStar = Math.round(negCount * 0.6);
  const twoStar = negCount - oneStar;

  // Split positives based on rating
  // Higher rating = more 5★, fewer 3★
  let threeStar = 0;
  let fourStar = 0;
  let fiveStar = 0;

  if (rating >= 4.5) {
    // Mostly 5★ and 4★
    fiveStar = Math.round(posCount * 0.7);
    fourStar = Math.round(posCount * 0.25);
    threeStar = posCount - fiveStar - fourStar;
  } else if (rating >= 4.0) {
    // Mix of 4★ and 5★
    fiveStar = Math.round(posCount * 0.4);
    fourStar = Math.round(posCount * 0.45);
    threeStar = posCount - fiveStar - fourStar;
  } else {
    // More 3★ and 4★
    threeStar = Math.round(posCount * 0.4);
    fourStar = Math.round(posCount * 0.45);
    fiveStar = posCount - threeStar - fourStar;
  }

  return {
    five: fiveStar,
    four: fourStar,
    three: threeStar,
    two: twoStar,
    one: oneStar,
  };
}

/**
 * Describe rating with negative share
 */
export function describeRating(
  rating: number | null | undefined,
  negPct: number | null | undefined
): { sub: string; tone: "danger" | "warn" | "ok" | "great" } {
  const negStr = fmtPct(negPct, 1);

  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return {
      sub: `${negStr} negative`,
      tone: "ok",
    };
  }

  if (rating >= 4.6) {
    return {
      sub: `${negStr} negative • Excellent`,
      tone: "great",
    };
  }

  if (rating >= 4.0) {
    return {
      sub: `${negStr} negative • Good`,
      tone: "ok",
    };
  }

  if (rating >= 3.5) {
    return {
      sub: `${negStr} negative • Mixed`,
      tone: "warn",
    };
  }

  return {
    sub: `${negStr} negative • Needs work`,
    tone: "danger",
  };
}

/**
 * Describe review volume
 */
export function describeVolume(total: number | null | undefined): string {
  if (total === null || total === undefined || !Number.isFinite(total)) {
    return "—";
  }

  const count = Math.round(total);

  if (count >= 200) {
    return "Market-leading volume";
  }

  if (count >= 50) {
    return "Strong — keep growing";
  }

  if (count >= 10) {
    return "Okay — aim 50+";
  }

  return "Too few — aim 20+";
}

/**
 * Describe review velocity
 */
export function describeVelocity(last30: number | null | undefined): string {
  if (last30 === null || last30 === undefined || !Number.isFinite(last30)) {
    return "—";
  }

  const count = Math.round(last30);

  if (count >= 20) {
    return "High velocity — trending";
  }

  if (count >= 5) {
    return "Healthy momentum";
  }

  if (count >= 1) {
    return "Low velocity — aim 5+";
  }

  return "Quiet — ask recent customers";
}

/**
 * Describe visual trust score
 */
export function describeVisualTrust(
  score: number | null | undefined
): { label: "Weak" | "Okay" | "Strong" | "Excellent" | "—"; sub: string } {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return {
      label: "—",
      sub: "—",
    };
  }

  const value = Math.round(score);

  if (value >= 85) {
    return {
      label: "Excellent",
      sub: "Top-tier presence",
    };
  }

  if (value >= 70) {
    return {
      label: "Strong",
      sub: "Looks credible",
    };
  }

  if (value >= 50) {
    return {
      label: "Okay",
      sub: "Add fresh photos & info",
    };
  }

  return {
    label: "Weak",
    sub: "Thin photos/content",
  };
}

