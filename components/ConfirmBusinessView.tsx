"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Phone, Clock, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ConfirmBusinessData } from "@/app/api/places/confirm/route";
import { cn } from "@/lib/utils";

interface ConfirmBusinessViewProps {
  data: ConfirmBusinessData;
  placeId: string;
  isPreparing?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
}

export function ConfirmBusinessView({ data, placeId, isPreparing = false, onConfirm, onReject }: ConfirmBusinessViewProps) {
  const router = useRouter();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // Build photo URL
  const buildPhotoUrl = (ref: string, width: number = 1200): string => {
    return `/api/places/photo?ref=${encodeURIComponent(ref)}&w=${width}`;
  };

  const allPhotos = data.photos || [];
  const currentPhoto = allPhotos.length > 0 ? allPhotos[currentPhotoIndex] : null;

  const handlePreviousPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
  }, [allPhotos.length]);

  const handleNextPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
  }, [allPhotos.length]);

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

  const handleConfirm = () => {
    // Store in localStorage
    const selectedPlace = {
      place_id: data.place_id,
      name: data.name,
      address: data.address,
    };
    
    try {
      localStorage.setItem('selectedPlace', JSON.stringify(selectedPlace));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    
    // Use custom handler if provided, otherwise use default navigation
    if (onConfirm) {
      onConfirm();
    } else {
      router.push(`/onboard/connections?place_id=${encodeURIComponent(placeId)}`);
    }
  };

  const handleReject = () => {
    try {
      localStorage.removeItem('selectedPlace');
    } catch (err) {
      console.error('Failed to remove from localStorage:', err);
    }
    
    // Use custom handler if provided, otherwise use default navigation
    if (onReject) {
      onReject();
    } else {
      router.push('/onboarding/business/search');
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
  const displayCategories = (data.categories || [])
    .filter((cat) => !['establishment', 'point_of_interest'].includes(cat))
    .slice(0, 3);

  const additionalCategoriesCount = Math.max(0, (data.categories || []).length - 3);

  // Hero image URL with fallback
  const heroImageUrl = currentPhoto
    ? buildPhotoUrl(currentPhoto.ref, 1200)
    : data.image_url || null;

  return (
    <React.Fragment>
      <div className="confirm-business-view">
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
                      alt={`Photo of ${data.name}`}
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
                      <h1 className="text-2xl font-bold mb-1 drop-shadow-lg">{data.name}</h1>
                      {data.rating !== undefined && (
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{data.rating.toFixed(1)}</span>
                          {data.reviews_count && (
                            <span className="text-white/80 text-sm">
                              ({data.reviews_count.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Navigation Arrows */}
                    {allPhotos.length > 1 && (
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
                          {currentPhotoIndex + 1} / {allPhotos.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* Placeholder when no photo */
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                      <span className="text-3xl font-bold text-white">
                        {getInitials(data.name)}
                      </span>
                    </div>
                    <p className="text-white/80 font-medium">{data.name}</p>
                  </div>
                )}
              </div>

              {/* Thumbnail Rail */}
              {allPhotos.length > 1 && (
                <div
                  ref={thumbnailRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
                  role="tablist"
                  aria-label="Photo thumbnails"
                >
                  {allPhotos.map((photo, index) => {
                    const isActive = index === currentPhotoIndex;
                    const thumbnailUrl = buildPhotoUrl(photo.ref, 240);

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
                            alt={`${data.name} thumbnail ${index + 1}`}
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
                  {data.name}
                </h2>
                
                {/* Meta Chips */}
                <div className="flex flex-col gap-3">
                  {/* Address */}
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="line-clamp-2">{data.address}</p>
                  </div>
                  
                  {/* Phone */}
                  {data.phone && (
                    <a
                      href={`tel:${data.phone}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{data.phone}</span>
                    </a>
                  )}
                  
                  {/* Open/Closed Status */}
                  {data.is_open_now !== undefined && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        data.is_open_now
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}>
                        {data.is_open_now ? "Open now" : "Closed"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Chips */}
              {data.categories && data.categories.length > 0 && (
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
                {data.rating !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-gray-900">{data.rating.toFixed(1)}</span>
                    {data.reviews_count && (
                      <span className="text-gray-600">
                        ({data.reviews_count.toLocaleString()} reviews)
                      </span>
                    )}
                  </div>
                )}
                
                {data.google_maps_url && (
                  <Link
                    href={data.google_maps_url}
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
                  onClick={handleConfirm}
                  disabled={isPreparing}
                  className="w-full h-12 rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#153E23] focus:ring-offset-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isPreparing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing your analysis...
                    </span>
                  ) : (
                    "Yes — Continue to Analysis"
                  )}
                </Button>

                <button
                  onClick={handleReject}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Pick a different business
                </button>
              </div>
            </div>
          </div>
      </div>
      </div>
    </React.Fragment>
  );
}

