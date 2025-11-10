"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star, Globe, Phone, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { PlaceConfirm } from "@/app/api/places/details/route";
import { cn } from "@/lib/utils";

interface BusinessConfirmCardProps {
  place: PlaceConfirm;
  onConfirm: (place: PlaceConfirm) => void;
  onReject: () => void;
}

export function BusinessConfirmCard({ place, onConfirm, onReject }: BusinessConfirmCardProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    setIsConfirming(true);
    
    // Store in localStorage
    const selectedPlace = {
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
    };
    
    try {
      localStorage.setItem('selectedPlace', JSON.stringify(selectedPlace));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    
    onConfirm(place);
    // Navigation is handled by parent component
  };

  const handleReject = () => {
    try {
      localStorage.removeItem('selectedPlace');
    } catch (err) {
      console.error('Failed to remove from localStorage:', err);
    }
    onReject();
  };

  // Extract hostname from website URL
  const websiteHostname = place.website
    ? new URL(place.website).hostname.replace(/^www\./, '')
    : null;

  // Filter types to exclude generic ones and take first 3
  const displayTypes = (place.types || [])
    .filter((type) => !['establishment', 'point_of_interest'].includes(type))
    .slice(0, 3)
    .map((type) => type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));

  /**
   * Build photo URL with fallback logic:
   * 1. Try v1 name parameter
   * 2. Try v3 ref parameter
   * 3. Fallback to image_url or placeholder
   */
  const buildPhotoUrl = (photo: PlaceConfirm['photos'][0] | null, max: number = 1200): string => {
    if (!photo) {
      return place.image_url || '/placeholder-business.svg';
    }

    // Build URL from photo data with proper max parameter
    if (photo.name) {
      // v1 format: use name parameter
      return `/api/places/photo?name=${encodeURIComponent(photo.name)}&max=${max}`;
    } else if (photo.photo_reference) {
      // v3 format: use ref parameter
      return `/api/places/photo?ref=${encodeURIComponent(photo.photo_reference)}&max=${max}`;
    } else if (photo.url) {
      // Already built URL - check if we need to update max parameter
      if (photo.url.includes('/api/places/photo') && photo.url.includes('max=')) {
        // Update max parameter if different
        return photo.url.replace(/max=\d+/, `max=${max}`);
      }
      // Use URL as-is if it's already from our proxy
      return photo.url;
    }

    // Final fallback
    return place.image_url || '/placeholder-business.svg';
  };

  const allPhotos = place.photos || [];
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Track image loading errors
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index));
  };

  const currentPhoto = allPhotos.length > 0 ? allPhotos[currentPhotoIndex] : null;

  const handlePreviousPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentPhotoIndex(index);
  };

  return (
    <Card className="mt-6 rounded-2xl border shadow-lg">
      <CardContent className="p-0">
        {/* Hero Image with Navigation */}
        <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl bg-gray-200 group">
          {currentPhoto && !imageErrors.has(currentPhotoIndex) ? (
            <Image
              src={buildPhotoUrl(currentPhoto, 1200)}
              alt={`${place.name} photo ${currentPhotoIndex + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
              onError={() => handleImageError(currentPhotoIndex)}
              unoptimized={buildPhotoUrl(currentPhoto).startsWith('/api/places/photo')}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="h-16 w-16 text-gray-400" />
            </div>
          )}

          {/* Navigation Arrows */}
          {allPhotos.length > 1 && (
            <>
              <button
                onClick={handlePreviousPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleNextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Photo Counter */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {currentPhotoIndex + 1} / {allPhotos.length}
              </div>
            </>
          )}
        </div>

        {/* Photo Gallery Thumbnails */}
        {allPhotos.length > 1 && (
          <div className="px-6 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {allPhotos.map((photo, index) => {
                const hasError = imageErrors.has(index);
                const photoUrl = buildPhotoUrl(photo, 256);
                const isActive = index === currentPhotoIndex;

                return (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 bg-gray-100 transition-all",
                      isActive
                        ? "border-[#153E23] ring-2 ring-[#153E23] ring-offset-2"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    aria-label={`View photo ${index + 1}`}
                  >
                    {!hasError ? (
                      <Image
                        src={photoUrl}
                        alt={`${place.name} photo ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                        onError={() => handleImageError(index)}
                        unoptimized={photoUrl.startsWith('/api/places/photo')}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 pt-4 pb-6 space-y-4">
          {/* Title and Address */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">{place.name}</h3>
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{place.formatted_address}</p>
            </div>
          </div>

          {/* Type Badges */}
          {displayTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayTypes.map((type, index) => (
                <span
                  key={index}
                  className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            {place.rating !== undefined && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{place.rating.toFixed(1)}</span>
                {place.user_ratings_total && (
                  <span className="text-gray-500">
                    ({place.user_ratings_total.toLocaleString()})
                  </span>
                )}
              </div>
            )}

            {websiteHostname && (
              <Link
                href={place.website!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span className="underline">{websiteHostname}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}

            {place.formatted_phone_number && (
              <a
                href={`tel:${place.formatted_phone_number}`}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{place.formatted_phone_number}</span>
              </a>
            )}

            {place.opening_hours?.open_now !== undefined && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className={cn(
                  place.opening_hours.open_now ? "text-green-600" : "text-red-600"
                )}>
                  {place.opening_hours.open_now ? "Open now" : "Closed"}
                </span>
              </div>
            )}
          </div>

          {/* Map Link (if available) */}
          {place.location && place.map_url && (
            <div className="pt-2 border-t">
              <a
                href={place.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
              >
                <MapPin className="h-4 w-4" />
                <span>View on Google Maps</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 space-y-3">
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full h-12 rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium"
            >
              {isConfirming ? "Loading..." : "Yes — Continue to Analysis"}
            </Button>

            <Button
              onClick={handleReject}
              variant="outline"
              className="w-full h-11 rounded-xl border-gray-200"
            >
              Pick a different business
            </Button>

            <Link
              href="/onboarding/verify"
              className="block text-center text-sm text-gray-600 hover:text-primary underline"
            >
              Not on Google Maps? Create & Verify My Profile
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

