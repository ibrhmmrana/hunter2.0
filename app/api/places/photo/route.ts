import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies Google Places photos to avoid exposing API keys client-side.
 * Supports both Places API v1 (name) and v3 (photo_reference).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name'); // v1 format: places/XXXX/photos/YYYY
    const ref = searchParams.get('ref'); // v3 format: photo_reference string
    const maxParam = searchParams.get('max') || searchParams.get('w'); // Support both 'max' and 'w'

    // Validate inputs
    if (!name && !ref) {
      return NextResponse.json(
        { error: 'Either "name" (v1) or "ref" (v3) parameter is required' },
        { status: 400 }
      );
    }

    // Clamp max width between 1-1600, default 1200
    const max = Math.min(Math.max(1, parseInt(maxParam || '1200', 10)), 1600);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    let photoUrl: string;

    if (name) {
      // Places API v1: use the photo media endpoint
      photoUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${max}`;
    } else {
      // Legacy v3 API: use photo_reference
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${max}&photoreference=${encodeURIComponent(ref!)}&key=${apiKey}`;
    }

    // Fetch the image with redirect following
    const imageResponse = await fetch(photoUrl, {
      method: 'GET',
      headers: name
        ? {
            'X-Goog-Api-Key': apiKey,
          }
        : undefined,
      redirect: 'follow', // Follow redirects (Google Photo API may redirect)
    });

    if (!imageResponse.ok) {
      // Return 502 with upstream status in body
      const errorText = await imageResponse.text().catch(() => 'Unknown error');
      return NextResponse.json(
        {
          error: 'Upstream photo fetch failed',
          upstreamStatus: imageResponse.status,
          upstreamStatusText: imageResponse.statusText,
          details: errorText,
        },
        { status: 502 }
      );
    }

    // Get image bytes
    const imageBuffer = await imageResponse.arrayBuffer();

    if (imageBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Empty image response from upstream' },
        { status: 502 }
      );
    }

    // Get content type from upstream, fallback to jpeg
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Return image with proper headers and caching (7 days immutable)
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    });
  } catch (error: any) {
    console.error('Photo proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch photo' },
      { status: 500 }
    );
  }
}
