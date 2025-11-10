import { useState, useEffect, useRef, useCallback } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchRow1, subscribeRow1, Row1Data } from "@/lib/analytics/row1";

interface UseRow1KpisParams {
  supabase: SupabaseClient;
  placeId: string | null;
}

interface UseRow1KpisResult {
  row: Row1Data | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3000; // 3 seconds
const POLL_MAX_ATTEMPTS = 30; // 90 seconds total
const POLL_MAX_DURATION_MS = 90000;

/**
 * Hook to fetch and subscribe to Row-1 KPI data
 * Automatically handles realtime updates and polling fallback
 */
export function useRow1Kpis({
  supabase,
  placeId,
}: UseRow1KpisParams): UseRow1KpisResult {
  const [row, setRow] = useState<Row1Data | null>(null);
  const [loading, setLoading] = useState(true);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRealtimeRef = useRef<(() => void) | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async (): Promise<boolean> => {
    if (!placeId) return false;

    try {
      const { row: fetchedRow, isFresh } = await fetchRow1(supabase, placeId);

      if (!mountedRef.current) return false;

      if (fetchedRow && isFresh) {
        setRow(fetchedRow);
        setLoading(false);
        return true; // Success - stop polling
      }

      return false; // Not fresh or no row
    } catch (err) {
      console.error("analytics:fetch:error", err);
      return false;
    }
  }, [supabase, placeId]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    // Clear existing polling
    stopPolling();

    pollStartTimeRef.current = Date.now();
    pollAttemptsRef.current = 0;

    console.info("analytics:poll:start", { placeId });

    pollingIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        stopPolling();
        return;
      }

      const elapsed =
        pollStartTimeRef.current ? Date.now() - pollStartTimeRef.current : 0;
      pollAttemptsRef.current += 1;
      const currentAttempt = pollAttemptsRef.current;

      // Check max duration and attempts
      if (elapsed >= POLL_MAX_DURATION_MS || currentAttempt >= POLL_MAX_ATTEMPTS) {
        console.info("analytics:poll:timeout", {
          attempts: currentAttempt,
          elapsed,
        });
        stopPolling();
        setLoading(false);
        return;
      }

      console.info("analytics:poll:hit", { attempt: currentAttempt });

      const success = await doFetch();
      if (success) {
        console.info("analytics:poll:success", { attempt: currentAttempt });
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [placeId, doFetch, stopPolling]);

  const setupRealtime = useCallback(() => {
    if (!placeId || unsubscribeRealtimeRef.current) return;

    const unsubscribe = subscribeRow1(supabase, placeId, async () => {
      console.info("analytics:realtime:event:triggered", { placeId });
      const success = await doFetch();
      if (success) {
        // Stop polling if realtime worked
        stopPolling();
      }
    });

    unsubscribeRealtimeRef.current = unsubscribe;
  }, [supabase, placeId, doFetch, stopPolling]);

  // Main effect
  useEffect(() => {
    if (!placeId) {
      setRow(null);
      setLoading(false);
      return;
    }

    mountedRef.current = true;
    setLoading(true);

    async function initialize() {
      console.info("analytics:fetch:first", { placeId });

      // Initial fetch
      const { row: fetchedRow, isFresh } = await fetchRow1(supabase, placeId);

      if (!mountedRef.current) return;

      if (fetchedRow && isFresh) {
        // Fresh data - we're done
        console.info("analytics:fetch:first:fresh", {
          placeId,
          snapshot_ts: fetchedRow.snapshot_ts,
        });
        setRow(fetchedRow);
        setLoading(false);
        return;
      }

      // Not fresh or no row - need to wait for update
      console.info("analytics:fetch:first:stale-or-missing", {
        placeId,
        hasRow: !!fetchedRow,
        snapshot_ts: fetchedRow?.snapshot_ts,
      });

      setRow(null);
      setLoading(true);

      // Setup realtime subscription
      setupRealtime();

      // Start polling fallback
      startPolling();
    }

    initialize();

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (unsubscribeRealtimeRef.current) {
        unsubscribeRealtimeRef.current();
        unsubscribeRealtimeRef.current = null;
      }
    };
  }, [placeId, supabase, setupRealtime, startPolling, stopPolling]);

  const refetch = useCallback(async () => {
    setLoading(true);

    // Cleanup existing subscriptions/polling
    stopPolling();
    if (unsubscribeRealtimeRef.current) {
      unsubscribeRealtimeRef.current();
      unsubscribeRealtimeRef.current = null;
    }

    pollStartTimeRef.current = null;
    pollAttemptsRef.current = 0;

    // Re-fetch
    const success = await doFetch();

    if (!success) {
      // Not fresh - setup realtime and polling again
      setupRealtime();
      startPolling();
    }
  }, [doFetch, setupRealtime, startPolling, stopPolling]);

  return { row, loading, refetch };
}






