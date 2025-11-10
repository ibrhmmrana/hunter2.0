// lib/hooks/useTopSearchLeaders.ts
import { useEffect, useState } from "react";

export interface TopSearchLeader {
  rank: number;
  place_id: string;
  name: string;
  rating: number | null;
  reviews_total: number | null;
  photo_reference: string | null;
  photos: string[];
  distance_m: number | null;
}

export function useTopSearchLeaders(businessPlaceId?: string) {
  const [data, setData] = useState<{
    primaryQuery: string | null;
    userRank: number | null;
    leaders: TopSearchLeader[];
  }>({ primaryQuery: null, userRank: null, leaders: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessPlaceId) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch("/api/competitors/ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPlaceId }),
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Request failed");
        }
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error || "Failed");

        setData({
          primaryQuery: json.primaryQuery ?? null,
          userRank: json.userRank ?? null,
          leaders: json.leaders || [],
        });
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "Failed to load leaders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessPlaceId]);

  return { ...data, loading, error };
}

