"use client";

import { ExternalLink } from "lucide-react";
import { CompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { cn } from "@/lib/utils";

interface TopSearchPositionCardProps {
  insights: CompetitorInsights;
}

export function TopSearchPositionCard({ insights }: TopSearchPositionCardProps) {
  const { topSearch, leaders } = insights;

  // Show empty state only if we have no topSearch data AND no leaders
  // If we have leaders but no topSearch, the SearchRankingLeaders component will handle it
  if (!topSearch && leaders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Top Search Ranking
        </h3>
        <p className="text-sm text-slate-600">
          We're analyzing your search rankings. Check back soon for your position.
        </p>
      </div>
    );
  }

  // If we have topSearch but no query, still show the card if we have position/heading
  if (!topSearch) {
    return null; // Let SearchRankingLeaders handle it
  }

  const { query, position, heading, isChasers } = topSearch;

  // Parse heading to extract rank
  const getRankDisplay = () => {
    if (heading) {
      // Try to parse rank from heading string
      const rankMatch = heading.match(/#(\d+)(\+?)/);
      if (rankMatch) {
        const rank = parseInt(rankMatch[1], 10);
        const hasPlus = rankMatch[2] === "+";
        const parts = heading.split(/#\d+\+?/);
        return {
          prefix: parts[0] || "You're ranked",
          rank,
          hasPlus,
          suffix: parts[1] || " for your top search",
        };
      }
    }

    // Fallback to position
    if (position !== null && position > 0) {
      return {
        prefix: "You're ranked",
        rank: position,
        hasPlus: false,
        suffix: " for your top search",
      };
    }

    // If we have a query but no position/heading, show a generic message
    if (query) {
      return {
        prefix: "Your search ranking",
        rank: null,
        hasPlus: false,
        suffix: " is being analyzed",
      };
    }

    return {
      prefix: "You're not in the top results",
      rank: null,
      hasPlus: false,
      suffix: " for your top search yet",
    };
  };

  const rankDisplay = getRankDisplay();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
            {rankDisplay.rank !== null ? (
              <>
                {rankDisplay.prefix}{" "}
                <span
                  className={cn(
                    "font-bold text-3xl md:text-4xl",
                    rankDisplay.rank === 1
                      ? "text-red-600"
                      : "text-amber-600"
                  )}
                >
                  #{rankDisplay.rank}
                  {rankDisplay.hasPlus ? "+" : ""}
                </span>
                {rankDisplay.suffix}
              </>
            ) : (
              `${rankDisplay.prefix}${rankDisplay.suffix}`
            )}
          </h2>
          {query && (
            <p className="text-sm md:text-[15px] text-slate-600">
              {isChasers
                ? "These businesses are right behind you. Stay ahead with consistent reviews and updates."
                : "We've looked at live Google results for this search and highlighted businesses appearing above you."}
            </p>
          )}
        </div>
        {query && (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-slate-50 text-sm text-slate-700 border border-slate-200 flex-shrink-0 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
          >
            Top search: <span className="font-medium">"{query}"</span>
            <ExternalLink className="h-3.5 w-3.5 inline-block ml-1.5" />
          </a>
        )}
      </div>
    </div>
  );
}

