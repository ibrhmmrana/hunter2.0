/**
 * Google Places Photo URL helper.
 * Returns URL to our API route (which proxies to Google) to avoid exposing API key.
 */

export function placePhotoUrl(
  photoReference: string,
  { maxWidth = 800 }: { maxWidth?: number } = {}
): string {
  if (!photoReference) {
    return '';
  }

  // Use our API route which proxies to Google Places API
  return `/api/places/photo?ref=${encodeURIComponent(photoReference)}&max=${maxWidth}`;
}

