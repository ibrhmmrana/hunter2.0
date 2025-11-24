"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Chip,
  IconButton,
  Stack,
  Avatar,
  CircularProgress,
  alpha,
} from "@mui/material";
import {
  LocationOnRounded,
  StarRounded,
  PhoneRounded,
  AccessTimeRounded,
  OpenInNewRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import type { ConfirmBusinessData } from "@/app/api/places/confirm/route";

interface ConfirmBusinessViewProps {
  data: ConfirmBusinessData;
  placeId: string;
  isPreparing?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
  confirmButtonText?: string;
  rejectButtonText?: string;
}

export function ConfirmBusinessView({ 
  data, 
  placeId, 
  isPreparing = false, 
  onConfirm, 
  onReject,
  confirmButtonText = "Yes — Continue to Analysis",
  rejectButtonText = "Pick a different business"
}: ConfirmBusinessViewProps) {
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
    <Card 
      variant="filled"
      sx={{ 
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        overflow: "hidden",
        width: { xs: "95vw", sm: "90vw", md: "85vw", lg: "75vw" },
        maxWidth: "1000px",
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        mx: "auto",
      }}
    >
      {/* Image Section - Left Side */}
      <Box
        sx={{
          position: "relative",
          width: { xs: "100%", sm: "50%" },
          aspectRatio: "1 / 1",
          overflow: "hidden",
          bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
          flexShrink: 0,
        }}
        className="group"
      >
                {heroImageUrl && !imageErrors.has(currentPhotoIndex) ? (
                  <>
                    <Image
                      src={heroImageUrl}
                      alt={`Photo of ${data.name}`}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      onError={() => setImageErrors((prev) => new Set(prev).add(currentPhotoIndex))}
                      unoptimized={heroImageUrl.startsWith('/api/places/photo')}
                    />
                    

                    {/* Navigation Arrows */}
                    {allPhotos.length > 1 && (
                      <>
                        <IconButton
                          onClick={handlePreviousPhoto}
                          size="small"
                          sx={{
                            position: "absolute",
                            left: { xs: 0.5, sm: 1 },
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: alpha("#000", 0.5),
                            color: "white",
                            opacity: 0,
                            width: { xs: 24, sm: 32 },
                            height: { xs: 24, sm: 32 },
                            "&:hover": { bgcolor: alpha("#000", 0.7), opacity: 1 },
                            ".group:hover &": { opacity: 1 },
                            "&:focus": { opacity: 1 },
                          }}
                          aria-label="Previous photo"
                        >
                          <ChevronLeftRounded sx={{ fontSize: { xs: 16, sm: 20 } }} />
                        </IconButton>
                        <IconButton
                          onClick={handleNextPhoto}
                          size="small"
                          sx={{
                            position: "absolute",
                            right: { xs: 0.5, sm: 1 },
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: alpha("#000", 0.5),
                            color: "white",
                            opacity: 0,
                            width: { xs: 24, sm: 32 },
                            height: { xs: 24, sm: 32 },
                            "&:hover": { bgcolor: alpha("#000", 0.7), opacity: 1 },
                            ".group:hover &": { opacity: 1 },
                            "&:focus": { opacity: 1 },
                          }}
                          aria-label="Next photo"
                        >
                          <ChevronRightRounded sx={{ fontSize: { xs: 16, sm: 20 } }} />
                        </IconButton>
                        
                        {/* Photo Counter */}
                        {allPhotos.length > 1 && (
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: { xs: 0.5, sm: 1 },
                              right: { xs: 0.5, sm: 1 },
                              bgcolor: alpha("#000", 0.5),
                              color: "white",
                              px: { xs: 1, sm: 1.5 },
                              py: { xs: 0.5, sm: 0.75 },
                              borderRadius: 999,
                              fontSize: { xs: "0.625rem", sm: "0.75rem" },
                              opacity: 0,
                              ".group:hover &": { opacity: 1 },
                            }}
                          >
                            {currentPhotoIndex + 1} / {allPhotos.length}
                          </Box>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  /* Placeholder when no photo */
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "text.secondary",
                    }}
                  >
                    <Avatar sx={{ width: { xs: "12vw", sm: "10vw", md: "8vw" }, height: { xs: "12vw", sm: "10vw", md: "8vw" }, maxWidth: "64px", maxHeight: "64px", bgcolor: alpha("#fff", 0.2), mb: 1 }}>
                      <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: "0.875rem", sm: "1rem", md: "1.25rem" } }}>
                        {getInitials(data.name)}
                      </Typography>
                    </Avatar>
                    <Typography variant="body1" fontWeight={500} sx={{ color: "white", fontSize: { xs: "0.75rem", sm: "0.875rem", md: "1rem" } }}>
                      {data.name}
                    </Typography>
                  </Box>
                )}
      </Box>

      {/* Content Section - Right Side */}
      <CardContent sx={{ 
        p: { xs: 2, sm: 2.5, md: 3 }, 
        "&:last-child": { pb: { xs: 2, sm: 2.5, md: 3 } }, 
        display: "flex", 
        flexDirection: "column", 
        flex: 1,
        width: { xs: "100%", sm: "50%" },
      }}>
        {/* Business Name */}
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 500, 
            mb: 1,
            fontSize: { xs: "1rem", sm: "1.25rem", md: "1.5rem" },
            lineHeight: 1.2,
          }}
        >
          {data.name}
        </Typography>

        {/* Address */}
        {data.address && (
          <Typography 
            variant="bodyMedium" 
            sx={{ 
              color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              fontSize: { xs: "0.75rem", sm: "0.875rem", md: "1rem" },
              mb: 2,
              lineHeight: 1.4,
            }}
          >
            {data.address}
          </Typography>
        )}

        {/* Rating with Star */}
        {data.rating !== undefined && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 2 }}>
            <StarRounded
              sx={{
                color: "#FFC107",
                fontSize: { xs: 18, sm: 20, md: 22 },
                fill: "#FFC107",
              }}
            />
            <Typography variant="bodyLarge" sx={{ fontWeight: 500, fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" } }}>
              {data.rating.toFixed(1)}
            </Typography>
            {data.reviews_count && (
              <Typography variant="bodyMedium" sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41", fontSize: { xs: "0.75rem", sm: "0.875rem", md: "1rem" } }}>
                ({data.reviews_count.toLocaleString()} reviews)
              </Typography>
            )}
          </Stack>
        )}

        {/* Supporting Info */}
        <Stack spacing={1.5} sx={{ mb: 2, flex: 1 }}>
          {/* Phone */}
          {data.phone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneRounded sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41" }} />
              <Typography 
                variant="bodyMedium" 
                component="a"
                href={`tel:${data.phone}`}
                sx={{
                  color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                  textDecoration: "none",
                  fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" },
                  "&:hover": { color: (theme) => theme.palette.primary.main },
                }}
              >
                {data.phone}
              </Typography>
            </Stack>
          )}

          {/* Open/Closed Status */}
          {data.is_open_now !== undefined && (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccessTimeRounded sx={{ fontSize: { xs: 14, sm: 16, md: 18 }, color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41" }} />
              <Chip
                label={data.is_open_now ? "Open now" : "Closed"}
                size="small"
                sx={{
                  bgcolor: data.is_open_now 
                    ? (theme) => theme.palette.success?.light || "#C8E6C9"
                    : (theme) => theme.palette.error?.light || "#FFCDD2",
                  color: "#FFFFFF",
                  fontSize: { xs: "0.625rem", sm: "0.6875rem", md: "0.75rem" },
                  fontWeight: 400,
                  height: { xs: 20, sm: 22, md: 24 },
                  px: { xs: 1, sm: 1.25 },
                  opacity: 0.8,
                }}
              />
            </Stack>
          )}

          {/* Categories */}
          {data.categories && data.categories.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
              {displayCategories.map((cat, idx) => (
                <Chip
                  key={idx}
                  label={cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  size="small"
                  sx={{
                    bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                    fontSize: { xs: "0.625rem", sm: "0.6875rem", md: "0.75rem" },
                    height: { xs: 20, sm: 22, md: 24 },
                    px: { xs: 1, sm: 1.25 },
                    borderRadius: 1.5,
                  }}
                />
              ))}
              {additionalCategoriesCount > 0 && (
                <Chip
                  label={`+${additionalCategoriesCount}`}
                  size="small"
                  sx={{
                    bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    fontSize: { xs: "0.625rem", sm: "0.6875rem", md: "0.75rem" },
                    height: { xs: 20, sm: 22, md: 24 },
                    px: { xs: 1, sm: 1.25 },
                    borderRadius: 1.5,
                  }}
                />
              )}
            </Box>
          )}

          {/* Google Maps Link */}
          {data.google_maps_url && (
            <Box
              component={Link}
              href={data.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                textDecoration: "none",
                "&:hover": { color: (theme) => theme.palette.primary.main },
                transition: "color 0.2s",
                mt: 0.5,
              }}
            >
              <OpenInNewRounded sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
              <Typography variant="bodyMedium" sx={{ fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" } }}>View on Google Maps</Typography>
            </Box>
          )}
        </Stack>

        {/* Thumbnail Rail */}
        {allPhotos.length > 1 && (
          <Box
            ref={thumbnailRef}
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              mb: 2,
              flexShrink: 0,
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
            role="tablist"
            aria-label="Photo thumbnails"
          >
            {allPhotos.map((photo, index) => {
              const isActive = index === currentPhotoIndex;
              const thumbnailUrl = buildPhotoUrl(photo.ref, 240);

              return (
                <Box
                  key={index}
                  component="button"
                  onClick={() => handleThumbnailClick(index)}
                  sx={{
                    position: "relative",
                    flexShrink: 0,
                    width: { xs: 56, sm: 64, md: 72 },
                    height: { xs: 56, sm: 64, md: 72 },
                    borderRadius: 1.5,
                    overflow: "hidden",
                    border: 2,
                    borderColor: isActive 
                      ? (theme) => theme.palette.primary.main 
                      : (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                    bgcolor: isActive 
                      ? (theme) => theme.palette.primaryContainer?.main || "#CFE9CF"
                      : "transparent",
                    cursor: "pointer",
                    "&:hover": { 
                      borderColor: (theme) => theme.palette.primary.main,
                    },
                    "&:focus": { 
                      outline: "2px solid", 
                      outlineColor: (theme) => theme.palette.primary.main, 
                      outlineOffset: 2 
                    },
                    transition: "all 0.2s",
                  }}
                  aria-label={`View photo ${index + 1}`}
                  aria-selected={isActive}
                  role="tab"
                >
                  {!imageErrors.has(index) ? (
                    <Image
                      src={thumbnailUrl}
                      alt={`${data.name} thumbnail ${index + 1}`}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="72px"
                      onError={() => setImageErrors((prev) => new Set(prev).add(index))}
                      unoptimized
                    />
                  ) : (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LocationOnRounded sx={{ color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41", fontSize: { xs: 20, sm: 24, md: 28 } }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Actions Section */}
        <Box
          sx={{
            display: "flex",
            gap: { xs: 1, sm: 1.5 },
            pt: 2,
            mt: "auto",
            justifyContent: "flex-end",
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
          }}
        >
          <Button
            onClick={handleReject}
            variant="outlined"
            size="medium"
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 500,
              fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" },
              px: { xs: 2, sm: 2.5, md: 3 },
              py: { xs: 0.75, sm: 1, md: 1.25 },
              color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
              borderColor: (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
              backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
              "&:hover": {
                backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                borderColor: (theme) => theme.palette.outline?.main || "#C7CEC3",
              },
            }}
          >
            {rejectButtonText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPreparing}
            variant="contained"
            size="medium"
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 500,
              fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" },
              px: { xs: 2, sm: 2.5, md: 3 },
              py: { xs: 0.75, sm: 1, md: 1.25 },
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
              "&:hover": {
                backgroundColor: (theme) => theme.palette.primary.dark || "#005005",
              },
              "&.Mui-disabled": {
                backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
              },
            }}
          >
            {isPreparing ? (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CircularProgress size={16} color="inherit" />
                <span style={{ fontSize: "inherit" }}>Preparing...</span>
              </Stack>
            ) : (
              confirmButtonText
            )}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
