"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ExternalLink, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AddCompetitorCard } from "@/components/watchlist/AddCompetitorCard";

interface WatchlistEntry {
  id: string;
  competitor_name: string;
  competitor_address: string | null;
  competitor_place_id: string;
  business_place_id: string;
  created_at: string;
  socials: Array<{
    network: string;
    handle_or_url: string;
  }>;
}

interface WatchlistPageContentProps {
  initialWatchlist: WatchlistEntry[];
}

const networkIcons: Record<string, string> = {
  google: "🔍",
  instagram: "📷",
  tiktok: "🎵",
  facebook: "👥",
};

const networkLabels: Record<string, string> = {
  google: "Google",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export function WatchlistPageContent({ initialWatchlist }: WatchlistPageContentProps) {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(initialWatchlist);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const handleCompetitorAdded = useCallback(async () => {
    // Refresh the watchlist from the server
    try {
      const response = await fetch("/api/watchlist");
      const result = await response.json();
      if (result.ok && result.watchlist) {
        setWatchlist(result.watchlist);
      }
    } catch (error) {
      console.error("[WatchlistPageContent] Error refreshing watchlist:", error);
      // Fallback to router refresh
      router.refresh();
    }
  }, [router]);

  const handleStopWatching = async (id: string) => {
    if (removingIds.has(id)) return;

    setRemovingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.ok) {
        // Optimistically remove from UI
        setWatchlist((prev) => prev.filter((entry) => entry.id !== id));
        // Refresh to ensure consistency
        router.refresh();
      } else {
        console.error("[WatchlistPage] Failed to stop watching:", result.error);
        // You could show a toast here
      }
    } catch (error) {
      console.error("[WatchlistPage] Error stopping watch:", error);
    } finally {
      setRemovingIds((prev) => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Watchlist</h1>
        <p className="text-muted-foreground">
          Competitors you're actively monitoring for reviews and social activity.
        </p>
      </div>

      {/* Add Competitor Card */}
      <AddCompetitorCard onCompetitorAdded={handleCompetitorAdded} />

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No competitors in your watchlist (yet)
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Use the search above to add competitors, or add them from the Competitors page.
            </p>
            <Button asChild variant="outline">
              <Link href="/competitors">Go to Competitors</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlist.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
          >
            {/* Header */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {entry.competitor_name}
              </h3>
              {entry.competitor_address && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{entry.competitor_address}</span>
                </div>
              )}
            </div>

            {/* Monitoring badge */}
            <div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Monitoring
              </Badge>
            </div>

            {/* Social networks */}
            {entry.socials.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Tracking:</p>
                <div className="flex flex-wrap gap-2">
                  {entry.socials.map((social, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-xs"
                    >
                      <span className="mr-1">{networkIcons[social.network] || "•"}</span>
                      {networkLabels[social.network] || social.network}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* View on Maps link */}
            <div>
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${entry.competitor_place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View on Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Info text */}
            <p className="text-xs text-slate-500">
              Alerts for this competitor will appear in your Alerts tab.
            </p>

            {/* Stop watching button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStopWatching(entry.id)}
              disabled={removingIds.has(entry.id)}
              className="w-full"
            >
              {removingIds.has(entry.id) ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <X className="w-3 h-3 mr-2" />
                  Stop watching
                </>
              )}
            </Button>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

