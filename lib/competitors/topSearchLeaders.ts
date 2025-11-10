/**
 * Top search ranking logic for "Who's beating you for your top search?" section.
 * 
 * This module generates a single high-intent Google search query and finds
 * businesses that rank above the user's business in the search results.
 */

import { getPrimaryRankingQueryForBusiness, getBroaderRankingQueryForBusiness } from "@/lib/ai/discoveryQueries";
import { textSearchPlacesForQuery, getPlaceDistanceMeters, getPlaceDetails } from "@/lib/google/places";

export type TopSearchLeader = {
  rank: number;
  place_id: string;
  name: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  distance_m?: number | null;
  photo_reference?: string | null;
  photos?: string[];
};

export type TopSearchResult = {
  query: string;
  leaders: TopSearchLeader[];
  userRank: number; // Always a number - never null
  heading?: string;
  isChasers?: boolean; // true if user is #1 and we're showing chasers
  stillNumberOne?: boolean; // true if business is #1 for all query variants
};

/**
 * Helper function to process search results and build leaders.
 * Returns the processed result with leaders, userRank, heading, and isChasers.
 */
async function processSearchResults(
  query: string,
  results: any[],
  business: {
    place_id: string;
    name: string;
    lat: number;
    lng: number;
  }
): Promise<{
  leaders: TopSearchLeader[];
  userRank: number; // Always a number - never null
  heading: string;
  isChasers: boolean;
}> {
  const { place_id, name, lat: userLat, lng: userLng } = business;

  // Find where the user's business appears in these results
  let userIndex = -1;
  
  // Try matching by place_id first
  const idx = results.findIndex(r => r.place_id === place_id);
  if (idx >= 0) {
    userIndex = idx;
    console.log('[topSearchLeaders] Found business by place_id', { placeId: place_id, index: idx });
  }

  // Fallback: Try matching by name + location if place_id didn't match
  if (userIndex === -1 && name) {
    console.log('[topSearchLeaders] Place_id match failed, trying name + location match');
    const businessNameLower = name.toLowerCase().trim();
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const resultNameLower = (result.name || '').toLowerCase().trim();
      
      // Check if names are similar (exact match or contains)
      const nameMatches = 
        resultNameLower === businessNameLower ||
        resultNameLower.includes(businessNameLower) ||
        businessNameLower.includes(resultNameLower);
      
      if (nameMatches && result.geometry?.location) {
        // Check if location is very close (within ~100m)
        const distance = getPlaceDistanceMeters(
          { lat: userLat, lng: userLng },
          { lat: result.geometry.location.lat, lng: result.geometry.location.lng }
        );
        
        if (distance !== null && distance < 100) {
          userIndex = i;
          console.log('[topSearchLeaders] Found business by name + location', {
            resultName: result.name,
            businessName: name,
            distance,
            index: i,
          });
          break;
        }
      }
    }
  }

  // Calculate user rank (1-based)
  // If not found in results, assign rank as results.length + 1 (beyond visible results)
  const userRank = userIndex >= 0 ? userIndex + 1 : results.length + 1;

  // Helper to build leader object with photos
  const buildLeader = async (p: any, idx: number, actualRank: number): Promise<TopSearchLeader> => {
    // Calculate distance if we have geometry
    const distance_m = p.geometry?.location
      ? getPlaceDistanceMeters(
          { lat: userLat, lng: userLng },
          { lat: p.geometry.location.lat, lng: p.geometry.location.lng }
        )
      : null;
    
    // Get photos from text search result (might only have 1)
    const textSearchPhotos = p.photos?.map((photo: any) => photo.photo_reference).filter(Boolean) || [];
    
    // If we only got 1 photo from text search, fetch place details to get all photos
    let allPhotos = textSearchPhotos;
    if (textSearchPhotos.length <= 1) {
      try {
        const placeDetails = await getPlaceDetails(p.place_id);
        if (placeDetails?.photos && placeDetails.photos.length > 0) {
          allPhotos = placeDetails.photos;
        }
      } catch (error) {
        console.warn(`[topSearchLeaders] Failed to fetch details for ${p.place_id}:`, error);
        // Continue with text search photos
      }
    }
    
    return {
      place_id: p.place_id,
      rank: actualRank, // Use actual rank from SERP
      name: p.name,
      rating: p.rating ?? null,
      user_ratings_total: p.user_ratings_total ?? null,
      photo_reference: allPhotos[0] || null,
      photos: allPhotos,
      distance_m: distance_m,
    };
  };

  // Build leaders based ONLY on SERP position (NO category, rating, or review filters)
  let leaders: TopSearchLeader[] = [];
  let heading: string;
  let isChasers = false;

  try {
    if (userRank === 1) {
      // Case A: userRank === 1 - show chasers (results 2-7)
      heading = `You're ranked #1 for your top search`;
      isChasers = true;
      // Show results at index 1-6 (ranks 2-7)
      const chaserPromises = results.slice(1, 7).map((p, idx) => buildLeader(p, idx + 1, idx + 2));
      leaders = await Promise.all(chaserPromises);
    } else if (userIndex >= 0) {
      // Case B: userRank > 1 and found in results - show leaders above user
      heading = `You're ranked #${userRank} for your top search`;
      const leaderPromises = results.slice(0, userIndex).map((p, idx) => buildLeader(p, idx, idx + 1));
      leaders = await Promise.all(leaderPromises);
      // Cap at 6
      leaders = leaders.slice(0, 6);
    } else {
      // Case C: Not found in top results - assign rank beyond visible results
      heading = `You're ranked #${userRank}+ for your top search`;
      // Show top 6 results as leaders
      const leaderPromises = results.slice(0, 6).map((p, idx) => buildLeader(p, idx, idx + 1));
      leaders = await Promise.all(leaderPromises);
    }
  } catch (leaderError) {
    console.error('[topSearchLeaders] Error building leaders', leaderError);
    // Return empty leaders array rather than failing completely
    leaders = [];
    heading = `You're ranked #${userRank} for your top search`;
  }

  return {
    leaders,
    userRank,
    heading,
    isChasers,
  };
}

/**
 * Check if search results contain meaningful leaders (at least one business that's not the user).
 */
function hasMeaningfulLeaders(
  results: any[],
  userIndex: number,
  userRank: number // Always a number - never null
): boolean {
  if (!results || results.length === 0) {
    return false;
  }

  // userRank is always a number now (never null)

  // If user is #1, we need at least 2 results (user + 1 chaser)
  if (userRank === 1) {
    return results.length >= 2;
  }

  // If user is ranked > 1, we need at least one result before the user
  return userIndex > 0;
}

/**
 * Extract suburb and city from a formatted address.
 * Returns an object with suburb and city, or null if unable to parse.
 */
function extractLocationParts(addr: string | null): { suburb: string | null; city: string | null } | null {
  if (!addr) return null;

  // Split on commas and clean
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean);

  // Filter out non-location parts (digits, country, street indicators)
  const locationParts = parts.filter(p => {
    const lower = p.toLowerCase();
    if (/\d/.test(lower)) return false;
    if (lower.includes('south africa')) return false;
    if (lower === 'za') return false;
    if (lower.match(/^(rd|st|street|road|ave|avenue|drive|dr|way|close|cl|place|pl)$/)) return false;
    return true;
  });

  if (locationParts.length >= 2) {
    const city = locationParts[locationParts.length - 1];
    const suburb = locationParts[locationParts.length - 2];
    return { suburb, city };
  }
  if (locationParts.length === 1) {
    return { suburb: null, city: locationParts[0] };
  }
  return null;
}

/**
 * Loosen a search query by removing location specificity.
 * Strategy:
 * 1. If query contains suburb + city, drop suburb → keep category + city
 * 2. If query only has city, try to drop city → keep just category
 * 3. If query is already minimal (single token or category only), return null (can't loosen further)
 * 
 * @param query The current search query
 * @param locationParts Parsed location info (suburb, city) from business address
 * @returns Loosened query, or null if cannot be loosened further
 */
function loosenQuery(query: string, locationParts: { suburb: string | null; city: string | null } | null): string | null {
  if (!query || query.trim().length === 0) {
    return null;
  }

  const tokens = query.trim().split(/\s+/).filter(Boolean);
  
  if (tokens.length <= 1) {
    // Already minimal - can't loosen further
    return null;
  }

  // If we have location parts, try to remove suburb first
  if (locationParts?.suburb && locationParts?.city) {
    const suburbLower = locationParts.suburb.toLowerCase();
    const cityLower = locationParts.city.toLowerCase();
    
    // Check if query contains both suburb and city
    const hasSuburb = tokens.some(t => t.toLowerCase() === suburbLower);
    const hasCity = tokens.some(t => t.toLowerCase() === cityLower);
    
    if (hasSuburb && hasCity) {
      // Remove suburb, keep city
      const loosened = tokens.filter(t => t.toLowerCase() !== suburbLower).join(' ');
      console.log('[topSearchQuery] Loosened query: removed suburb', {
        original: query,
        loosened,
        removedSuburb: locationParts.suburb,
      });
      return loosened;
    }
  }

  // If we have a city, try to remove it
  if (locationParts?.city) {
    const cityLower = locationParts.city.toLowerCase();
    const hasCity = tokens.some(t => t.toLowerCase() === cityLower);
    
    if (hasCity && tokens.length > 1) {
      // Remove city, keep category
      const loosened = tokens.filter(t => t.toLowerCase() !== cityLower).join(' ');
      console.log('[topSearchQuery] Loosened query: removed city', {
        original: query,
        loosened,
        removedCity: locationParts.city,
      });
      return loosened;
    }
  }

  // Fallback: if query has 3+ tokens, try removing the last token (often a location)
  if (tokens.length >= 3) {
    const loosened = tokens.slice(0, -1).join(' ');
    console.log('[topSearchQuery] Loosened query: removed last token', {
      original: query,
      loosened,
      removedToken: tokens[tokens.length - 1],
    });
    return loosened;
  }

  // Can't loosen further
  return null;
}

/**
 * Evaluate a query and return the processed result with rank check.
 * Helper function to avoid code duplication in the query looping logic.
 */
async function evaluateQuery(
  query: string,
  business: {
    place_id: string;
    name: string;
    lat: number;
    lng: number;
  }
): Promise<{
  processed: {
    leaders: TopSearchLeader[];
    userRank: number; // Always a number - never null
    heading: string;
    isChasers: boolean;
  };
  results: any[];
} | null> {
  // Run Text Search for query
  let results: any[] = [];
  try {
    results = await textSearchPlacesForQuery(query, {
      lat: business.lat,
      lng: business.lng,
      radiusMeters: 15000,
    });
  } catch (searchError) {
    console.error('[topSearchQuery] Error in text search', { query, searchError });
    return null;
  }

  if (!results || results.length === 0) {
    console.log('[topSearchQuery] No search results found for query', { query });
    return null;
  }

  // Process query results
  const processed = await processSearchResults(query, results, business);

  return { processed, results };
}

/**
 * Get top search ranking result for a business.
 * 
 * This finds businesses that rank above the user's business for their primary search query.
 * If the business is ranked #1, it automatically loosens the query until a non-#1 rank is found.
 * If the primary query returns no meaningful leaders, it automatically tries a broader query.
 * No category, rating, or review filters are applied - only SERP position matters.
 * 
 * @param business Business information including place_id, location, and category
 * @returns TopSearchResult with query, leaders, and userRank, or null if unable to compute
 */
export async function getTopSearchResultForBusiness(business: {
  place_id: string;
  name: string;
  primary_category?: string | null;
  category?: string | null;
  formatted_address?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<TopSearchResult | null> {
  try {
    const userLat = business.lat;
    const userLng = business.lng;

    if (typeof userLat !== "number" || typeof userLng !== "number") {
      console.warn('[topSearchLeaders] Business location missing', { place_id: business.place_id });
      return null;
    }

    // Extract location parts for query loosening
    const locationParts = extractLocationParts(
      business.formatted_address || business.address || null
    );

    // 1) Get primary ranking query via OpenAI
    let primaryQuery: string | null = null;
    try {
      primaryQuery = await getPrimaryRankingQueryForBusiness({
        name: business.name || '',
        category: business.category || null,
        primary_category: business.primary_category || null,
        formatted_address: business.formatted_address || business.address || null,
      });
    } catch (queryError) {
      console.error('[topSearchLeaders] Error generating primary query', queryError);
      return null;
    }

    if (!primaryQuery) {
      console.warn('[topSearchLeaders] No ranking query generated');
      return null;
    }

    // 2) Evaluate primary query
    const primaryEvaluation = await evaluateQuery(primaryQuery, {
      place_id: business.place_id,
      name: business.name || '',
      lat: userLat,
      lng: userLng,
    });

    if (!primaryEvaluation) {
      console.log('[topSearchLeaders] No search results found for primary query', { primaryQuery });
      // Try fallback query
      return await tryFallbackQuery(business, userLat, userLng, primaryQuery);
    }

    const { processed: primaryProcessed, results: primaryResults } = primaryEvaluation;

    // 3) Check if business is ranked #1 - if so, we need to loosen the query
    if (primaryProcessed.userRank === 1) {
      console.log('[topSearchQuery] Business is ranked #1 for primary query, loosening query', {
        query: primaryQuery,
        userRank: primaryProcessed.userRank,
      });

      // Try loosened queries until we find one where rank !== 1
      let currentQuery = primaryQuery;
      let allQueriesWereNumberOne = true;
      let bestResult: {
        query: string;
        processed: typeof primaryProcessed;
        results: any[];
      } | null = null;

      // Try up to 3 loosened variants
      for (let attempt = 0; attempt < 3; attempt++) {
        const loosenedQuery = loosenQuery(currentQuery, locationParts);
        
        if (!loosenedQuery) {
          // Can't loosen further
          console.log('[topSearchQuery] Cannot loosen query further', {
            currentQuery,
            attempt,
          });
          break;
        }

        console.log('[topSearchQuery] Trying loosened query', {
          attempt: attempt + 1,
          originalQuery: primaryQuery,
          loosenedQuery,
        });

        const evaluation = await evaluateQuery(loosenedQuery, {
          place_id: business.place_id,
          name: business.name || '',
          lat: userLat,
          lng: userLng,
        });

        if (!evaluation) {
          // No results for this loosened query, try next
          console.log('[topSearchQuery] Loosened query returned no results', {
            loosenedQuery,
            attempt: attempt + 1,
          });
          currentQuery = loosenedQuery;
          continue;
        }

        const { processed, results } = evaluation;

        // Check if this query has a non-#1 rank
        if (processed.userRank !== 1) {
          // Found a query where business is not #1
          console.log('[topSearchQuery] Found query where business is not #1', {
            query: loosenedQuery,
            userRank: processed.userRank,
            attempt: attempt + 1,
          });

          // Check if we have meaningful leaders
          const userIndex = processed.userRank > 0 ? processed.userRank - 1 : -1;
          if (hasMeaningfulLeaders(results, userIndex, processed.userRank)) {
            allQueriesWereNumberOne = false;
            return {
              query: loosenedQuery,
              leaders: processed.leaders,
              userRank: processed.userRank,
              heading: processed.heading,
              isChasers: processed.isChasers,
              stillNumberOne: false,
            };
          } else {
            // No meaningful leaders, but rank is not #1 - store as best result so far
            bestResult = { query: loosenedQuery, processed, results };
            allQueriesWereNumberOne = false;
          }
        } else {
          // Still #1, continue loosening
          console.log('[topSearchQuery] Business still ranked #1 for loosened query', {
            query: loosenedQuery,
            userRank: processed.userRank,
            attempt: attempt + 1,
          });
          currentQuery = loosenedQuery;
        }
      }

      // If we found a non-#1 result but it had no meaningful leaders, use it
      if (bestResult) {
        console.log('[topSearchQuery] Using best non-#1 result (no meaningful leaders)', {
          query: bestResult.query,
          userRank: bestResult.processed.userRank,
        });
        return {
          query: bestResult.query,
          leaders: bestResult.processed.leaders,
          userRank: bestResult.processed.userRank,
          heading: bestResult.processed.heading,
          isChasers: bestResult.processed.isChasers,
          stillNumberOne: false,
        };
      }

      // All query variants still have business at #1
      if (allQueriesWereNumberOne) {
        console.log('[topSearchQuery] Business is #1 for all query variants, using broadest query', {
          primaryQuery,
          finalQuery: currentQuery,
        });

        // Use the broadest query we tried (or primary if we couldn't loosen)
        const finalQuery = currentQuery !== primaryQuery ? currentQuery : primaryQuery;
        const finalEvaluation = currentQuery !== primaryQuery
          ? await evaluateQuery(finalQuery, {
              place_id: business.place_id,
              name: business.name || '',
              lat: userLat,
              lng: userLng,
            })
          : primaryEvaluation;

        if (finalEvaluation) {
          return {
            query: finalQuery,
            leaders: finalEvaluation.processed.leaders,
            userRank: finalEvaluation.processed.userRank,
            heading: finalEvaluation.processed.heading,
            isChasers: finalEvaluation.processed.isChasers,
            stillNumberOne: true,
          };
        }
      }
    }

    // 4) Business is not #1, check if we have meaningful leaders
    const userIndex = primaryProcessed.userRank > 0 ? primaryProcessed.userRank - 1 : -1;
    if (hasMeaningfulLeaders(primaryResults, userIndex, primaryProcessed.userRank)) {
      // Primary query worked - use it
      console.log('[topSearchLeaders] Primary query returned meaningful leaders', {
        query: primaryQuery,
        leadersCount: primaryProcessed.leaders.length,
        userRank: primaryProcessed.userRank,
      });

      return {
        query: primaryQuery,
        leaders: primaryProcessed.leaders,
        userRank: primaryProcessed.userRank,
        heading: primaryProcessed.heading,
        isChasers: primaryProcessed.isChasers,
        stillNumberOne: false,
      };
    }

    // 5) Primary query didn't return meaningful leaders - try broader query
    console.log('[topSearchLeaders] Primary query returned no meaningful leaders, trying broader query', {
      primaryQuery,
      resultsCount: primaryResults.length,
      userRank: primaryProcessed.userRank,
    });

    return await tryFallbackQuery(business, userLat, userLng, primaryQuery);
  } catch (err: any) {
    console.error("[topSearchLeaders] error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
}

/**
 * Try a broader fallback query when the primary query returns no meaningful leaders.
 */
async function tryFallbackQuery(
  business: {
    place_id: string;
    name: string;
    primary_category?: string | null;
    category?: string | null;
    formatted_address?: string | null;
    address?: string | null;
  },
  userLat: number,
  userLng: number,
  primaryQuery: string
): Promise<TopSearchResult> {
  // Generate broader query
  let broaderQuery: string | null = null;
  try {
    broaderQuery = await getBroaderRankingQueryForBusiness({
      name: business.name || '',
      category: business.category || null,
      primary_category: business.primary_category || null,
      formatted_address: business.formatted_address || business.address || null,
    });
  } catch (queryError) {
    console.error('[topSearchLeaders] Error generating broader query', queryError);
    // Fall back to primary query with empty leaders
    return {
      query: primaryQuery,
      leaders: [],
      userRank: 999, // Default rank when unable to determine
      heading: `We couldn't read this search right now`,
      stillNumberOne: false,
    };
  }

  if (!broaderQuery) {
    console.warn('[topSearchLeaders] No broader query generated');
    return {
      query: primaryQuery,
      leaders: [],
      userRank: 999, // Default rank when unable to determine
      heading: `We couldn't read this search right now`,
      stillNumberOne: false,
    };
  }

  // Run Text Search for broader query
  let results: any[] = [];
  try {
    results = await textSearchPlacesForQuery(broaderQuery, {
      lat: userLat,
      lng: userLng,
      radiusMeters: 15000,
    });
  } catch (searchError) {
    console.error('[topSearchLeaders] Error in broader text search', searchError);
    // Fall back to primary query with empty leaders
    return {
      query: primaryQuery,
      leaders: [],
      userRank: 999, // Default rank when unable to determine
      heading: `We couldn't read this search right now`,
      stillNumberOne: false,
    };
  }

  if (!results || results.length === 0) {
    console.log('[topSearchLeaders] No search results found for broader query', { broaderQuery });
    // Both queries failed - use primary query with empty leaders
    return {
      query: primaryQuery,
      leaders: [],
      userRank: 999, // Default rank when unable to determine
      heading: `We couldn't read this search right now`,
      stillNumberOne: false,
    };
  }

  // Process broader query results
  const processed = await processSearchResults(broaderQuery, results, {
    place_id: business.place_id,
    name: business.name || '',
    lat: userLat,
    lng: userLng,
  });

  // Check if broader query has meaningful leaders
  const userIndex = processed.userRank > 0 ? processed.userRank - 1 : -1;
  if (hasMeaningfulLeaders(results, userIndex, processed.userRank)) {
    // Broader query worked - use it
    console.log('[topSearchLeaders] Broader query returned meaningful leaders', {
      query: broaderQuery,
      leadersCount: processed.leaders.length,
      userRank: processed.userRank,
    });

    return {
      query: broaderQuery,
      leaders: processed.leaders,
      userRank: processed.userRank,
      heading: processed.heading,
      isChasers: processed.isChasers,
      stillNumberOne: false,
    };
  }

  // Both queries failed to return meaningful leaders - use primary query with empty leaders
  console.log('[topSearchLeaders] Both queries failed to return meaningful leaders', {
    primaryQuery,
    broaderQuery,
    resultsCount: results.length,
    userRank: processed.userRank,
  });

  return {
    query: primaryQuery,
    leaders: [],
    userRank: processed.userRank, // Use the rank from processed results
    heading: `You're not clearly being outranked for "${primaryQuery}" right now on Google. Let's use creators to protect that position.`,
    stillNumberOne: false,
  };
}

