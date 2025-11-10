import { NextRequest, NextResponse } from 'next/server';

export type ConfirmBusinessData = {
  place_id: string;
  name: string;
  address: string; // one-line formatted
  categories: string[]; // 0..n
  phone?: string;
  rating?: number; // 0..5
  reviews_count?: number;
  google_maps_url?: string;
  is_open_now?: boolean; // if available
  photos: { ref: string }[]; // array of photo_reference; may be empty
  image_url?: string; // optional fallback
  location?: {
    lat: number;
    lng: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const place_id = searchParams.get('placeId');

    if (!place_id) {
      return NextResponse.json(
        { error: 'placeId is required' },
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

    // Extract photos - prioritize photo_reference (v3) or extract from name (v1)
    const photos: { ref: string }[] = [];
    
    if (placeData.photos && Array.isArray(placeData.photos)) {
      for (const photo of placeData.photos) {
        // If we have photo_reference (v3), use it directly
        if (photo.photo_reference) {
          photos.push({ ref: photo.photo_reference });
        } else if (photo.name) {
          // For v1 API, the name format is "places/XXXX/photos/YYYY"
          // Extract the photo reference part (the last segment)
          const parts = photo.name.split('/');
          if (parts.length > 0) {
            const ref = parts[parts.length - 1];
            if (ref) {
              photos.push({ ref });
            }
          }
        }
      }
    }

    const result: ConfirmBusinessData = {
      place_id: placeData.id || place_id,
      name: placeData.displayName?.text || 'Unknown Business',
      address: placeData.formattedAddress || '',
      categories: placeData.types || [],
      phone: placeData.internationalPhoneNumber || undefined,
      rating: placeData.rating || undefined,
      reviews_count: placeData.userRatingCount || undefined,
      google_maps_url: placeData.googleMapsUri || undefined,
      is_open_now: placeData.regularOpeningHours?.openNow !== undefined
        ? placeData.regularOpeningHours.openNow
        : undefined,
      photos,
      image_url: undefined, // Can be populated from other sources if needed
      location: placeData.location
        ? {
            lat: placeData.location.latitude,
            lng: placeData.location.longitude,
          }
        : undefined,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Confirm business error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business details' },
      { status: 500 }
    );
  }
}

