import { ApifyClient } from 'apify-client';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { storeGoogleReviewSnapshot } from './storeGoogleReviewSnapshot';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
  throw new Error('APIFY_TOKEN environment variable is not set');
}

export interface GoogleReviewSummary {
  negativeReviews: number;
  positiveReviews: number;
  daysSinceLastReview: number | null;
  totalReviews: number;
  reviewsDistribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
}

/**
 * Analyze Google reviews for a business using Apify
 * Returns a summary of review metrics
 */
export async function analyzeGoogleReviews(
  businessId: string,
  placeId: string
): Promise<GoogleReviewSummary | null> {
  console.log('[analyzeGoogleReviews] Starting analysis', { businessId, placeId });

  try {
    const client = new ApifyClient({ token: APIFY_TOKEN });

    // Prepare Actor input
    const input = {
      includeWebResults: false,
      maxCrawledPlacesPerSearch: 5,
      maxImages: 5,
      maxReviews: 50,
      maximumLeadsEnrichmentRecords: 5,
      placeIds: [placeId],
      scrapeContacts: false,
      scrapeDirectories: false,
      scrapeImageAuthors: false,
      scrapePlaceDetailPage: true,
      scrapeReviewsPersonalData: true,
      scrapeTableReservationProvider: false,
      searchMatching: 'all',
      skipClosedPlaces: false,
      website: 'allPlaces',
      language: 'en',
      placeMinimumStars: '',
      maxQuestions: 0,
      reviewsSort: 'newest',
      reviewsFilterString: '',
      reviewsOrigin: 'all',
      allPlacesNoSearchAction: '',
    };

    console.log('[analyzeGoogleReviews] Calling Apify actor', { placeId });

    // Run the Actor and wait for it to finish
    const run = await client.actor('nwua9Gu5YrADL7ZDj').call(input);

    console.log('[analyzeGoogleReviews] Apify run completed', {
      runId: run.id,
      status: run.status,
      defaultDatasetId: run.defaultDatasetId,
    });

    // Fetch results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn('[analyzeGoogleReviews] No items returned from Apify');
      return null;
    }

    // Find the place data (first item should be the place details)
    const placeData = items.find((item: any) => item.placeId === placeId) || items[0];

    if (!placeData) {
      console.warn('[analyzeGoogleReviews] Place data not found in results');
      return null;
    }

    console.log('[analyzeGoogleReviews] Place data found', {
      title: placeData.title,
      reviewsCount: placeData.reviewsCount,
      hasReviewsDistribution: !!placeData.reviewsDistribution,
    });

    // Extract reviews from the items
    // Reviews might be:
    // 1. Nested in placeData.reviews (array)
    // 2. Separate items in the dataset (identified by having reviewId or stars)
    let reviews: any[] = [];
    
    // First, check if reviews are nested in placeData
    if (placeData.reviews && Array.isArray(placeData.reviews) && placeData.reviews.length > 0) {
      reviews = placeData.reviews;
      console.log('[analyzeGoogleReviews] Found reviews nested in placeData', {
        reviewsCount: reviews.length,
      });
    } else {
      // Otherwise, extract from items array (exclude the place data item itself)
      reviews = items.filter((item: any) => {
        // Skip the place data item
        if (item.placeId === placeId && item.title) {
          return false;
        }
        // Include items that look like reviews
        return item.reviewId || 
          (item.stars !== undefined && item.stars !== null) ||
          (item.reviewerId && item.publishedAtDate);
      });
      console.log('[analyzeGoogleReviews] Found reviews as separate items', {
        reviewsCount: reviews.length,
      });
    }

    console.log('[analyzeGoogleReviews] Reviews found', {
      totalReviews: reviews.length,
      placeReviewsCount: placeData.reviewsCount,
      sampleReview: reviews.length > 0 ? {
        reviewId: reviews[0].reviewId,
        publishedAtDate: reviews[0].publishedAtDate,
        stars: reviews[0].stars,
        reviewerId: reviews[0].reviewerId,
      } : null,
      allItemTypes: items.map((item: any) => ({
        hasPlaceId: !!item.placeId,
        hasReviewId: !!item.reviewId,
        hasStars: item.stars !== undefined,
        hasPublishedAtDate: !!item.publishedAtDate,
        hasTitle: !!item.title,
      })),
    });

    // Calculate metrics
    const now = Date.now();
    const reviewsDistribution = placeData.reviewsDistribution || {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0,
    };

    // Count negative (1-2 stars) and positive (4-5 stars) reviews
    const negativeReviews = reviewsDistribution.oneStar + reviewsDistribution.twoStar;
    const positiveReviews = reviewsDistribution.fourStar + reviewsDistribution.fiveStar;
    const totalReviews = placeData.reviewsCount || reviews.length;

    // Find most recent review
    let daysSinceLastReview: number | null = null;
    if (reviews.length > 0) {
      // Sort reviews by published date (most recent first)
      // Try publishedAtDate first, then publishAt as fallback
      const sortedReviews = [...reviews].sort((a, b) => {
        const dateA = a.publishedAtDate 
          ? new Date(a.publishedAtDate).getTime() 
          : (a.publishAt ? new Date(a.publishAt).getTime() : 0);
        const dateB = b.publishedAtDate 
          ? new Date(b.publishedAtDate).getTime() 
          : (b.publishAt ? new Date(b.publishAt).getTime() : 0);
        return dateB - dateA;
      });

      const mostRecentReview = sortedReviews[0];
      console.log('[analyzeGoogleReviews] Most recent review', {
        reviewId: mostRecentReview.reviewId,
        publishedAtDate: mostRecentReview.publishedAtDate,
        publishAt: mostRecentReview.publishAt,
        hasPublishedAtDate: !!mostRecentReview.publishedAtDate,
        hasPublishAt: !!mostRecentReview.publishAt,
      });

      const reviewDate = mostRecentReview?.publishedAtDate 
        ? new Date(mostRecentReview.publishedAtDate).getTime()
        : (mostRecentReview?.publishAt ? new Date(mostRecentReview.publishAt).getTime() : null);
      
      console.log('[analyzeGoogleReviews] Review date calculation', {
        reviewDate,
        reviewDateString: reviewDate ? new Date(reviewDate).toISOString() : null,
        now,
        nowString: new Date(now).toISOString(),
        isValidDate: reviewDate && !isNaN(reviewDate),
      });
      
      if (reviewDate && !isNaN(reviewDate)) {
        const daysDiff = Math.floor((now - reviewDate) / (1000 * 60 * 60 * 24));
        daysSinceLastReview = daysDiff;
        console.log('[analyzeGoogleReviews] Days since last review calculated', {
          daysSinceLastReview,
          reviewDate: new Date(reviewDate).toISOString(),
          now: new Date(now).toISOString(),
        });
      } else {
        console.warn('[analyzeGoogleReviews] Could not parse review date', {
          publishedAtDate: mostRecentReview?.publishedAtDate,
          publishAt: mostRecentReview?.publishAt,
        });
      }
    } else {
      console.warn('[analyzeGoogleReviews] No reviews found to calculate days since last review', {
        itemsCount: items.length,
        placeDataHasReviews: !!placeData.reviews,
        placeDataReviewsCount: placeData.reviewsCount,
      });
    }

    const summary: GoogleReviewSummary = {
      negativeReviews,
      positiveReviews,
      daysSinceLastReview,
      totalReviews,
      reviewsDistribution,
    };

    console.log('[analyzeGoogleReviews] Summary calculated', summary);

    // Store snapshot in database
    const supabase = createServiceRoleClient();
    await storeGoogleReviewSnapshot(supabase, {
      business_id: businessId,
      negative_reviews: negativeReviews,
      positive_reviews: positiveReviews,
      days_since_last_review: daysSinceLastReview,
      total_reviews: totalReviews,
      reviews_distribution: reviewsDistribution,
      raw_data: {
        placeData,
        reviews,
        items,
      },
    });

    console.log('[analyzeGoogleReviews] Snapshot stored successfully');

    return summary;
  } catch (error: any) {
    console.error('[analyzeGoogleReviews] Error analyzing Google reviews', {
      error: error.message,
      stack: error.stack,
      businessId,
      placeId,
    });
    throw error;
  }
}

