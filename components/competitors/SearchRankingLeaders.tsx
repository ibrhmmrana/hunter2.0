"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { LeaderCardM3 } from "./LeaderCardM3";

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
            <LeaderCardM3
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

