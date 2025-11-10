/**
 * Insight generation helpers for analytics dashboard
 */

/**
 * Insight for total review volume
 */
export function insightForReviews(total: number | null | undefined): string {
  if (total === null || total === undefined || !Number.isFinite(total)) {
    return "Review volume unknown";
  }

  const count = Math.round(total);

  if (count >= 200) {
    return "Standout volume — maintain cadence";
  }

  if (count >= 50) {
    return "Great base — keep consistent asks";
  }

  if (count >= 10) {
    return "Build momentum — target 50+ reviews";
  }

  return "Too few reviews — aim for 20+ quickly";
}

/**
 * Insight for review velocity (last 30 days)
 */
export function insightForVelocity(last30: number | null | undefined): string {
  if (last30 === null || last30 === undefined || !Number.isFinite(last30)) {
    return "No recent data";
  }

  const count = Math.round(last30);

  if (count >= 20) {
    return "High velocity — trending locally";
  }

  if (count >= 5) {
    return "Healthy flow — keep it up";
  }

  if (count >= 1) {
    return "Low velocity — target 5 this month";
  }

  return "Quiet month — ask recent customers now";
}

/**
 * Insight for rating with negative share
 */
export function insightForRating(
  rating: number | null | undefined,
  negPct: number | null | undefined
): string {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return "Rating unknown";
  }

  if (rating >= 4.6) {
    return "Excellent rating — highlight best reviews";
  }

  if (rating >= 4.0) {
    return "Solid rating — reply to 4★ to nudge up";
  }

  if (rating >= 3.5) {
    return "Mixed feedback — address common themes";
  }

  return "At risk — resolve top complaints";
}






