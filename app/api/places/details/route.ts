import { NextRequest, NextResponse } from 'next/server';

export type PlaceConfirm = {
  place_id: string;
  name: string;
  formatted_address: string;
  website?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photos: {
    url: string;
    width: number;
    height: number;
    name?: string; // v1 photo name
    photo_reference?: string; // v3 photo reference
  }[];
  map_url?: string;
  location?: { lat: number; lng: number };
  opening_hours?: { open_now?: boolean };
  image_url?: string; // Fallback direct URL if available
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const place_id = searchParams.get('place_id');

    if (!place_id) {
      return NextResponse.json(
        { error: 'place_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Use Places API v1 (new API)
    const detailsUrl = `https://places.googleapis.com/v1/places/${place_id}`;
    const fieldMask = 'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,types,rating,userRatingCount,location,googleMapsUri,regularOpeningHours,businessStatus,photos';

    const detailsResponse = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.text();
      console.error('Places API error:', errorData);
      
      if (detailsResponse.status === 404 || detailsResponse.status === 400) {
        return NextResponse.json(
          { error: 'NOT_FOUND', place_id },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Places API error: ${detailsResponse.statusText}` },
        { status: detailsResponse.status }
      );
    }

    const placeData: any = await detailsResponse.json();

    // Transform photos to PlaceConfirm format
    // Places API v1 returns photos with a 'name' field (e.g., "places/XXXX/photos/YYYY")
    // We'll pass this name directly to our photo proxy which handles v1 format
    const photos = (placeData.photos || [])
      .slice(0, 6)
      .map((photo: any) => {
        const photoName = photo.name || '';
        
        // Build proxy URL - use 'name' parameter for v1 API
        let photoUrl: string;
        if (photoName) {
          // v1 format: use name directly
          photoUrl = `/api/places/photo?name=${encodeURIComponent(photoName)}&max=1200`;
        } else if (photo.photo_reference) {
          // Legacy v3 format: use ref parameter
          photoUrl = `/api/places/photo?ref=${encodeURIComponent(photo.photo_reference)}&max=1200`;
        } else {
          // Fallback - shouldn't happen but handle gracefully
          photoUrl = '';
        }
        
        return {
          url: photoUrl,
          width: photo.widthPx || 800,
          height: photo.heightPx || 600,
          name: photoName,
          photo_reference: photo.photo_reference || undefined,
        };
      })
      .filter((p: any) => p.url); // Filter out invalid photos

    const location = placeData.location
      ? {
          lat: placeData.location.latitude,
          lng: placeData.location.longitude,
        }
      : undefined;

    const opening_hours = placeData.regularOpeningHours?.openNow !== undefined
      ? { open_now: placeData.regularOpeningHours.openNow }
      : undefined;

    const result: PlaceConfirm = {
      place_id: placeData.id || place_id,
      name: placeData.displayName?.text || 'Unknown Business',
      formatted_address: placeData.formattedAddress || '',
      website: placeData.websiteUri || undefined,
      formatted_phone_number: placeData.internationalPhoneNumber || undefined,
      rating: placeData.rating || undefined,
      user_ratings_total: placeData.userRatingCount || undefined,
      types: placeData.types || [],
      photos,
      map_url: placeData.googleMapsUri || undefined,
      location,
      opening_hours,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}

