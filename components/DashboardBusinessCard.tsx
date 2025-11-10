"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Phone, Globe, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessSearchBox } from "@/components/BusinessSearchBox";

interface DashboardBusinessCardProps {
  business: {
    place_id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
    image_url?: string | null;
    google_maps_url?: string | null;
    rating?: number | null;
    reviews_count?: number | null;
    categories?: string[] | null;
  };
  onBusinessChange?: (placeId: string) => void;
}

export function DashboardBusinessCard({ business, onBusinessChange }: DashboardBusinessCardProps) {
  const router = useRouter();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [isChangingBusiness, setIsChangingBusiness] = useState(false);
  const [showBusinessSearch, setShowBusinessSearch] = useState(false);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // Build photo URL - for now we only have one image from image_url
  // In the future, we could fetch multiple photos from Google Places API
  const photos = business.image_url ? [{ ref: business.image_url, url: business.image_url }] : [];
  const currentPhoto = photos.length > 0 ? photos[currentPhotoIndex] : null;

  const handlePreviousPhoto = useCallback(() => {
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    }
  }, [photos.length]);

  const handleNextPhoto = useCallback(() => {
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  }, [photos.length]);

  const handleThumbnailClick = (index: number) => {
    setCurrentPhotoIndex(index);
  };

  // Keyboard navigation for thumbnails
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== thumbnailRef.current?.querySelector('button:focus')) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousPhoto();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextPhoto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePreviousPhoto, handleNextPhoto]);

  const handleChangeBusiness = async (placeId: string) => {
    setIsChangingBusiness(true);
    try {
      // First, ensure the business is imported (if it doesn't exist, this will create it)
      const importResponse = await fetch("/api/places/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: placeId }),
      });

      if (!importResponse.ok) {
        const data = await importResponse.json();
        throw new Error(data.error || "Failed to import business");
      }

      // Then, change the default business (this also triggers snapshot creation)
      const changeResponse = await fetch("/api/dashboard/change-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: placeId }),
      });

      if (!changeResponse.ok) {
        const data = await changeResponse.json();
        throw new Error(data.error || "Failed to change business");
      }

      // Trigger kickoff to ensure all data (images, reviews, etc.) is fetched
      // Wait for it to complete so data is ready before showing the dashboard
      try {
        const kickoffResponse = await fetch("/api/onboard/kickoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place_id: placeId }),
        });

        if (!kickoffResponse.ok) {
          console.warn("[DashboardBusinessCard] Kickoff failed, but continuing:", await kickoffResponse.text());
        } else {
          // Wait a bit more for snapshot to be created and saved
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.warn("[DashboardBusinessCard] Kickoff error (non-blocking):", err);
        // Still continue - data will load eventually
      }

      // Use window.location.href for a hard refresh to avoid showing old data
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[DashboardBusinessCard] Error changing business:", err);
      alert(err.message || "Failed to change business. Please try again.");
      setIsChangingBusiness(false);
      setShowBusinessSearch(false);
    }
  };

  // Get business initials for placeholder
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2);
  };

  // Filter and format categories
  const displayCategories = (business.categories || [])
    .filter((cat) => !['establishment', 'point_of_interest'].includes(cat))
    .slice(0, 3);

  const additionalCategoriesCount = Math.max(0, (business.categories || []).length - 3);

  // Hero image URL
  const heroImageUrl = currentPhoto?.url || business.image_url || null;

  const displayAddress = [business.address, business.city].filter(Boolean).join(', ');

  if (showBusinessSearch) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 lg:p-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Change Business</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBusinessSearch(false)}
              disabled={isChangingBusiness}
            >
              Cancel
            </Button>
          </div>
          {isChangingBusiness ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#153E23]" />
              <p className="text-sm font-medium text-gray-700">Loading your new business...</p>
              <p className="text-xs text-gray-500">Fetching images and reviews...</p>
            </div>
          ) : (
            <BusinessSearchBox
              onSelect={(placeId) => {
                // Set loading state immediately
                setIsChangingBusiness(true);
                // Then handle the change (this is async)
                handleChangeBusiness(placeId).catch((err) => {
                  console.error("[DashboardBusinessCard] Error in handleChangeBusiness:", err);
                  setIsChangingBusiness(false);
                  setShowBusinessSearch(false);
                });
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Media (sticky on desktop) */}
        <div className="lg:col-span-7 lg:sticky lg:top-6 lg:self-start space-y-4">
          {/* Hero Image */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg group">
            {heroImageUrl && !imageErrors.has(currentPhotoIndex) ? (
              <>
                <Image
                  src={heroImageUrl}
                  alt={`Photo of ${business.name}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  onError={() => setImageErrors((prev) => new Set(prev).add(currentPhotoIndex))}
                  unoptimized={heroImageUrl.startsWith('/api/places/photo')}
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Top Badges - Categories */}
                {displayCategories.length > 0 && (
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    {displayCategories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-900 rounded-full"
                      >
                        {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Bottom Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h1 className="text-2xl font-bold mb-1 drop-shadow-lg">{business.name}</h1>
                  {business.rating !== null && business.rating !== undefined && (
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{business.rating.toFixed(1)}</span>
                      {business.reviews_count && (
                        <span className="text-white/80 text-sm">
                          ({business.reviews_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Navigation Arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={handlePreviousPhoto}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white motion-safe:transition-opacity"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={handleNextPhoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white motion-safe:transition-opacity"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                    
                    {/* Photo Counter */}
                    <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity motion-safe:transition-opacity">
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Placeholder when no photo */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-white">
                    {getInitials(business.name)}
                  </span>
                </div>
                <p className="text-white/80 font-medium">{business.name}</p>
              </div>
            )}
          </div>

          {/* Thumbnail Rail - only show if multiple photos */}
          {photos.length > 1 && (
            <div
              ref={thumbnailRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
              role="tablist"
              aria-label="Photo thumbnails"
            >
              {photos.map((photo, index) => {
                const isActive = index === currentPhotoIndex;
                const thumbnailUrl = photo.url;

                return (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all snap-start",
                      "focus:outline-none focus:ring-2 focus:ring-[#153E23] focus:ring-offset-2",
                      "motion-safe:transition-all",
                      isActive
                        ? "border-[#153E23] ring-2 ring-[#153E23] ring-offset-1 motion-safe:scale-105"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    aria-label={`View photo ${index + 1}`}
                    aria-selected={isActive}
                    role="tab"
                  >
                    {!imageErrors.has(index) ? (
                      <Image
                        src={thumbnailUrl}
                        alt={`${business.name} thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                        onError={() => setImageErrors((prev) => new Set(prev).add(index))}
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Details & Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Business Name */}
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 leading-tight">
              {business.name}
            </h2>
            
            {/* Meta Chips */}
            <div className="flex flex-col gap-3">
              {/* Address */}
              {displayAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="line-clamp-2">{displayAddress}</p>
                </div>
              )}
              
              {/* Phone */}
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>{business.phone}</span>
                </a>
              )}
              
              {/* Website */}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{business.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </div>

          {/* Category Chips */}
          {business.categories && business.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayCategories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                >
                  {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              ))}
              {additionalCategoriesCount > 0 && (
                <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                  +{additionalCategoriesCount}
                </span>
              )}
            </div>
          )}

          {/* Mini KPI Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {business.rating !== null && business.rating !== undefined && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold text-gray-900">{business.rating.toFixed(1)}</span>
                {business.reviews_count && (
                  <span className="text-gray-600">
                    ({business.reviews_count.toLocaleString()} reviews)
                  </span>
                )}
              </div>
            )}
            
            {business.google_maps_url && (
              <Link
                href={business.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View on Google Maps</span>
              </Link>
            )}
          </div>

          {/* Action Bar - Sticky on desktop */}
          <div className="pt-4 space-y-3 lg:sticky lg:bottom-6">
            <Button
              onClick={() => setShowBusinessSearch(true)}
              disabled={isChangingBusiness}
              variant="outline"
              className="w-full h-12 rounded-xl border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#153E23] focus:ring-offset-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isChangingBusiness ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing business...
                </span>
              ) : (
                "Change Business"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

