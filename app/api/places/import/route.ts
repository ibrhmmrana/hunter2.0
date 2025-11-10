import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PlaceDetailsResponse {
  id?: string;
  displayName?: {
    text: string;
  };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  googleMapsUri?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  businessStatus?: string;
}

interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

interface GeocodeResponse {
  results?: Array<{
    address_components?: AddressComponent[];
  }>;
}

async function geocodeAddress(address: string): Promise<{
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {};
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${apiKey}`
    );

    const data: GeocodeResponse = await response.json();

    if (data.results && data.results.length > 0) {
      const components = data.results[0].address_components || [];
      const result: {
        city?: string;
        state?: string;
        postalCode?: string;
        countryCode?: string;
      } = {};

      for (const component of components) {
        if (component.types.includes("locality")) {
          result.city = component.longName;
        } else if (
          component.types.includes("administrative_area_level_1")
        ) {
          result.state = component.shortName;
        } else if (component.types.includes("postal_code")) {
          result.postalCode = component.longName;
        } else if (component.types.includes("country")) {
          result.countryCode = component.shortName;
        }
      }

      return result;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return {};
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (placeholder - wire up real auth later)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { place_id, session_token } = body;

    if (!place_id) {
      return NextResponse.json(
        { ok: false, error: "place_id is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Google Places API key not configured" },
        { status: 500 }
      );
    }

    // Call Places API v1 Details
    const detailsUrl = `https://places.googleapis.com/v1/places/${place_id}`;
    const fieldMask =
      "id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,types,rating,userRatingCount,location,googleMapsUri,regularOpeningHours,businessStatus";

    const detailsResponse = await fetch(detailsUrl, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        ...(session_token && { "X-Goog-Session-Token": session_token }),
      },
    });

    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.text();
      console.error("Places API error:", errorData);
      return NextResponse.json(
        {
          ok: false,
          error: `Places API error: ${detailsResponse.statusText}`,
        },
        { status: detailsResponse.status }
      );
    }

    const placeDetails: PlaceDetailsResponse = await detailsResponse.json();

    // Extract address components via geocoding
    const addressComponents = placeDetails.formattedAddress
      ? await geocodeAddress(placeDetails.formattedAddress)
      : {};

    // Shape the data for upsert_business_from_json
    const businessData = {
      title: placeDetails.displayName?.text || "Unknown Business",
      address: placeDetails.formattedAddress || "",
      city: addressComponents.city || "",
      state: addressComponents.state || "",
      postalCode: addressComponents.postalCode || "",
      countryCode: addressComponents.countryCode || "",
      website: placeDetails.websiteUri || "",
      phone: placeDetails.internationalPhoneNumber || "",
      location: placeDetails.location
        ? {
            lat: placeDetails.location.latitude,
            lng: placeDetails.location.longitude,
          }
        : null,
      placeId: place_id,
      categories: placeDetails.types || [],
      totalScore: placeDetails.rating || null,
      reviewsCount: placeDetails.userRatingCount || null,
      url: placeDetails.googleMapsUri || "",
    };

    // Call Supabase RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "upsert_business_from_json",
      {
        p: businessData as any,
      }
    );

    if (rpcError) {
      console.error("Supabase RPC error:", rpcError);
      return NextResponse.json(
        { ok: false, error: `Database error: ${rpcError.message}` },
        { status: 500 }
      );
    }

    const returnedPlaceId = rpcData || place_id;

    // Update owner_id for the business if user is authenticated
    if (user?.id) {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ owner_id: user.id })
        .eq("place_id", returnedPlaceId);

      if (updateError) {
        console.error("Error updating owner_id:", updateError);
        // Don't fail the request, just log the error
      }
    }

    // Note: n8n webhook removed - all analysis now handled by /api/onboard/kickoff

    return NextResponse.json({
      ok: true,
      place_id: returnedPlaceId,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

