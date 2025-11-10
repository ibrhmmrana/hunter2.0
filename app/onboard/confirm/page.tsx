import { Suspense } from 'react';
import { ConfirmBusinessView } from '@/components/ConfirmBusinessView';
import { ConfirmBusinessSkeleton } from '@/components/ConfirmBusinessSkeleton';
import { ConfirmBusinessError } from '@/components/ConfirmBusinessError';
import { NotOnMapsCard } from '@/components/NotOnMapsCard';

async function fetchBusinessData(placeId: string) {
  'use server';
  
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return { error: 'Google Places API key not configured' };
    }

    // Call Places API v1 directly from server
    const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    const fieldMask = 'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,types,rating,userRatingCount,location,googleMapsUri,regularOpeningHours,businessStatus,photos';

    const detailsResponse = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      cache: 'no-store',
    });

    if (!detailsResponse.ok) {
      if (detailsResponse.status === 404 || detailsResponse.status === 400) {
        return { error: 'NOT_FOUND', place_id: placeId };
      }
      const errorText = await detailsResponse.text();
      console.error('Places API error:', errorText);
      return { error: `Places API error: ${detailsResponse.statusText}` };
    }

    const placeData: any = await detailsResponse.json();

    // Extract photos
    const photos: { ref: string }[] = [];
    if (placeData.photos && Array.isArray(placeData.photos)) {
      for (const photo of placeData.photos) {
        if (photo.photo_reference) {
          photos.push({ ref: photo.photo_reference });
        } else if (photo.name) {
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

    const result = {
      place_id: placeData.id || placeId,
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
      image_url: undefined,
    };

    return result;
  } catch (error: any) {
    console.error('Fetch error:', error);
    return { error: error.message || 'Failed to load business details' };
  }
}

async function ConfirmContent({ placeId }: { placeId: string }) {
  const data = await fetchBusinessData(placeId);

  if (data.error === 'NOT_FOUND') {
    return <NotOnMapsCard />;
  }

  if (data.error) {
    return <ConfirmBusinessError error={data.error} placeId={placeId} />;
  }

  return <ConfirmBusinessView data={data as any} placeId={placeId} />;
}

export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { placeId?: string };
}) {
  const placeId = searchParams.placeId;

  if (!placeId) {
    return (
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('https://pcfvqdusjtpoyopresqc.supabase.co/storage/v1/object/public/Storage/Dark%20Background.png')` }}>
        <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl bg-white shadow-soft p-8 md:p-12">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <p className="text-sm text-red-700 mb-4">Missing place ID</p>
                <a
                  href="/onboarding/business/search"
                  className="inline-block px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Go back to search
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('https://pcfvqdusjtpoyopresqc.supabase.co/storage/v1/object/public/Storage/Dark%20Background.png')` }}>
      <div className="relative min-h-screen py-6 lg:py-12 pb-24 lg:pb-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<ConfirmBusinessSkeleton />}>
            <ConfirmContent placeId={placeId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

