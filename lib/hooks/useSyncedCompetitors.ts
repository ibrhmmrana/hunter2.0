import { useEffect, useRef, useState } from "react";

export interface SyncedCompetitor {
  business_place_id: string;
  competitor_place_id: string;
  name: string;
  rating_avg: number | null;
  reviews_total: number | null;
  distance_m: number | null;
  is_stronger: boolean | null;
  raw?: Record<string, unknown> | null;
  snapshot_ts?: string | null;
}

type Status = "idle" | "loading" | "success" | "empty" | "error";

export interface UseSyncedCompetitorsResult {
  status: Status;
  competitors: SyncedCompetitor[];
  error: string | null;
}

/**
 * Hook that syncs competitors and returns the result.
 * Uses the sync endpoint as the single source of truth to avoid race conditions.
 * 
 * @param placeId - The business place ID
 * @param autoSync - If false, only reads from DB without triggering sync (for onboarding analytics)
 */
export function useSyncedCompetitors(placeId?: string | null, autoSync: boolean = true): UseSyncedCompetitorsResult {
  const [status, setStatus] = useState<Status>("idle");
  const [competitors, setCompetitors] = useState<SyncedCompetitor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Reset when placeId changes
    hasSyncedRef.current = false;
    setStatus("idle");
    setCompetitors([]);
    setError(null);

    if (!placeId) {
      return;
    }

    // Guard against StrictMode double calls
    if (hasSyncedRef.current) {
      return;
    }

    hasSyncedRef.current = true;

    const run = async () => {
      try {
        setStatus("loading");
        setError(null);

        // If autoSync is false (onboarding analytics), check status first
        if (!autoSync) {
          const statusRes = await fetch(`/api/onboard/status?placeId=${encodeURIComponent(placeId)}`);
          const statusData = await statusRes.json();

          // If analysis hasn't started, trigger sync
          // Otherwise, just read from DB
          if (statusData.ok && statusData.status === "not_started") {
            // Fallback: trigger sync if not started
            const res = await fetch("/api/competitors/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessPlaceId: placeId }),
            });

            if (!res.ok) {
              const errorText = await res.text();
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch {
                errorData = { error: errorText || "Failed to sync competitors" };
              }
              throw new Error(errorData?.message || errorData?.error || "Failed to sync competitors");
            }

            const data = await res.json();

            if (!data.ok) {
              throw new Error(data?.message || data?.error || "Failed to sync competitors");
            }

            const list: SyncedCompetitor[] = data.competitors || [];
            if (!list.length) {
              setCompetitors([]);
              setStatus("empty");
            } else {
              setCompetitors(list);
              setStatus("success");
            }
            return;
          }
        }

        // Default: call sync endpoint (it's idempotent)
        const res = await fetch("/api/competitors/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessPlaceId: placeId }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || "Failed to sync competitors" };
          }
          throw new Error(errorData?.message || errorData?.error || "Failed to sync competitors");
        }

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data?.message || data?.error || "Failed to sync competitors");
        }

        const list: SyncedCompetitor[] = data.competitors || [];

        if (!list.length) {
          setCompetitors([]);
          setStatus("empty");
        } else {
          setCompetitors(list);
          setStatus("success");
        }
      } catch (err: any) {
        console.error("[useSyncedCompetitors] sync failed", err);
        setError(err?.message || "Unable to load competitors right now.");
        setStatus("error");
        setCompetitors([]);
      }
    };

    run();
  }, [placeId, autoSync]);

  return { status, competitors, error };
}

