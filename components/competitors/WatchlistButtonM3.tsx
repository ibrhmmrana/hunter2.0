"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Tooltip,
  CircularProgress,
  alpha,
} from "@mui/material";
import {
  AddRounded,
  CheckRounded,
} from "@mui/icons-material";
import { WatchlistSocialModal } from "./WatchlistSocialModal";
import { useWatchlist } from "./WatchlistContext";

interface WatchlistButtonM3Props {
  competitorPlaceId: string;
  competitorName: string;
  competitorAddress?: string | null;
}

export function WatchlistButtonM3({
  competitorPlaceId,
  competitorName,
  competitorAddress,
}: WatchlistButtonM3Props) {
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
        console.error("[WatchlistButtonM3] Failed to add to watchlist:", result.error);
      }
    } catch (error) {
      console.error("[WatchlistButtonM3] Error adding to watchlist:", error);
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
        console.error("[WatchlistButtonM3] Failed to stop watching:", result.error);
      }
    } catch (error) {
      console.error("[WatchlistButtonM3] Error stopping watch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Tooltip
        title={
          !isWatching && !isLoading
            ? "Track this competitor and get alerts when they receive new reviews or post on social media"
            : ""
        }
        arrow
        placement="top"
      >
        <Button
          onClick={isWatching ? handleStopWatching : handleAddToWatchlist}
          disabled={isLoading}
          variant={isWatching ? "contained" : "contained"}
          size="small"
          sx={(theme) => ({
            borderRadius: 999, // Pill shape
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.75rem",
            px: 1.5,
            py: 0.75,
            minWidth: "auto",
            backgroundColor: isWatching
              ? theme.palette.success.main || "#4CAF50"
              : alpha(theme.palette.surfaceContainerHigh?.main || "#F6FAF0", 0.9),
            color: isWatching
              ? theme.palette.onPrimary?.main || "#FFFFFF"
              : theme.palette.primary.main,
            "&:hover": {
              backgroundColor: isWatching
                ? theme.palette.success.dark || "#388E3C"
                : theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
            },
            boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
            backdropFilter: "blur(8px)",
          })}
          startIcon={
            isLoading ? (
              <CircularProgress size={12} sx={{ color: "inherit" }} />
            ) : isWatching ? (
              <CheckRounded sx={{ fontSize: 14 }} />
            ) : (
              <AddRounded sx={{ fontSize: 14 }} />
            )
          }
        >
          {isLoading
            ? isWatching
              ? "Removing..."
              : "Adding..."
            : isWatching
              ? "Watching"
              : "Add to watchlist"}
        </Button>
      </Tooltip>

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

