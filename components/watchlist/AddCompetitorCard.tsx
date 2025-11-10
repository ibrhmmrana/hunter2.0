"use client";

import { useState, useCallback } from "react";
import { BusinessSearchBox } from "@/components/BusinessSearchBox";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { WatchlistSocialModal } from "@/components/competitors/WatchlistSocialModal";

interface AddCompetitorCardProps {
  onCompetitorAdded?: () => void;
}

export function AddCompetitorCard({ onCompetitorAdded }: AddCompetitorCardProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    place_id: string;
    name: string;
    address: string;
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [missingNetworks, setMissingNetworks] = useState<string[]>([]);
  const [prefilledSocials, setPrefilledSocials] = useState<{
    instagram?: string;
    tiktok?: string;
    facebook?: string;
  }>({});
  const [competitorName, setCompetitorName] = useState<string>("");

  const handlePlaceSelect = useCallback(async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setIsLoadingDetails(true);
    setError(null);
    setConfirmData(null);

    try {
      const response = await fetch(`/api/places/confirm?placeId=${encodeURIComponent(placeId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          if (errorData.error === "NOT_FOUND") {
            setError("Business not found. Please try a different search.");
            return;
          }
        }
        throw new Error("Failed to load business details");
      }

      const data = await response.json();
      setConfirmData({
        place_id: data.place_id,
        name: data.name,
        address: data.address,
      });
    } catch (err: any) {
      console.error("[AddCompetitorCard] Failed to fetch place details:", err);
      setError(err.message || "Failed to load business details");
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const handleAddToWatchlist = useCallback(async () => {
    if (!confirmData) return;

    setIsAdding(true);
    setError(null);

    try {
      console.log("[watchlist] manual-add competitor", {
        place_id: confirmData.place_id,
        name: confirmData.name,
      });

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_place_id: confirmData.place_id,
          competitor_name: confirmData.name,
          competitor_address: confirmData.address,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Failed to add competitor");
      }

      // Check if we need to prompt for socials
      if (result.missingNetworks && result.missingNetworks.length > 0) {
        setWatchlistId(result.watchlist_id);
        setMissingNetworks(result.missingNetworks);
        setPrefilledSocials(result.prefilledSocials || {});
        setCompetitorName(confirmData.name);
        setShowSocialModal(true);
      } else {
        // No missing socials, just refresh the list
        if (onCompetitorAdded) {
          onCompetitorAdded();
        }
        // Reset form
        setSelectedPlaceId(null);
        setConfirmData(null);
      }
    } catch (err: any) {
      console.error("[AddCompetitorCard] Error adding to watchlist:", err);
      setError(err.message || "Failed to add competitor to watchlist");
    } finally {
      setIsAdding(false);
    }
  }, [confirmData, onCompetitorAdded]);

  const handleSocialModalClose = useCallback(() => {
    setShowSocialModal(false);
    setWatchlistId(null);
    setMissingNetworks([]);
    setCompetitorName("");
    // Reset form and refresh list
    setSelectedPlaceId(null);
    setConfirmData(null);
    if (onCompetitorAdded) {
      onCompetitorAdded();
    }
  }, [onCompetitorAdded]);

  const handleReset = useCallback(() => {
    setSelectedPlaceId(null);
    setConfirmData(null);
    setError(null);
  }, []);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Add a competitor to your watchlist
          </h2>
          <p className="text-sm text-slate-600">
            Search any local business you want Hunter to monitor for you.
          </p>
        </div>

        <div className="space-y-4">
          <BusinessSearchBox onSelect={handlePlaceSelect} />

          {isLoadingDetails && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading business details...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {confirmData && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div>
                <h3 className="font-medium text-slate-900">{confirmData.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{confirmData.address}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isAdding}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToWatchlist}
                  disabled={isAdding}
                  size="sm"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add to watchlist
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSocialModal && watchlistId && missingNetworks.length > 0 && (
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

