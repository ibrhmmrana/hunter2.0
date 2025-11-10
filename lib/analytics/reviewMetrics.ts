/**
 * Calculate and store Google Business Profile review metrics.
 * 
 * Server-side only.
 */

import { PlaceDetails } from "@/lib/google/places";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ReviewMetrics {
  reviews_total: number | null;
  rating_avg: number | null;
  positive_reviews_count: number | null;
  negative_reviews_count: number | null;
  days_since_last_review: number | null;
  last_review_date: string | null;
}

/**
 * Calculate review metrics from place details.
 * 
 * Note: Google Places API only returns a limited number of reviews (typically 5),
 * so we can only accurately calculate "days since last review" from those.
 * We cannot accurately calculate positive/negative counts from the limited sample.
 */
export function calculateReviewMetrics(
  placeDetails: PlaceDetails,
  snapshotTs: string
): ReviewMetrics {
  const reviews = placeDetails.reviews || [];
  const reviewsTotal = placeDetails.user_ratings_total ?? null;
  const ratingAvg = placeDetails.rating ?? null;

  // Find the most recent review timestamp from the reviews array
  // Note: Google Places API typically returns reviews sorted by relevance, not date
  // We need to check all reviews to find the most recent one
  let lastReviewTime: number | null = null;
  let lastReviewRelativeTime: string | null = null;

  for (const review of reviews) {
    // Track the most recent review timestamp
    if (review.time) {
      if (lastReviewTime === null || review.time > lastReviewTime) {
        lastReviewTime = review.time;
        lastReviewRelativeTime = review.relative_time_description || null;
      }
    }
  }

  // Calculate days since last review
  let daysSinceLastReview: number | null = null;
  let lastReviewDate: string | null = null;

  if (lastReviewTime !== null) {
    const lastReviewDateObj = new Date(lastReviewTime * 1000); // Convert seconds to milliseconds
    lastReviewDate = lastReviewDateObj.toISOString();
    
    // Use current time instead of snapshot time for more accurate calculation
    const now = new Date();
    const diffMs = now.getTime() - lastReviewDateObj.getTime();
    daysSinceLastReview = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    
    // Log for debugging (can be removed later)
    console.log(`[reviewMetrics] Last review calculation:`, {
      lastReviewTime,
      lastReviewDate: lastReviewDateObj.toISOString(),
      relativeTime: lastReviewRelativeTime,
      daysSinceLastReview,
      totalReviews: reviewsTotal,
      reviewsInSample: reviews.length,
    });
  }

  // We cannot accurately calculate positive/negative counts from the limited sample
  // Google Places API only returns ~5 reviews, but there may be hundreds total
  // Return null for these fields since we don't have accurate data
  return {
    reviews_total: reviewsTotal,
    rating_avg: ratingAvg,
    positive_reviews_count: null, // Cannot calculate accurately from limited sample
    negative_reviews_count: null, // Cannot calculate accurately from limited sample
    days_since_last_review: daysSinceLastReview,
    last_review_date: lastReviewDate,
  };
}

/**
 * Store review metrics in the database.
 */
export async function storeReviewMetrics(
  supabase: SupabaseClient,
  businessPlaceId: string,
  snapshotTs: string,
  metrics: ReviewMetrics
): Promise<void> {
  try {
    const { error } = await supabase
      .from("business_review_metrics")
      .upsert(
        {
          business_place_id: businessPlaceId,
          snapshot_ts: snapshotTs,
          reviews_total: metrics.reviews_total,
          rating_avg: metrics.rating_avg,
          positive_reviews_count: metrics.positive_reviews_count,
          negative_reviews_count: metrics.negative_reviews_count,
          days_since_last_review: metrics.days_since_last_review,
          last_review_date: metrics.last_review_date,
        },
        {
          onConflict: "business_place_id,snapshot_ts",
        }
      );

    if (error) {
      console.error(`[reviewMetrics] Error storing metrics for ${businessPlaceId}:`, error);
      throw error;
    }

    console.log(`[reviewMetrics] Stored metrics for ${businessPlaceId} at ${snapshotTs}`);
  } catch (error: any) {
    console.error(`[reviewMetrics] Failed to store metrics:`, error);
    // Don't throw - this is not critical for the snapshot process
  }
}

/**
 * Get the latest review metrics for a business.
 */
export async function getLatestReviewMetrics(
  supabase: SupabaseClient,
  businessPlaceId: string
): Promise<ReviewMetrics | null> {
  try {
    const { data, error } = await supabase
      .from("business_review_metrics")
      .select("*")
      .eq("business_place_id", businessPlaceId)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error(`[reviewMetrics] Error fetching metrics for ${businessPlaceId}:`, error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      reviews_total: data.reviews_total,
      rating_avg: data.rating_avg,
      positive_reviews_count: data.positive_reviews_count,
      negative_reviews_count: data.negative_reviews_count,
      days_since_last_review: data.days_since_last_review,
      last_review_date: data.last_review_date,
    };
  } catch (error: any) {
    console.error(`[reviewMetrics] Failed to fetch metrics:`, error);
    return null;
  }
}

