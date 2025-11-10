import { useState, useEffect, useCallback } from "react";

interface Competitor {
  competitor_place_id: string;
  name: string;
  distance_m: number;
  rating_avg: number | null;
  reviews_total: number | null;
  photo_url: string;
  bullets: string[];
  reasons_short?: string[];
  source: "ai" | "heuristic";
  is_stronger?: boolean;
}

interface UseCompetitorsResult {
  competitors: Competitor[];
  phrases: string[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useCompetitors(placeId: string | null): UseCompetitorsResult {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompetitors = useCallback(async () => {
    if (!placeId) {
      setCompetitors([]);
      setPhrases([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch via API to get insights
      const response = await fetch("/api/competitors/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessPlaceId: placeId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCompetitors((data.competitors || []).slice(0, 6));
        setPhrases(data.phrases || []);
      } else {
        setCompetitors([]);
        setPhrases([]);
      }
    } catch (error) {
      console.error("Failed to fetch competitors:", error);
      setCompetitors([]);
      setPhrases([]);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  return {
    competitors,
    phrases,
    loading,
    refetch: fetchCompetitors,
  };
}
