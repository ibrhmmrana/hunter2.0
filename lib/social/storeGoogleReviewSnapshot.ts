import { SupabaseClient } from '@supabase/supabase-js';

export interface GoogleReviewSnapshotData {
  business_id: string;
  negative_reviews: number;
  positive_reviews: number;
  days_since_last_review: number | null;
  total_reviews: number;
  reviews_distribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
  raw_data: any;
}

/**
 * Store Google review snapshot in the database
 */
export async function storeGoogleReviewSnapshot(
  supabase: SupabaseClient,
  data: GoogleReviewSnapshotData
): Promise<void> {
  const now = new Date().toISOString();

  const insertPayload = {
    business_id: data.business_id,
    snapshot_ts: now,
    negative_reviews: data.negative_reviews,
    positive_reviews: data.positive_reviews,
    days_since_last_review: data.days_since_last_review !== null ? Math.floor(data.days_since_last_review) : null,
    total_reviews: data.total_reviews,
    reviews_distribution: data.reviews_distribution,
    raw_data: data.raw_data,
  };

  console.log(`[storeGoogleReviewSnapshot] Inserting Google review snapshot`, {
    business_id: insertPayload.business_id,
    negative_reviews: insertPayload.negative_reviews,
    positive_reviews: insertPayload.positive_reviews,
    days_since_last_review: insertPayload.days_since_last_review,
    total_reviews: insertPayload.total_reviews,
    has_raw_data: !!insertPayload.raw_data,
  });

  const { data: insertedData, error } = await supabase
    .from('google_review_snapshots')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error(`[storeGoogleReviewSnapshot] ❌ Failed to store Google review snapshot`, {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      business_id: data.business_id,
    });
    throw error;
  }

  console.log(`[storeGoogleReviewSnapshot] ✅ Stored Google review snapshot`, {
    id: insertedData?.id,
    business_id: data.business_id,
    snapshot_ts: now,
    negative_reviews: data.negative_reviews,
    positive_reviews: data.positive_reviews,
    days_since_last_review: data.days_since_last_review,
    total_reviews: data.total_reviews,
  });
}

