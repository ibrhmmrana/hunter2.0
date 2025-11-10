/**
 * Server-side competitor sync pipeline.
 * 
 * Finds competitors for a business using AI-generated search phrases and
 * Google Places API, then upserts them into business_competitors table.
 * 
 * This function is idempotent and safe to call multiple times.
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import { searchPlacesNearby, getPlaceDistanceMeters, type NormalizedPlaceResult } from '@/lib/google/places';
import { generateShortReasons } from '@/lib/competitors/relevance';
import { getAnchorCategoryTokens, matchesCategoryAnchor } from '@/lib/competitors/matchCategory';

interface BusinessRow {
  place_id: string;
  owner_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  country_code: string | null;
  primary_category?: string | null;
  category?: string | null;
  categories?: string[] | null;
  rating?: number | null;
  reviews_count?: number | null;
  total_score?: number | null;
}

interface SnapshotRow {
  business_place_id: string;
  rating_avg: number | null;
  reviews_total: number | null;
}

interface CompetitorCandidate extends NormalizedPlaceResult {
  distance_m: number;
  is_stronger: boolean;
}

interface CompetitorRow {
  business_place_id: string;
  competitor_place_id: string;
  name: string;
  rating_avg: number | null;
  reviews_total: number | null;
  distance_m: number;
  is_stronger: boolean;
  snapshot_ts: string;
  raw?: Record<string, unknown>;
}


/**
 * Sync competitors for a business.
 * 
 * @param businessPlaceId The place_id of the business to find competitors for
 */
export async function syncCompetitorsForBusiness(
  businessPlaceId: string
): Promise<void> {
  const supabase = createServiceRoleClient();

  console.log('[competitors] start', { businessPlaceId });

  try {
    // 1. Fetch base business + stats
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('place_id, owner_id, name, lat, lng, city, country_code, primary_category, category, categories, rating, reviews_count, total_score')
      .eq('place_id', businessPlaceId)
      .maybeSingle();

    if (businessError) {
      console.error('[competitors] error fetching business', { businessPlaceId, error: businessError.message });
      throw new Error(`Failed to fetch business: ${businessError.message}`);
    }

    if (!business) {
      console.error('[competitors] business not found', { businessPlaceId });
      throw new Error(`Business not found: ${businessPlaceId}`);
    }

    const businessData = business as BusinessRow;

    if (!businessData.lat || !businessData.lng) {
      console.warn('[competitors] missing coordinates', { businessPlaceId, lat: businessData.lat, lng: businessData.lng });
      return;
    }

    // Get latest snapshot (including raw for potential types)
    const { data: snapshot, error: snapshotError } = await supabase
      .from('snapshots_gbp')
      .select('business_place_id, rating_avg, reviews_total, raw')
      .eq('business_place_id', businessPlaceId)
      .order('snapshot_ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      console.error('Error fetching snapshot:', snapshotError);
      throw new Error(`Failed to fetch snapshot: ${snapshotError.message}`);
    }

    // Determine rating and reviews from snapshot or fallback to business table
    let rating_avg: number | null = null;
    let reviews_total: number | null = null;

    if (snapshot && snapshot.rating_avg !== null && snapshot.rating_avg !== undefined && 
        snapshot.reviews_total !== null && snapshot.reviews_total !== undefined) {
      rating_avg = snapshot.rating_avg;
      reviews_total = snapshot.reviews_total;
    } else if (businessData.rating !== null && businessData.rating !== undefined &&
               businessData.reviews_count !== null && businessData.reviews_count !== undefined) {
      rating_avg = businessData.rating;
      reviews_total = businessData.reviews_count;
      console.log(`[Competitor Sync] Using business table metrics as fallback for ${businessPlaceId}: rating=${rating_avg}, reviews=${reviews_total}`);
    } else if (businessData.total_score !== null && businessData.total_score !== undefined &&
               businessData.reviews_count !== null && businessData.reviews_count !== undefined) {
      rating_avg = businessData.total_score;
      reviews_total = businessData.reviews_count;
      console.log(`[Competitor Sync] Using business table metrics (total_score) as fallback for ${businessPlaceId}: rating=${rating_avg}, reviews=${reviews_total}`);
    }

    // If we still don't have metrics, apply minimum thresholds
    const baseRating = rating_avg ?? 0;
    const baseReviews = reviews_total ?? 0;

    // 2. Get anchor category - normalize from business data
    // Build top categories array from available sources
    const topCategories: string[] = [];
    if (businessData.primary_category) {
      topCategories.push(businessData.primary_category);
    }
    if (businessData.category && businessData.category !== businessData.primary_category) {
      topCategories.push(businessData.category);
    }
    if (Array.isArray(businessData.categories)) {
      for (const cat of businessData.categories) {
        if (cat && !topCategories.includes(cat)) {
          topCategories.push(cat);
        }
      }
    }

    // Pick a stable anchor category
    const anchorCategory =
      topCategories[0] ??
      businessData.primary_category ??
      businessData.category ??
      null;

    // 3. Get anchor category tokens for matching (if we have a category)
    let anchor = {
      anchorLabel: null as string | null,
      allowedTypes: [] as string[],
      keywordTokens: [] as string[],
    };
    
    if (anchorCategory) {
      anchor = getAnchorCategoryTokens(anchorCategory);
      console.log('[competitors] anchor category', { 
        businessPlaceId, 
        anchorCategory,
        anchorLabel: anchor.anchorLabel,
        allowedTypes: anchor.allowedTypes,
        keywordTokens: anchor.keywordTokens
      });
    } else {
      console.log('[competitors] no anchorCategory, will use TIER 4 (no category filter)', {
        businessPlaceId,
        topCategories,
        primary_category: businessData.primary_category,
        category: businessData.category,
        categories: businessData.categories,
        });
    }

    // 4. Search for candidates using a broad keyword search
    // We'll filter by category anchor match (or use score-based if no category)
    let allCandidates: NormalizedPlaceResult[] = [];
    
    // Use the category label as keyword if available, otherwise use a generic search
    const searchKeyword = anchor.anchorLabel || anchorCategory || 'business';
    
    try {
      const results = await searchPlacesNearby({
        lat: businessData.lat!,
        lng: businessData.lng!,
        radiusMeters: 6000,
        keyword: searchKeyword,
      });
      
      allCandidates = results;
      console.log('[competitors] search results', { 
        businessPlaceId, 
        searchKeyword, 
        rawCount: results.length 
      });
    } catch (error: any) {
      console.error('[competitors] search error', { businessPlaceId, searchKeyword, error: error.message });
      throw error;
    }
    
    // Initialize variables for tiered selection
    let finalCompetitors: CompetitorCandidate[] = [];
    let selectedTier = 0;
    
    // 5. Filter candidates with tiered fallback approach
    // If no anchor category, skip directly to TIER 4 (score-based, no category filter)
    if (!anchorCategory) {
      // TIER 4: No category filter, score-based selection
      const scored: Array<CompetitorCandidate & { score: number }> = [];
      
      for (const candidate of allCandidates) {
        // Skip self
        if (candidate.place_id === businessPlaceId) {
          continue;
        }

        // Skip closed businesses
        if ((candidate as any).business_status && (candidate as any).business_status !== 'OPERATIONAL') {
          continue;
        }

        // Calculate distance
        const distance_m = getPlaceDistanceMeters(
          { lat: businessData.lat!, lng: businessData.lng! },
          { lat: candidate.lat, lng: candidate.lng }
        );
        
        // Hard filter: distance (always 6km)
        if (!distance_m || distance_m > 6000) {
          continue;
        }
        
        // Score: rating * 0.7 + log1p(reviews) * 0.3
        const candidateRating = candidate.rating ?? 0;
        const candidateReviews = candidate.user_ratings_total ?? 0;
        const score = (candidateRating * 0.7) + (Math.log1p(candidateReviews) * 0.3);
        
        const is_stronger = candidateRating >= baseRating && candidateReviews >= baseReviews;
        
        scored.push({
          ...candidate,
          distance_m: Math.round(distance_m),
          is_stronger,
          score,
        });
    }

      // Sort by score descending, take top 6
      finalCompetitors = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score, ...rest }) => rest);
      selectedTier = 4;
      
      console.log('[competitors] TIER 4 selected (no anchor category, score-based)', { 
        count: finalCompetitors.length
      });
    } else {
      // We have an anchor category - use tiered selection
      // Helper to check if candidate passes filters for a given tier
      const filterCandidates = (
      candidates: NormalizedPlaceResult[],
      tier: number,
      categoryMatch: (c: NormalizedPlaceResult) => boolean,
      ratingThreshold: number,
      reviewsThreshold: number
    ): CompetitorCandidate[] => {
      const filtered: CompetitorCandidate[] = [];
      
      for (const candidate of candidates) {
        // Skip self
      if (candidate.place_id === businessPlaceId) {
        continue;
      }
        
        // Skip closed businesses
        if ((candidate as any).business_status && (candidate as any).business_status !== 'OPERATIONAL') {
          continue;
        }
        
        // Category filter (varies by tier)
        if (!categoryMatch(candidate)) {
          continue;
        }

      // Calculate distance
      const distance_m = getPlaceDistanceMeters(
        { lat: businessData.lat!, lng: businessData.lng! },
        { lat: candidate.lat, lng: candidate.lng }
      );

        // Hard filter: distance (always 6km)
        if (!distance_m || distance_m > 6000) {
        continue;
      }

        // Rating / reviews thresholds (vary by tier)
        const candidateRating = candidate.rating ?? 0;
        const candidateReviews = candidate.user_ratings_total ?? 0;
        
        if (candidateRating < ratingThreshold || candidateReviews < reviewsThreshold) {
        continue;
      }

        // All filters passed
        const is_stronger = candidateRating >= baseRating && candidateReviews >= baseReviews;
        
        filtered.push({
          ...candidate,
          distance_m: Math.round(distance_m),
          is_stronger,
        });
      }
      
      return filtered;
    };
    
    // TIER 0: Strict (same category, rating >= user, reviews >= user)
    finalCompetitors = filterCandidates(
        allCandidates,
        0,
        (c) => matchesCategoryAnchor({ types: c.types, name: c.name }, anchor),
        baseRating,
        baseReviews
      );
      selectedTier = 0;
    
    if (finalCompetitors.length > 0) {
      console.log('[competitors] TIER 0 selected', { count: finalCompetitors.length });
    } else {
        // TIER 1: Same category, rating >= user, reviews >= max(10, userReviews * 0.5)
        const tier1ReviewsThreshold = Math.max(10, Math.floor(baseReviews * 0.5));
        finalCompetitors = filterCandidates(
          allCandidates,
          1,
          (c) => matchesCategoryAnchor({ types: c.types, name: c.name }, anchor),
          baseRating,
          tier1ReviewsThreshold
        );
        selectedTier = 1;
      
      if (finalCompetitors.length > 0) {
        console.log('[competitors] TIER 1 selected (relaxed reviews)', { 
          count: finalCompetitors.length,
          reviewsThreshold: tier1ReviewsThreshold 
        });
        } else {
          // TIER 2: Same category, rating >= (userRating - 0.3), reviews >= max(5, userReviews * 0.3)
          const tier2RatingThreshold = Math.max(0, baseRating - 0.3);
          const tier2ReviewsThreshold = Math.max(5, Math.floor(baseReviews * 0.3));
          finalCompetitors = filterCandidates(
            allCandidates,
            2,
            (c) => matchesCategoryAnchor({ types: c.types, name: c.name }, anchor),
            tier2RatingThreshold,
            tier2ReviewsThreshold
          );
          selectedTier = 2;
        
        if (finalCompetitors.length > 0) {
          console.log('[competitors] TIER 2 selected (relaxed rating & reviews)', { 
            count: finalCompetitors.length,
            ratingThreshold: tier2RatingThreshold,
            reviewsThreshold: tier2ReviewsThreshold
          });
          } else {
            // TIER 3: Similar categories, rating >= (userRating - 0.5), reviews >= 5
            // For similar categories, we check if types overlap with anchor's allowed types
            const tier3RatingThreshold = Math.max(0, baseRating - 0.5);
            finalCompetitors = filterCandidates(
              allCandidates,
              3,
              (c) => {
                // Check if candidate types overlap with anchor's allowed types (similar category)
                const candidateTypes = (c.types || []).map(t => t.toLowerCase());
                const anchorTypes = anchor.allowedTypes.map(t => t.toLowerCase());
                return candidateTypes.some(ct => anchorTypes.includes(ct));
              },
              tier3RatingThreshold,
              5
            );
            selectedTier = 3;
          
          if (finalCompetitors.length > 0) {
            console.log('[competitors] TIER 3 selected (similar categories)', { 
              count: finalCompetitors.length,
              ratingThreshold: tier3RatingThreshold
            });
            } else {
              // TIER 4: No category filter, score-based selection
              const scored: Array<CompetitorCandidate & { score: number }> = [];
              
              for (const candidate of allCandidates) {
                // Skip self
                if (candidate.place_id === businessPlaceId) {
        continue;
      }

                // Skip closed businesses
                if ((candidate as any).business_status && (candidate as any).business_status !== 'OPERATIONAL') {
        continue;
      }

                // Calculate distance
                const distance_m = getPlaceDistanceMeters(
                  { lat: businessData.lat!, lng: businessData.lng! },
                  { lat: candidate.lat, lng: candidate.lng }
                );
                
                // Hard filter: distance (always 6km)
                if (!distance_m || distance_m > 6000) {
          continue;
        }
                
                // Score: rating * 0.7 + log1p(reviews) * 0.3
                const candidateRating = candidate.rating ?? 0;
                const candidateReviews = candidate.user_ratings_total ?? 0;
                const score = (candidateRating * 0.7) + (Math.log1p(candidateReviews) * 0.3);
                
                const is_stronger = candidateRating >= baseRating && candidateReviews >= baseReviews;

                scored.push({
        ...candidate,
                  distance_m: Math.round(distance_m),
        is_stronger,
                  score,
      });
    }

              // Sort by score descending, take top 6
              finalCompetitors = scored
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
                .map(({ score, ...rest }) => rest);
              selectedTier = 4;
              
              console.log('[competitors] TIER 4 selected (score-based, no category filter)', { 
                count: finalCompetitors.length
              });
      }
          }
        }
      }
    }
    
    // 6. Sort & cap at 6 (final sort by quality metrics)
    finalCompetitors = finalCompetitors
      .sort((a, b) => {
        // Sort by: 1) higher rating, 2) more reviews, 3) closer distance
        if ((b.rating || 0) !== (a.rating || 0)) {
        return (b.rating || 0) - (a.rating || 0);
      }
        if ((b.user_ratings_total || 0) !== (a.user_ratings_total || 0)) {
          return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
        }
      return a.distance_m - b.distance_m;
      })
      .slice(0, 6);

    console.log('[competitors] final selection', {
      businessPlaceId,
      anchorCategory,
      count: finalCompetitors.length,
      competitors: finalCompetitors.map(c => ({
        name: c.name,
        distance_m: c.distance_m,
        rating: c.rating ?? null,
        reviews: c.user_ratings_total ?? null,
      })),
    });

    // 7. Prepare upsert payload
    const now = new Date().toISOString();
    const rowsToInsert: CompetitorRow[] = finalCompetitors.map((comp) => {
      // Generate short reasons why this competitor is ahead
      const reasons = generateShortReasons(
        {
          name: businessData.name,
          primary_category: businessData.primary_category,
          category: businessData.category,
          categories: businessData.categories,
          rating_avg: rating_avg,
          reviews_total: reviews_total,
        },
        comp,
        rating_avg,
        reviews_total
      );

      return {
      business_place_id: businessPlaceId,
      competitor_place_id: comp.place_id,
      name: comp.name,
      rating_avg: comp.rating ?? null,
      reviews_total: comp.user_ratings_total ?? null,
      distance_m: comp.distance_m,
      is_stronger: comp.is_stronger,
      snapshot_ts: now,
      raw: {
        lat: comp.lat,
        lng: comp.lng,
        photo_reference: comp.photo_reference,
          types: comp.types,
          reasons_short: reasons,
          matched_category: anchor.anchorLabel,
          match_tier: selectedTier, // Store match tier for debugging
      },
      };
    });

    // 8. Replace existing competitors (delete then insert)
    const { error: deleteError } = await supabase
      .from('business_competitors')
      .delete()
      .eq('business_place_id', businessPlaceId);

    if (deleteError) {
      console.error('Error deleting existing competitors:', deleteError);
      throw new Error(`Failed to delete existing competitors: ${deleteError.message}`);
    }

    // Insert new rows - only send known, safe columns
    if (rowsToInsert.length > 0) {
      const competitorsPayload = rowsToInsert.map(row => ({
        business_place_id: row.business_place_id,
        competitor_place_id: row.competitor_place_id,
        name: row.name,
        rating_avg: row.rating_avg,
        reviews_total: row.reviews_total,
        distance_m: row.distance_m,
        is_stronger: row.is_stronger,
        snapshot_ts: row.snapshot_ts,
        raw: row.raw ?? null,
      }));

      console.log('[competitors] upsert sample', {
        businessPlaceId,
        count: competitorsPayload.length,
        sampleRowKeys: competitorsPayload[0] ? Object.keys(competitorsPayload[0]) : [],
      });

      const { error: insertError } = await supabase
        .from('business_competitors')
        .insert(competitorsPayload);

      if (insertError) {
        console.error('[competitors] upsert error', {
          businessPlaceId,
          error: insertError.message,
          code: insertError.code,
        });
        throw new Error(`Failed to insert competitors: ${insertError.message}`);
      }
    }

    console.log('[competitors] sync complete', { businessPlaceId, count: rowsToInsert.length });
  } catch (error: any) {
    console.error('[competitors] syncCompetitorsForBusiness failed:', {
      businessPlaceId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
