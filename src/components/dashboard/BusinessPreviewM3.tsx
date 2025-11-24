"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Stack,
  Avatar,
  CircularProgress,
  alpha,
  useMediaQuery,
  useTheme,
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

interface BusinessPreviewM3Props {
  data: ConfirmBusinessData;
  placeId: string;
}

export function BusinessPreviewM3({
  data,
  placeId,
}: BusinessPreviewM3Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

  // Get business initials for placeholder
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2);
  };

  // Filter and format categories
  const displayCategories = (data.categories || [])
    .filter((cat) => !["establishment", "point_of_interest"].includes(cat))
    .slice(0, 3);

  // Hero image URL with fallback
  const heroImageUrl = currentPhoto
    ? buildPhotoUrl(currentPhoto.ref, 1200)
    : data.image_url || null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.8fr 1fr" },
        gap: 3,
        width: "100%",
      }}
    >
      {/* LEFT: Media Section */}
      <Box>
        <Stack spacing={2}>
          {/* Hero Image */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
              boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
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
                  sizes="(max-width: 768px) 100vw, 60vw"
                  onError={() => setImageErrors((prev) => new Set(prev).add(currentPhotoIndex))}
                  unoptimized={heroImageUrl.startsWith("/api/places/photo")}
                />

                {/* Overlay Gradient for text readability */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 40%)",
                  }}
                />

                {/* Top-left Category Chips */}
                {displayCategories.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    {displayCategories.map((cat, idx) => (
                      <Chip
                        key={idx}
                        label={cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        size="small"
                        sx={{
                          bgcolor: alpha("#fff", 0.9),
                          backdropFilter: "blur(8px)",
                          fontSize: "0.75rem",
                          height: 24,
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Stack>
                )}

                {/* Bottom-left Title + Rating Overlay */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 3,
                    color: "white",
                  }}
                >
                  <Typography
                    variant="titleLarge"
                    sx={{
                      mb: 1,
                      fontWeight: 500,
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                    }}
                  >
                    {data.name}
                  </Typography>
                  {data.rating !== undefined && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StarRounded sx={{ color: "#FFC107", fontSize: 18 }} />
                      <Typography variant="bodyMedium" fontWeight={500}>
                        {data.rating.toFixed(1)}
                      </Typography>
                      {data.reviews_count && (
                        <Typography variant="bodySmall" sx={{ opacity: 0.9 }}>
                          ({data.reviews_count.toLocaleString()})
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Box>

                {/* Navigation Arrows */}
                {allPhotos.length > 1 && (
                  <>
                    <IconButton
                      onClick={handlePreviousPhoto}
                      sx={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        bgcolor: alpha("#000", 0.5),
                        color: "white",
                        opacity: 0,
                        "&:hover": { bgcolor: alpha("#000", 0.7), opacity: 1 },
                        ".group:hover &": { opacity: 1 },
                        "&:focus": { opacity: 1 },
                      }}
                      aria-label="Previous photo"
                    >
                      <ChevronLeftRounded />
                    </IconButton>
                    <IconButton
                      onClick={handleNextPhoto}
                      sx={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        bgcolor: alpha("#000", 0.5),
                        color: "white",
                        opacity: 0,
                        "&:hover": { bgcolor: alpha("#000", 0.7), opacity: 1 },
                        ".group:hover &": { opacity: 1 },
                        "&:focus": { opacity: 1 },
                      }}
                      aria-label="Next photo"
                    >
                      <ChevronRightRounded />
                    </IconButton>
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
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: alpha("#fff", 0.2),
                    mb: 2,
                  }}
                >
                  <Typography variant="h5" fontWeight={700}>
                    {getInitials(data.name)}
                  </Typography>
                </Avatar>
                <Typography variant="body1" fontWeight={500} sx={{ color: "white" }}>
                  {data.name}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Thumbnail Carousel */}
          {allPhotos.length > 1 && (
            <Box
              ref={thumbnailRef}
              sx={{
                display: "flex",
                gap: 1,
                overflowX: "auto",
                pb: 1,
                scrollSnapType: "x mandatory",
                "&::-webkit-scrollbar": {
                  height: 4,
                },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "action.disabled",
                  borderRadius: 2,
                },
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
                      width: 72,
                      height: 72,
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
                        outlineOffset: 2,
                      },
                      transition: "all 0.2s",
                      scrollSnapAlign: "start",
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
                        <LocationOnRounded sx={{ color: "text.secondary" }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
      </Box>

      {/* RIGHT: Details Section */}
      <Box>
        <Stack spacing={2}>
          {/* Business Name */}
          <Typography variant="titleLarge" sx={{ fontWeight: 500 }}>
            {data.name}
          </Typography>

          {/* Meta Info Rows */}
          <Stack spacing={1.5}>
            {/* Address */}
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <LocationOnRounded
                sx={{
                  fontSize: 18,
                  color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                  mt: 0.5,
                }}
              />
              <Typography
                variant="bodyMedium"
                sx={{
                  color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                }}
              >
                {data.address}
              </Typography>
            </Stack>

            {/* Phone */}
            {data.phone && (
              <Box
                component="a"
                href={`tel:${data.phone}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                  textDecoration: "none",
                  "&:hover": {
                    color: (theme) => theme.palette.primary.main,
                  },
                  transition: "color 0.2s",
                }}
              >
                <PhoneRounded sx={{ fontSize: 18 }} />
                <Typography variant="bodyMedium">{data.phone}</Typography>
              </Box>
            )}

            {/* Open/Closed Status */}
            {data.is_open_now !== undefined && (
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeRounded
                  sx={{
                    fontSize: 18,
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                  }}
                />
                <Chip
                  label={data.is_open_now ? "Open now" : "Closed"}
                  size="small"
                  sx={{
                    bgcolor: data.is_open_now
                      ? (theme) => theme.palette.success?.light || "#81C784"
                      : (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    color: data.is_open_now
                      ? (theme) => theme.palette.success?.dark || "#2E7D32"
                      : (theme) => theme.palette.onSurface?.main || "#1B1C19",
                    fontSize: "0.75rem",
                    height: 24,
                    fontWeight: 500,
                    border: data.is_open_now ? "none" : "1px solid",
                    borderColor: data.is_open_now
                      ? "transparent"
                      : (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                  }}
                />
              </Stack>
            )}
          </Stack>

          {/* Category Chips */}
          {data.categories && data.categories.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {displayCategories.map((cat, idx) => (
                <Chip
                  key={idx}
                  label={cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  size="small"
                  sx={{
                    bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                    fontSize: "0.75rem",
                    height: 28,
                    fontWeight: 400,
                  }}
                />
              ))}
            </Box>
          )}

          {/* Rating Row */}
          {data.rating !== undefined && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <StarRounded sx={{ color: "#FFC107", fontSize: 18 }} />
                <Typography variant="bodyMedium" fontWeight={500}>
                  {data.rating.toFixed(1)}
                </Typography>
                {data.reviews_count && (
                  <Typography
                    variant="bodySmall"
                    sx={{
                      color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    }}
                  >
                    ({data.reviews_count.toLocaleString()} reviews)
                  </Typography>
                )}
              </Stack>

              {data.google_maps_url && (
                <Box
                  component={Link}
                  href={data.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
                    textDecoration: "none",
                    "&:hover": {
                      color: (theme) => theme.palette.primary.main,
                    },
                    transition: "color 0.2s",
                  }}
                >
                  <OpenInNewRounded sx={{ fontSize: 16 }} />
                  <Typography variant="caption">View on Google Maps</Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

