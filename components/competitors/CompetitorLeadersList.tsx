"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Stack,
  Chip,
  alpha,
} from "@mui/material";
import { StarRounded } from "@mui/icons-material";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { formatReviewCount } from "@/lib/format";
import { placePhotoUrl } from "@/lib/google/photos";
import { buildAdvantageChips } from "@/lib/competitors/advantageChips";
import { WatchlistButtonM3 } from "./WatchlistButtonM3";

interface CompetitorLeadersListProps {
  insights: CompetitorInsights;
}

type CompetitorLeader = CompetitorInsights["aheadCompetitors"][0];

export function CompetitorLeadersList({ insights }: CompetitorLeadersListProps) {
  const [competitors, setCompetitors] = useState<CompetitorLeader[]>(insights.aheadCompetitors);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Start with hasMore = true - we'll let the API tell us if there are more
  // This ensures the button shows up even if we have fewer than 6 initially
  const [hasMore, setHasMore] = useState(true);
  const [currentTier, setCurrentTier] = useState(0);
  const [displayedPlaceIds, setDisplayedPlaceIds] = useState<Set<string>>(
    new Set(insights.aheadCompetitors.map(c => c.placeId))
  );

  const handleLoadMore = async () => {
    console.log("[CompetitorLeadersList] handleLoadMore called!");
    console.log("[CompetitorLeadersList] Loading more competitors...", {
      businessPlaceId: insights.businessPlaceId,
      currentCount: competitors.length,
      tier: currentTier,
      excludePlaceIds: Array.from(displayedPlaceIds).length,
    });
    
    setIsLoadingMore(true);
    try {
      const requestBody = {
        businessPlaceId: insights.businessPlaceId,
        currentCount: competitors.length,
        tier: currentTier,
        excludePlaceIds: Array.from(displayedPlaceIds), // Send already displayed IDs to avoid duplicates
      };
      
      console.log("[CompetitorLeadersList] Making fetch request", requestBody);
      
      const response = await fetch("/api/competitors/load-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log("[CompetitorLeadersList] Response received", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[CompetitorLeadersList] Response not OK", { status: response.status, errorText });
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log("[CompetitorLeadersList] Response result:", result);

      if (result.ok && result.competitors) {
        // Filter out any duplicates (shouldn't happen, but just in case)
        const newCompetitors = result.competitors.filter(
          (c: CompetitorLeader) => !displayedPlaceIds.has(c.placeId)
        );

        console.log("[CompetitorLeadersList] New competitors after filtering:", newCompetitors.length);

        if (newCompetitors.length > 0) {
          setCompetitors((prev) => [...prev, ...newCompetitors]);
          setDisplayedPlaceIds((prev) => {
            const updated = new Set(prev);
            newCompetitors.forEach((c: CompetitorLeader) => updated.add(c.placeId));
            return updated;
          });
        }

        // Update hasMore based on API response
        // If we got fewer results than requested, or API says no more, hide button
        if (result.hasMore !== undefined) {
          setHasMore(result.hasMore);
        } else if (newCompetitors.length === 0) {
          // If we got no new competitors, assume no more available
          setHasMore(false);
        }
        setCurrentTier(result.nextTier);
      } else {
        console.error("[CompetitorLeadersList] Failed to load more:", result.error);
        // Don't set hasMore to false on error - let user retry
        // setHasMore(false);
      }
    } catch (error) {
      console.error("[CompetitorLeadersList] Error loading more competitors:", error);
      // Don't set hasMore to false on error - let user retry
      // setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (competitors.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Your competitors are ahead
        </h3>
        <p className="text-sm text-slate-600">
          We're analyzing your competitors. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
          Your competitors are ahead
        </h2>
        <p className="text-sm md:text-[15px] text-slate-600">
          For real searches like these, nearby customers are choosing other spots first. Here's who is winning your 'near me' moments.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitors.map((competitor, index) => (
          <CompetitorTile 
            key={competitor.placeId} 
            competitor={competitor}
            index={index}
            yourStats={insights.yourStats}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            className="rounded-xl"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "See more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function CompetitorTile({
  competitor,
  index,
  yourStats,
}: {
  competitor: CompetitorInsights["aheadCompetitors"][0];
  index: number;
  yourStats?: { rating: number | null; reviews: number | null };
}) {
  const distanceKm = competitor.distance_m != null
    ? (competitor.distance_m < 1000
        ? `${competitor.distance_m}m`
        : `${(competitor.distance_m / 1000).toFixed(1)}km`)
    : null;

  // Get photo URL from photos array or photo_reference
  const photoRef = (competitor.photos && competitor.photos.length > 0)
    ? competitor.photos[0]
    : competitor.photo_reference;
  const photoUrl = photoRef ? placePhotoUrl(photoRef, { maxWidth: 800 }) : null;

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  // Image border radius - change this value to adjust image corner rounding
  // MUI spacing units: 0.5 = 4px (rounded), 1 = 8px (rounded-lg), 1.5 = 12px, 2 = 16px (rounded-2xl)
  const IMAGE_BORDER_RADIUS = 0.5; // 4px (rounded)

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
          borderRadius: IMAGE_BORDER_RADIUS, // 4px (rounded)
          overflow: "hidden",
          height: { xs: 220, md: 260 },
          backgroundColor: (theme) =>
            theme.palette.surfaceContainerLow?.main || "#E9EEE4",
        }}
      >
        {/* Photo or placeholder */}
        {photoUrl ? (
          <Box
            component="img"
            src={photoUrl}
            alt={competitor.name}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
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
            {getInitials(competitor.name)}
          </Box>
        )}

        {/* "Outranking you" badge - top-left */}
        <Chip
          label="Outranking you"
          sx={(theme) => ({
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 25,
            height: "auto",
            px: 1.5,
            py: 0.75,
            backgroundColor: theme.palette.error.main || "#E53935",
            color: "#FFFFFF",
            fontWeight: 500,
            fontSize: "0.75rem",
            letterSpacing: "0.05em",
            boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
            border: "none",
            borderRadius: 999, // Pill shape to match watchlist button
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
            competitorPlaceId={competitor.placeId}
            competitorName={competitor.name}
            competitorAddress={null}
          />
        </Box>
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
          {competitor.name}
        </Typography>

        {/* Subtitle row: distance + rating + review count */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 0.75, flexWrap: "wrap" }}
        >
          {distanceKm && (
            <>
              <Typography
                variant="bodyMedium"
                sx={{
                  color: (theme) =>
                    theme.palette.onSurfaceVariant?.main || "#444A41",
                }}
              >
                {distanceKm} away
              </Typography>
              {competitor.rating != null && (
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
          {competitor.rating != null && (
            <>
              <StarRounded
                sx={{
                  fontSize: 16,
                  color: "#F5B400",
                }}
              />
              <Typography variant="bodyMedium" sx={{ fontWeight: 600 }}>
                {competitor.rating.toFixed(1)}
              </Typography>
              {competitor.reviews != null && (
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
                    {formatReviewCount(competitor.reviews)} reviews
                  </Typography>
                </>
              )}
            </>
          )}
          {competitor.rating == null && competitor.reviews != null && (
            <Typography
              variant="bodyMedium"
              sx={{
                color: (theme) =>
                  theme.palette.onSurfaceVariant?.main || "#444A41",
              }}
            >
              {formatReviewCount(competitor.reviews)} reviews
            </Typography>
          )}
          {competitor.rating == null &&
            competitor.reviews == null &&
            !distanceKm && (
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
        {yourStats && (() => {
          const chips = buildAdvantageChips({
            leader: {
              rating: competitor.rating ?? null,
              reviews: competitor.reviews ?? null,
            },
            you: yourStats,
          });
          
          return chips.length > 0 ? (
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
          ) : null;
        })()}
      </CardContent>
    </Card>
  );
}

