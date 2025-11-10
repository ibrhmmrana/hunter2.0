"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { formatReviewCount } from "@/lib/format";
import { placePhotoUrl } from "@/lib/google/photos";
import { buildAdvantageChips } from "@/lib/competitors/advantageChips";
import { cn } from "@/lib/utils";
import { WatchlistButton } from "./WatchlistButton";

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

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/98 overflow-hidden transition-all hover:shadow-lg/40">
      {/* Image block */}
      <div className="relative w-full h-[140px] md:h-[170px] bg-gradient-to-br from-slate-200 to-slate-300">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={competitor.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${photoUrl ? "hidden" : ""}`}>
          <div className="text-2xl font-bold text-slate-400">
            {getInitials(competitor.name)}
          </div>
        </div>
        {/* Overlay tag - show "Outranking you" for general competitors */}
        <div className="absolute top-2 left-2">
          <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-medium">
            Outranking you
          </span>
        </div>
        {/* Watchlist button - top right */}
        <div className="absolute top-2 right-2 z-10">
          <WatchlistButton
            competitorPlaceId={competitor.placeId}
            competitorName={competitor.name}
            competitorAddress={null}
          />
        </div>
      </div>

      {/* Content block */}
      <div className="p-4 space-y-2">
        {/* Top line */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
            {competitor.name}
          </h3>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            {distanceKm && (
              <>
                {distanceKm} away
                {competitor.rating != null && " · "}
              </>
            )}
            {competitor.rating != null && (
              <>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{" "}
                {competitor.rating.toFixed(1)}
                {competitor.reviews != null && " · "}
              </>
            )}
            {competitor.reviews != null && (
              <>{formatReviewCount(competitor.reviews)} reviews</>
            )}
            {competitor.rating == null && competitor.reviews == null && "No rating available"}
          </p>
        </div>

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
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {chips.map((chip, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1',
                    'border text-[11px]',
                    chip.tone === 'warning'
                      ? 'border-rose-100 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

