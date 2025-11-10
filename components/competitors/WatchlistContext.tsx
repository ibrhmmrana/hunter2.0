"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface WatchlistEntry {
  id: string;
  competitor_place_id: string;
  competitor_name: string;
  competitor_address: string | null;
}

interface WatchlistContextType {
  watchlist: WatchlistEntry[];
  isLoading: boolean;
  refreshWatchlist: () => Promise<void>;
  isInWatchlist: (placeId: string) => boolean;
  getWatchlistId: (placeId: string) => string | null;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

interface WatchlistProviderProps {
  children: ReactNode;
  initialWatchlist?: WatchlistEntry[];
}

export function WatchlistProvider({ children, initialWatchlist = [] }: WatchlistProviderProps) {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(initialWatchlist);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch("/api/watchlist", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.watchlist) {
          setWatchlist(data.watchlist);
        }
      }
    } catch (error) {
      console.error("[WatchlistProvider] Error fetching watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshWatchlist = useCallback(async () => {
    await fetchWatchlist();
  }, [fetchWatchlist]);

  const isInWatchlist = useCallback((placeId: string): boolean => {
    return watchlist.some((entry) => entry.competitor_place_id === placeId);
  }, [watchlist]);

  const getWatchlistId = useCallback((placeId: string): string | null => {
    const entry = watchlist.find((entry) => entry.competitor_place_id === placeId);
    return entry?.id || null;
  }, [watchlist]);

  useEffect(() => {
    // If we have initial watchlist from server, use it immediately
    // Otherwise, fetch from client
    if (initialWatchlist.length > 0) {
      setWatchlist(initialWatchlist);
      setIsLoading(false);
    } else {
      fetchWatchlist();
    }
  }, [initialWatchlist, fetchWatchlist]);

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        isLoading,
        refreshWatchlist,
        isInWatchlist,
        getWatchlistId,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
}

