/**
 * Google Places API helpers for server-side operations.
 * 
 * WARNING: This module uses GOOGLE_PLACES_API_KEY and must never be
 * imported in client-side code.
 */

interface PlaceSearchResult {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference?: string;
  }>;
}

interface NearbySearchResponse {
  results?: PlaceSearchResult[];
  status: string;
  error_message?: string;
}

export interface NormalizedPlaceResult {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  lat: number;
  lng: number;
  photo_reference?: string;
}

interface SearchPlacesNearbyArgs {
  lat: number;
  lng: number;
  radiusMeters: number;
  keyword?: string;
  type?: string;
}

/**
 * Search for places near a location using Google Places Nearby Search API.
 * 
 * @param args Search parameters
 * @returns Array of normalized place results, or empty array on failure
 */
export async function searchPlacesNearby(
  args: SearchPlacesNearbyArgs
): Promise<NormalizedPlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      location: `${args.lat},${args.lng}`,
      radius: args.radiusMeters.toString(),
      key: apiKey,
    });

    if (args.keyword) {
      params.append('keyword', args.keyword);
    }

    if (args.type) {
      params.append('type', args.type);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Google Places API error:', response.status, response.statusText);
      return [];
    }

    const data: NearbySearchResponse = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API status:', data.status, data.error_message);
      return [];
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Normalize results
    return data.results
      .filter(result => result.place_id && result.geometry?.location)
      .map(result => ({
        place_id: result.place_id!,
        name: result.name || 'Unknown',
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        types: result.types || [],
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        photo_reference: result.photos?.[0]?.photo_reference,
      }));
  } catch (error) {
    console.error('Error searching places nearby:', error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * 
 * @param a First coordinate
 * @param b Second coordinate
 * @returns Distance in meters (integer)
 */
export function getPlaceDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const a1 = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
  const distance = R * c;

  return Math.round(distance);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Text Search result interface for Google Places Text Search API.
 */
export interface PlacesTextSearchResult {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
  types?: string[];
}

interface TextSearchResponse {
  results?: PlacesTextSearchResult[];
  status: string;
  error_message?: string;
}

/**
 * Search for places using Google Places Text Search API.
 * 
 * @param query The search query string
 * @param opts Location and radius options
 * @returns Array of place results
 */
export async function textSearchPlacesForQuery(
  query: string,
  opts: { lat: number; lng: number; radiusMeters?: number }
): Promise<PlacesTextSearchResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY");
  }

  const { lat, lng, radiusMeters = 6000 } = opts;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", query);
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", radiusMeters.toString());
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Text Search failed: ${res.status}`);

    const data: TextSearchResponse = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Text Search error: ${data.status} ${data.error_message || ""}`);
    }

    return (data.results ?? []) as PlacesTextSearchResult[];
  } catch (error) {
    console.error("Error in textSearchPlacesForQuery:", error);
    throw error;
  }
}

/**
 * Get place details from Google Places API.
 * Server-side only.
 */
export interface PlaceReview {
  author_name?: string;
  rating?: number;
  relative_time_description?: string;
  time?: number; // Unix timestamp in seconds
  text?: string;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  photo_reference?: string;
  photos?: string[]; // All photo references
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
  };
  editorial_summary?: string;
  current_opening_hours?: {
    open_now?: boolean;
  };
  reviews?: PlaceReview[]; // Individual reviews
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  try {
    const fields = [
      'name',
      'rating',
      'user_ratings_total',
      'photos',
      'types',
      'opening_hours',
      'editorial_summary',
      'current_opening_hours',
      'reviews', // Include reviews to get individual review data
    ].join(',');

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Google Places Details API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places Details API status:', data.status, data.error_message);
      return null;
    }

    const result = data.result;

    // Extract all photo references
    const allPhotoReferences = (result.photos || [])
      .map((photo: any) => photo.photo_reference)
      .filter(Boolean);

    // Extract reviews if available
    const reviews: PlaceReview[] = (result.reviews || []).map((review: any) => ({
      author_name: review.author_name,
      rating: review.rating,
      relative_time_description: review.relative_time_description,
      time: review.time, // Unix timestamp in seconds
      text: review.text,
    }));

    return {
      place_id: result.place_id || placeId,
      name: result.name || 'Unknown',
      rating: result.rating,
      user_ratings_total: result.user_ratings_total,
      photo_reference: result.photos?.[0]?.photo_reference,
      photos: allPhotoReferences, // Include all photos
      types: result.types || [],
      opening_hours: result.opening_hours
        ? {
            open_now: result.opening_hours.open_now,
          }
        : undefined,
      editorial_summary: result.editorial_summary?.overview,
      current_opening_hours: result.current_opening_hours
        ? {
            open_now: result.current_opening_hours.open_now,
          }
        : undefined,
      reviews: reviews.length > 0 ? reviews : undefined,
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

