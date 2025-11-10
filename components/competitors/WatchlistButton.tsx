"use client";

import { useState, useEffect } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WatchlistSocialModal } from "./WatchlistSocialModal";
import { useWatchlist } from "./WatchlistContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WatchlistButtonProps {
  competitorPlaceId: string;
  competitorName: string;
  competitorAddress?: string | null;
  className?: string;
}

export function WatchlistButton({
  competitorPlaceId,
  competitorName,
  competitorAddress,
  className,
}: WatchlistButtonProps) {
  const { isInWatchlist, getWatchlistId, refreshWatchlist } = useWatchlist();
  const [isWatching, setIsWatching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [missingNetworks, setMissingNetworks] = useState<string[]>([]);
  const [prefilledSocials, setPrefilledSocials] = useState<{
    instagram?: string;
    tiktok?: string;
    facebook?: string;
  }>({});

  // Check watchlist status immediately from context (no API call needed)
  useEffect(() => {
    const watching = isInWatchlist(competitorPlaceId);
    setIsWatching(watching);
    if (watching) {
      const id = getWatchlistId(competitorPlaceId);
      setWatchlistId(id);
    }
  }, [competitorPlaceId, isInWatchlist, getWatchlistId]);

  const handleAddToWatchlist = async () => {
    if (isWatching || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_place_id: competitorPlaceId,
          competitor_name: competitorName,
          competitor_address: competitorAddress,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setIsWatching(true);
        setWatchlistId(result.watchlist_id);
        
        // Refresh watchlist context to update all buttons
        await refreshWatchlist();
        
        // If there are missing networks, show modal with prefilled socials
        if (result.missingNetworks && result.missingNetworks.length > 0) {
          setMissingNetworks(result.missingNetworks);
          setPrefilledSocials(result.prefilledSocials || {});
          setShowSocialModal(true);
        }
      } else {
        console.error("[WatchlistButton] Failed to add to watchlist:", result.error);
        // You could show a toast here
      }
    } catch (error) {
      console.error("[WatchlistButton] Error adding to watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialModalClose = () => {
    setShowSocialModal(false);
    setMissingNetworks([]);
  };

  const handleStopWatching = async () => {
    if (!watchlistId || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/watchlist/${watchlistId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.ok) {
        setIsWatching(false);
        setWatchlistId(null);
        
        // Refresh watchlist context to update all buttons
        await refreshWatchlist();
      } else {
        console.error("[WatchlistButton] Failed to stop watching:", result.error);
      }
    } catch (error) {
      console.error("[WatchlistButton] Error stopping watch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={isWatching ? handleStopWatching : handleAddToWatchlist}
              disabled={isLoading}
              variant={isWatching ? "outline" : "default"}
              size="sm"
              className={cn(
                "text-xs font-medium",
                isWatching && "bg-green-500 text-white border-green-600 hover:bg-green-600 shadow-sm !opacity-100 disabled:!opacity-100",
                className
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  {isWatching ? "Removing..." : "Adding..."}
                </>
              ) : isWatching ? (
                <>
                  <Check className="w-3 h-3 mr-1.5" />
                  Watching
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1.5" />
                  Add to watchlist
                </>
              )}
            </Button>
          </TooltipTrigger>
          {!isWatching && !isLoading && (
            <TooltipContent 
              side="top" 
              className="max-w-[240px] text-xs bg-slate-900 text-white border-slate-700 z-[9999] whitespace-normal text-left [&>div]:bg-slate-900 [&>div]:border-slate-700"
            >
              Track this competitor and get alerts when they receive new reviews or post on social media
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {showSocialModal && watchlistId && (
        <WatchlistSocialModal
          watchlistId={watchlistId}
          competitorName={competitorName}
          missingNetworks={missingNetworks}
          prefilledSocials={prefilledSocials}
          onClose={handleSocialModalClose}
        />
      )}
    </>
  );
}

