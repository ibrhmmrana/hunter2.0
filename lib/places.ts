import type { PlaceConfirm } from '@/app/api/places/details/route';

export async function fetchPlaceConfirm(placeId: string): Promise<PlaceConfirm> {
  const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
  
  if (!res.ok) {
    if (res.status === 404) {
      const error = await res.json();
      throw new Error(error.error || 'Place not found');
    }
    throw new Error('Failed to load place details');
  }

  return (await res.json()) as PlaceConfirm;
}






