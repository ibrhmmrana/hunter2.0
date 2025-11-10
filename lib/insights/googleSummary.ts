/**
 * Extract Google Business Profile summary from database.
 * 
 * This module is server-only.
 */

export type GoogleSummary = {
  rating: number | null;
  userReviewCount: number | null;
  leaderAvgRating: number | null;
  leaderAvgReviews: number | null;
  hasBusinessHours: boolean;
  hasWebsite: boolean;
  hasPhotos: boolean;
};

/**
 * Build Google summary for a business from confirmed data.
 */
export async function buildGoogleSummary(
  businessId: string,
  supabase: any
): Promise<GoogleSummary> {
  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('rating, reviews_count, google_maps_url, image_url')
    .eq('place_id', businessId)
    .maybeSingle();

  // Get latest snapshot for more accurate data
  const { data: snapshot } = await supabase
    .from('snapshots_gbp')
    .select('rating_avg, reviews_total, raw')
    .eq('business_place_id', businessId)
    .order('snapshot_ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Prefer snapshot data, fallback to business table
  const rating = snapshot?.rating_avg ?? business?.rating ?? null;
  const userReviewCount = snapshot?.reviews_total ?? business?.reviews_count ?? null;

  // Check for business hours (from snapshot raw)
  const raw = snapshot?.raw || {};
  const openingHours = raw.opening_hours || raw.current_opening_hours || {};
  const hasBusinessHours = !!(
    openingHours.weekday_text?.length > 0 ||
    openingHours.periods?.length > 0 ||
    openingHours.open_now !== undefined
  );

  // Check for website (from snapshot raw or business)
  const hasWebsite = !!(raw.website || business?.google_maps_url);

  // Check for photos (from business image_url or snapshot raw)
  const hasPhotos = !!(
    business?.image_url ||
    (raw.photos && Array.isArray(raw.photos) && raw.photos.length > 0)
  );

  // Get competitor averages
  const { data: competitors } = await supabase
    .from('business_competitors')
    .select('rating_avg, reviews_total')
    .eq('business_place_id', businessId)
    .limit(10);

  let leaderAvgRating: number | null = null;
  let leaderAvgReviews: number | null = null;

  if (competitors && competitors.length > 0) {
    const validRatings = competitors
      .map((c: any) => c.rating_avg)
      .filter((r: any) => r !== null && r !== undefined);
    const validReviews = competitors
      .map((c: any) => c.reviews_total)
      .filter((r: any) => r !== null && r !== undefined);

    if (validRatings.length > 0) {
      leaderAvgRating = validRatings.reduce((sum: number, r: number) => sum + r, 0) / validRatings.length;
    }
    if (validReviews.length > 0) {
      leaderAvgReviews = validReviews.reduce((sum: number, r: number) => sum + r, 0) / validReviews.length;
    }
  }

  return {
    rating,
    userReviewCount,
    leaderAvgRating: leaderAvgRating !== null ? Math.round(leaderAvgRating * 10) / 10 : null,
    leaderAvgReviews: leaderAvgReviews !== null ? Math.round(leaderAvgReviews) : null,
    hasBusinessHours,
    hasWebsite,
    hasPhotos,
  };
}

