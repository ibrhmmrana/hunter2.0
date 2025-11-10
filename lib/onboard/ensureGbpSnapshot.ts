/**
 * Ensure a GBP snapshot is up to date for a business.
 * 
 * Server-side only. Fetches from Google Places API and writes to snapshots_gbp.
 * Idempotent: skips if snapshot is recent (within last 6 hours).
 */

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPlaceDetails } from "@/lib/google/places";
import { placePhotoUrl } from "@/lib/google/photos";
import { calculateReviewMetrics, storeReviewMetrics } from "@/lib/analytics/reviewMetrics";

const FRESH_HOURS = 6; // Consider snapshot fresh if less than 6 hours old

export async function ensureGbpSnapshotUpToDate(
  businessPlaceId: string
): Promise<void> {
  const supabase = createServiceRoleClient();

  try {
    // Check if we have a recent snapshot
    const { data: existingSnapshot } = await supabase
      .from("snapshots_gbp")
      .select("snapshot_ts")
      .eq("business_place_id", businessPlaceId)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSnapshot?.snapshot_ts) {
      const snapshotDate = new Date(existingSnapshot.snapshot_ts);
      const now = new Date();
      const diffMs = now.getTime() - snapshotDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < FRESH_HOURS) {
        console.log(
          `Snapshot for ${businessPlaceId} is fresh (${diffHours.toFixed(1)}h old), skipping`
        );
        return; // Already fresh, skip
      }
    }

    // Fetch business to get lat/lng if needed
    const { data: business } = await supabase
      .from("businesses")
      .select("place_id, name, lat, lng")
      .eq("place_id", businessPlaceId)
      .maybeSingle();

    if (!business) {
      console.warn(`Business ${businessPlaceId} not found, skipping snapshot`);
      return;
    }

    // Fetch place details from Google
    const placeDetails = await getPlaceDetails(businessPlaceId);

    if (!placeDetails) {
      console.warn(`Could not fetch place details for ${businessPlaceId}`);
      return;
    }

    // Build image URL from photo reference if available
    let imageUrl: string | null = null;
    if (placeDetails.photo_reference) {
      imageUrl = placePhotoUrl(placeDetails.photo_reference, { maxWidth: 800 });
    } else if (placeDetails.photos && placeDetails.photos.length > 0) {
      // Use first photo reference if available
      const firstPhotoRef = placeDetails.photos[0];
      if (typeof firstPhotoRef === 'string') {
        imageUrl = placePhotoUrl(firstPhotoRef, { maxWidth: 800 });
      }
    }

    // Build snapshot data
    const now = new Date().toISOString();
    const snapshotData: any = {
      business_place_id: businessPlaceId,
      snapshot_ts: now,
      rating_avg: placeDetails.rating ?? null,
      reviews_total: placeDetails.user_ratings_total ?? null,
      raw: {
        name: placeDetails.name,
        rating: placeDetails.rating,
        user_ratings_total: placeDetails.user_ratings_total,
        types: placeDetails.types || [],
        photo_reference: placeDetails.photo_reference,
        photos: placeDetails.photos || [],
        opening_hours: placeDetails.opening_hours,
        current_opening_hours: placeDetails.current_opening_hours,
        editorial_summary: placeDetails.editorial_summary,
      },
    };

    // Insert snapshot
    const { error: insertError } = await supabase
      .from("snapshots_gbp")
      .insert(snapshotData);

    if (insertError) {
      console.error(`Error inserting snapshot for ${businessPlaceId}:`, insertError);
      throw new Error(`Failed to insert snapshot: ${insertError.message}`);
    }

    console.log(`Snapshot created for ${businessPlaceId}`);

    // Update businesses table with image_url and latest rating/reviews if we have them
    if (imageUrl || placeDetails.rating !== undefined || placeDetails.user_ratings_total !== undefined) {
      const businessUpdate: any = {};
      if (imageUrl) {
        businessUpdate.image_url = imageUrl;
      }
      if (placeDetails.rating !== undefined) {
        businessUpdate.rating = placeDetails.rating;
      }
      if (placeDetails.user_ratings_total !== undefined) {
        businessUpdate.reviews_count = placeDetails.user_ratings_total;
      }

      if (Object.keys(businessUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from("businesses")
          .update(businessUpdate)
          .eq("place_id", businessPlaceId);

        if (updateError) {
          console.warn(`[ensureGbpSnapshot] Failed to update business image_url for ${businessPlaceId}:`, updateError);
          // Don't throw - this is not critical
        } else {
          console.log(`[ensureGbpSnapshot] Updated business image_url for ${businessPlaceId}`);
        }
      }
    }

    // Calculate and store review metrics
    try {
      const metrics = calculateReviewMetrics(placeDetails, now);
      await storeReviewMetrics(supabase, businessPlaceId, now, metrics);
    } catch (error) {
      // Log but don't fail the snapshot process if metrics calculation fails
      console.warn(`[ensureGbpSnapshot] Failed to store review metrics for ${businessPlaceId}:`, error);
    }
  } catch (error: any) {
    console.error(`Error ensuring snapshot for ${businessPlaceId}:`, error);
    throw error;
  }
}


