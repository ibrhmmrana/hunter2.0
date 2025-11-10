"use client";

import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { formatReviewCount } from "@/lib/format";
import { placePhotoUrl } from "@/lib/google/photos";
import { buildAdvantageChips } from "@/lib/competitors/advantageChips";
import { cn } from "@/lib/utils";
import { WatchlistButton } from "./WatchlistButton";

interface SearchRankingLeadersProps {
  insights: CompetitorInsights;
}

type CompetitorLeader = CompetitorInsights["leaders"][0];

export function SearchRankingLeaders({ insights }: SearchRankingLeadersProps) {
  const [leaders, setLeaders] = useState<CompetitorLeader[]>(insights.leaders);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Start with hasMore = true if we have initial leaders (likely more available)
  const [hasMore, setHasMore] = useState(insights.leaders.length >= 6);
  const [noMoreMessage, setNoMoreMessage] = useState<string | null>(null);
  const { topSearch } = insights;
  const isChasers = topSearch?.isChasers || false;
  const primaryQuery = topSearch?.query || null;
  const userRank = topSearch?.position ?? undefined;

  if (leaders.length === 0 && !isLoadingMore) {
    return null; // Don't show this section if there are no search ranking leaders
  }

  // Calculate rank offset for leader cards (if first leader is #2, it means #1 was sponsored)
  const rankOffset = leaders.length > 0 && leaders[0].rank && leaders[0].rank > 1 ? leaders[0].rank - 1 : 0;

  const handleLoadMore = async () => {
    console.log("[SearchRankingLeaders] handleLoadMore called!");
    console.log("[SearchRankingLeaders] Loading more leaders...", {
      businessPlaceId: insights.businessPlaceId,
      currentCount: leaders.length,
    });
    
    setIsLoadingMore(true);
    setNoMoreMessage(null);
    
    try {
      const response = await fetch("/api/competitors/search-leaders/load-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessPlaceId: insights.businessPlaceId,
          currentCount: leaders.length,
          query: primaryQuery,
        }),
      });

      console.log("[SearchRankingLeaders] Response status:", response.status);

      const result = await response.json();
      console.log("[SearchRankingLeaders] Response result:", result);

      if (result.ok) {
        if (result.leaders && result.leaders.length > 0) {
          setLeaders((prev) => [...prev, ...result.leaders]);
          setHasMore(result.hasMore);
          if (!result.hasMore) {
            setNoMoreMessage("No more businesses ranking above you for this search.");
          }
        } else {
          setHasMore(false);
          setNoMoreMessage("No more businesses ranking above you for this search.");
        }
      } else {
        console.error("[SearchRankingLeaders] Failed to load more:", result.error);
        setHasMore(false);
        setNoMoreMessage("Unable to load more results. Please try again later.");
      }
    } catch (error) {
      console.error("[SearchRankingLeaders] Error loading more leaders:", error);
      setHasMore(false);
      setNoMoreMessage("Unable to load more results. Please try again later.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
              {isChasers ? "Who's right behind you" : "Businesses ranking above you"}
            </h2>
            <p className="text-sm md:text-[15px] text-slate-600">
              {isChasers
                ? "These businesses are right behind you. Stay ahead with consistent reviews and updates."
                : "We've looked at live Google results for this search and highlighted businesses appearing above you."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {leaders.map((leader) => {
          // For chasers, don't adjust rank offset - show actual ranks (#2, #3, etc.)
          // For leaders above user, adjust if first is #2 (sponsored #1)
          const displayedRank = isChasers 
            ? (leader.rank || 1)
            : ((leader.rank || 1) - rankOffset);

          return (
            <LeaderCard
              key={leader.placeId}
              leader={leader}
              displayedRank={displayedRank}
              isChaser={isChasers}
              primaryQuery={primaryQuery || ''}
              yourStats={insights.yourStats}
              userRank={userRank}
            />
          );
        })}
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

      {noMoreMessage && (
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">{noMoreMessage}</p>
        </div>
      )}
    </div>
  );
}

function LeaderCard({
  leader,
  displayedRank,
  isChaser = false,
  primaryQuery,
  yourStats,
  userRank,
}: {
  leader: CompetitorInsights["leaders"][0];
  displayedRank: number;
  isChaser?: boolean;
  primaryQuery: string;
  yourStats?: { rating: number | null; reviews: number | null };
  userRank?: number;
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  // Get photos array or fallback to photo_reference
  const allPhotos = leader.photos && leader.photos.length > 0
    ? leader.photos
    : (leader.photo_reference ? [leader.photo_reference] : []);

  const hasMultiplePhotos = allPhotos.length > 1;
  const currentPhotoRef = allPhotos[currentPhotoIndex] || null;
  const photoUrl = currentPhotoRef ? placePhotoUrl(currentPhotoRef, { maxWidth: 800 }) : null;

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

  return (
    <div className="group relative border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      {/* Square image container */}
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {/* Ranking pill - only for search ranking leaders */}
        <div
          className={cn(
            "absolute top-3 left-3 z-[25] rounded-lg font-bold shadow-lg",
            "backdrop-blur-sm border-2 transition-all duration-300",
            "group-hover:scale-110",
            displayedRank === 1
              ? "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-amber-950 border-amber-300 shadow-amber-500/50 px-3 py-1.5 text-sm"
              : displayedRank === 2
              ? "bg-gradient-to-br from-rose-500 via-red-500 to-rose-600 text-white border-rose-400 shadow-rose-500/50 px-3 py-1.5 text-sm"
              : "bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white border-orange-400 shadow-orange-500/50 px-2.5 py-1 text-xs"
          )}
        >
          <div className="flex items-center gap-1.5">
            {displayedRank === 1 && <span className="text-base leading-none">👑</span>}
            <span className="leading-tight">#{displayedRank}</span>
            {displayedRank === 1 && (
              <span className="text-[10px] font-semibold opacity-90 leading-tight">TOP SPOT</span>
            )}
          </div>
        </div>

        {/* Photo or placeholder */}
        {photoUrl && !imageError ? (
          <>
            {allPhotos.map((photoRef, idx) => {
              if (!photoRef) return null;
              const isActive = idx === currentPhotoIndex;
              const url = placePhotoUrl(photoRef, { maxWidth: 800 });
              
              return (
                <img
                  key={idx}
                  src={url}
                  alt={`${leader.name} - Photo ${idx + 1}`}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
                    isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                  )}
                  onError={() => {
                    if (idx === currentPhotoIndex) setImageError(true);
                  }}
                />
              );
            })}
            {loadedImages.size === 0 && (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 z-0" />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-2xl md:text-3xl font-bold text-slate-600">
            {getInitials(leader.name)}
          </div>
        )}

        {/* Navigation arrows - only show if multiple photos */}
        {hasMultiplePhotos && photoUrl && !imageError && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPhotoIndex((prev) => (prev === 0 ? allPhotos.length - 1 : prev - 1));
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 hover:bg-white shadow-lg transition-all"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPhotoIndex((prev) => (prev === allPhotos.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 hover:bg-white shadow-lg transition-all"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
            
            {/* Photo indicator dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {allPhotos.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    idx === currentPhotoIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
        
        {/* Watchlist button - top right */}
        <div className="absolute top-2 right-2 z-30">
          <WatchlistButton
            competitorPlaceId={leader.placeId}
            competitorName={leader.name}
            competitorAddress={null}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-1">
        <div className="font-medium text-slate-900 truncate">{leader.name}</div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          {leader.distance_m != null && (
            <>
              {leader.distance_m < 1000
                ? `${leader.distance_m}m`
                : `${(leader.distance_m / 1000).toFixed(1)}km`}
              {" away"}
              {leader.rating != null && " · "}
            </>
          )}
          {leader.rating != null && (
            <>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {leader.rating.toFixed(1)} · {formatReviewCount(leader.reviews)} reviews
            </>
          )}
          {leader.rating == null && leader.reviews != null && (
            <>{formatReviewCount(leader.reviews)} reviews</>
          )}
          {leader.rating == null && leader.reviews == null && "No rating available"}
        </div>

        {/* Advantage chips */}
        {yourStats && (() => {
          const chips = buildAdvantageChips({
            leader: {
              rating: leader.rating ?? null,
              reviews: leader.reviews ?? null,
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
        
        <div className="mt-1 text-[10px] font-medium">
          {isChaser ? (
            <span className="text-amber-600">Right behind you — stay ahead.</span>
          ) : userRank && userRank > 0 ? (
            <span className="text-rose-600">Currently ahead of you for this search.</span>
          ) : (
            <span className="text-slate-600">One of the leaders you're competing with.</span>
          )}
        </div>
      </div>
    </div>
  );
}

