"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  alpha,
} from "@mui/material";
import {
  StarRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { formatReviewCount } from "@/lib/format";
import { placePhotoUrl } from "@/lib/google/photos";
import { buildAdvantageChips } from "@/lib/competitors/advantageChips";
import { WatchlistButtonM3 } from "./WatchlistButtonM3";

interface LeaderCardM3Props {
  leader: CompetitorInsights["leaders"][0];
  displayedRank: number;
  isChaser?: boolean;
  primaryQuery: string;
  yourStats?: { rating: number | null; reviews: number | null };
  userRank?: number;
}

export function LeaderCardM3({
  leader,
  displayedRank,
  isChaser = false,
  primaryQuery,
  yourStats,
  userRank,
}: LeaderCardM3Props) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  // Get photos array or fallback to photo_reference
  const allPhotos =
    leader.photos && leader.photos.length > 0
      ? leader.photos
      : leader.photo_reference
        ? [leader.photo_reference]
        : [];

  const hasMultiplePhotos = allPhotos.length > 1;
  const currentPhotoRef = allPhotos[currentPhotoIndex] || null;
  const photoUrl = currentPhotoRef
    ? placePhotoUrl(currentPhotoRef, { maxWidth: 800 })
    : null;

  // Preload images
  useEffect(() => {
    allPhotos.forEach((photoRef, index) => {
      if (photoRef) {
        const img = new Image();
        const url = placePhotoUrl(photoRef, { maxWidth: 800 });
        img.src = url;
        img.onload = () => {
          setLoadedImages((prev) => new Set(prev).add(index));
        };
        img.onerror = () => {
          setLoadedImages((prev) => new Set(prev).add(index));
        };
      }
    });
  }, [allPhotos]);

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  const handlePreviousPhoto = () => {
    setCurrentPhotoIndex((prev) =>
      prev === 0 ? allPhotos.length - 1 : prev - 1
    );
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) =>
      prev === allPhotos.length - 1 ? 0 : prev + 1
    );
  };

  // Format distance
  const distanceText =
    leader.distance_m != null
      ? leader.distance_m < 1000
        ? `${leader.distance_m}m`
        : `${(leader.distance_m / 1000).toFixed(1)}km`
      : null;

  // Build advantage chips
  const chips =
    yourStats &&
    buildAdvantageChips({
      leader: {
        rating: leader.rating ?? null,
        reviews: leader.reviews ?? null,
      },
      you: yourStats,
    });

  // Supporting text
  const supportingText = isChaser
    ? "Right behind you — stay ahead."
    : userRank && userRank > 0
      ? "Currently ahead of you for this search."
      : "One of the leaders you're competing with.";

  // Image border radius - change this value to adjust image corner rounding
  const IMAGE_BORDER_RADIUS = 1; // MUI spacing units: 1 = 8px (rounded-lg), 1.5 = 12px, 2 = 16px (rounded-2xl), 3 = 24px

  return (
    <Card
      sx={{
        borderRadius: 2, // 16px
        backgroundColor: (theme) =>
          theme.palette.surfaceContainer?.main || "#FFFFFF",
        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* MEDIA REGION */}
      <Box
        sx={{
          m: 2, // 16px margin
          position: "relative",
          borderRadius: IMAGE_BORDER_RADIUS, // Change IMAGE_BORDER_RADIUS constant above to adjust
          overflow: "hidden",
          height: { xs: 220, md: 260 },
          backgroundColor: (theme) =>
            theme.palette.surfaceContainerLow?.main || "#E9EEE4",
        }}
      >
        {/* Photo or placeholder */}
        {photoUrl && !imageError ? (
          <>
            {allPhotos.map((photoRef, idx) => {
              if (!photoRef) return null;
              const isActive = idx === currentPhotoIndex;
              const url = placePhotoUrl(photoRef, { maxWidth: 800 });

              return (
                <Box
                  key={idx}
                  component="img"
                  src={url}
                  alt={`${leader.name} - Photo ${idx + 1}`}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 0.2s",
                    zIndex: isActive ? 10 : 0,
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                  onError={() => {
                    if (idx === currentPhotoIndex) setImageError(true);
                  }}
                />
              );
            })}
            {loadedImages.size === 0 && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(226,232,240,1) 0%, rgba(203,213,225,1) 100%)",
                  zIndex: 0,
                }}
              />
            )}
          </>
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(135deg, rgba(226,232,240,1) 0%, rgba(203,213,225,1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: { xs: "1.5rem", md: "1.875rem" },
              fontWeight: 700,
              color: (theme) => theme.palette.onSurfaceVariant?.main || "#444A41",
            }}
          >
            {getInitials(leader.name)}
          </Box>
        )}

        {/* Rank badge - top-left */}
        <Chip
          label={
            displayedRank === 1 ? (
              <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <span style={{ fontSize: "1.25rem" }}>👑</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.05em" }}>#{displayedRank}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.9, letterSpacing: "0.05em" }}>
                  TOP SPOT
                </span>
              </Box>
            ) : (
              <span style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.05em" }}>#{displayedRank}</span>
            )
          }
          sx={(theme) => ({
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 25,
            height: displayedRank === 1 ? 44 : 40,
            px: displayedRank === 1 ? 3 : 2.5,
            py: 1.25,
            backgroundColor:
              displayedRank === 1
                ? "#F5B400" // Gold
                : displayedRank === 2
                  ? theme.palette.error.main || "#E53935"
                  : theme.palette.warning.main || "#FB8C00",
            color: displayedRank === 1 ? "#1B1C19" : "#FFFFFF",
            fontWeight: 700,
            fontSize: displayedRank === 1 ? "1.125rem" : "1.0625rem",
            boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
            border: displayedRank === 1 ? "2px solid #FFC107" : "none",
            "& .MuiChip-label": {
              padding: 0,
              fontSize: "inherit",
            },
          })}
        />

        {/* Watchlist button - top-right */}
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 30,
          }}
        >
          <WatchlistButtonM3
            competitorPlaceId={leader.placeId}
            competitorName={leader.name}
            competitorAddress={null}
          />
        </Box>

        {/* Navigation arrows - only show if multiple photos */}
        {hasMultiplePhotos && photoUrl && !imageError && (
          <>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handlePreviousPhoto();
              }}
              sx={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 20,
                backgroundColor: (theme) =>
                  alpha(theme.palette.surfaceContainerHigh?.main || "#F6FAF0", 0.9),
                color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                "&:hover": {
                  backgroundColor: (theme) =>
                    theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                },
                width: 32,
                height: 32,
              }}
              aria-label="Previous photo"
            >
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleNextPhoto();
              }}
              sx={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 20,
                backgroundColor: (theme) =>
                  alpha(theme.palette.surfaceContainerHigh?.main || "#F6FAF0", 0.9),
                color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
                "&:hover": {
                  backgroundColor: (theme) =>
                    theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                },
                width: 32,
                height: 32,
              }}
              aria-label="Next photo"
            >
              <ChevronRightRounded fontSize="small" />
            </IconButton>

            {/* Photo indicator dots - bottom-center */}
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                display: "flex",
                gap: 1.5,
              }}
            >
              {allPhotos.map((_, idx) => (
                <Box
                  key={idx}
                  sx={{
                    width: idx === currentPhotoIndex ? 16 : 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      idx === currentPhotoIndex
                        ? (theme) => theme.palette.primary.main
                        : (theme) => theme.palette.outlineVariant?.main || "#DDE4D8",
                    transition: "all 0.2s",
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* CONTENT REGION */}
      <CardContent sx={{ px: 2.5, pt: 0.5, pb: 1.5 }}>
        {/* Title */}
        <Typography
          variant="titleLarge"
          sx={{
            fontWeight: 600,
            mb: 0.75,
            color: (theme) => theme.palette.onSurface?.main || "#1B1C19",
          }}
        >
          {leader.name}
        </Typography>

        {/* Subtitle row: distance + rating + review count */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 0.75, flexWrap: "wrap" }}
        >
          {distanceText && (
            <>
              <Typography
                variant="bodyMedium"
                sx={{
                  color: (theme) =>
                    theme.palette.onSurfaceVariant?.main || "#444A41",
                }}
              >
                {distanceText} away
              </Typography>
              {leader.rating != null && (
                <Typography
                  variant="bodyMedium"
                  sx={{
                    color: (theme) =>
                      theme.palette.onSurfaceVariant?.main || "#444A41",
                  }}
                >
                  •
                </Typography>
              )}
            </>
          )}
          {leader.rating != null && (
            <>
              <StarRounded
                sx={{
                  fontSize: 16,
                  color: "#F5B400",
                }}
              />
              <Typography variant="bodyMedium" sx={{ fontWeight: 600 }}>
                {leader.rating.toFixed(1)}
              </Typography>
              {leader.reviews != null && (
                <>
                  <Typography
                    variant="bodyMedium"
                    sx={{
                      color: (theme) =>
                        theme.palette.onSurfaceVariant?.main || "#444A41",
                    }}
                  >
                    •
                  </Typography>
                  <Typography
                    variant="bodyMedium"
                    sx={{
                      color: (theme) =>
                        theme.palette.onSurfaceVariant?.main || "#444A41",
                    }}
                  >
                    {formatReviewCount(leader.reviews)} reviews
                  </Typography>
                </>
              )}
            </>
          )}
          {leader.rating == null && leader.reviews != null && (
            <Typography
              variant="bodyMedium"
              sx={{
                color: (theme) =>
                  theme.palette.onSurfaceVariant?.main || "#444A41",
              }}
            >
              {formatReviewCount(leader.reviews)} reviews
            </Typography>
          )}
          {leader.rating == null &&
            leader.reviews == null &&
            distanceText == null && (
              <Typography
                variant="bodyMedium"
                sx={{
                  color: (theme) =>
                    theme.palette.onSurfaceVariant?.main || "#444A41",
                }}
              >
                No rating available
              </Typography>
            )}
        </Stack>

        {/* Advantage chips */}
        {chips && chips.length > 0 && (
          <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {chips.map((chip, idx) => (
              <Chip
                key={idx}
                label={chip.label}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.6875rem",
                  backgroundColor: (theme) =>
                    chip.tone === "warning"
                      ? theme.palette.error.light || "#FFEBEE"
                      : theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                  color: (theme) =>
                    chip.tone === "warning"
                      ? theme.palette.error.dark || "#C62828"
                      : theme.palette.onSurface?.main || "#1B1C19",
                  border: "1px solid",
                  borderColor: (theme) =>
                    chip.tone === "warning"
                      ? theme.palette.error.main || "#E53935"
                      : theme.palette.outlineVariant?.main || "#DDE4D8",
                  borderRadius: 999,
                }}
              />
            ))}
          </Box>
        )}

        {/* Supporting text */}
        <Typography
          variant="caption"
          sx={{
            mt: 1,
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: (theme) => {
              if (isChaser) {
                return theme.palette.warning.main || "#FB8C00";
              } else if (userRank && userRank > 0) {
                return theme.palette.error.main || "#E53935";
              } else {
                return theme.palette.onSurfaceVariant?.main || "#444A41";
              }
            },
          }}
        >
          {supportingText}
        </Typography>
      </CardContent>

      {/* ACTIONS REGION - Only if needed */}
      {/* Currently no footer actions, so this section is omitted */}
    </Card>
  );
}

