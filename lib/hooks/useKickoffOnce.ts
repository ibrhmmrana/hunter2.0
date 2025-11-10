import { useEffect, useRef } from "react";

interface UseKickoffOnceParams {
  placeId: string | null;
  userId: string | null;
  onError?: (error: string) => void;
}

/**
 * Hook to kickoff analysis exactly once per day per place
 * Uses localStorage for idempotency
 */
export function useKickoffOnce({ placeId, userId, onError }: UseKickoffOnceParams) {
  const hasKickedOffRef = useRef(false);

  useEffect(() => {
    if (!placeId || !userId || hasKickedOffRef.current) {
      return;
    }

    const dayStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const idempotencyKey = `gbp:kickoff:${placeId}:${dayStamp}`;

    // Check if already kicked off today
    const existingKey = localStorage.getItem(idempotencyKey);
    if (existingKey) {
      console.info("analytics:kickoff:skipped", { placeId, dayStamp });
      hasKickedOffRef.current = true;
      return;
    }

    // Kickoff
    async function doKickoff() {
      try {
        console.info("analytics:kickoff:send", { placeId, userId });

        const response = await fetch("/api/analyze/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            place_id: placeId,
            user_id: userId,
            source: "webapp:onboard/analytics",
          }),
        });

        if (response.ok || response.status === 202) {
          // Success - mark as sent
          localStorage.setItem(idempotencyKey, Date.now().toString());
          console.info("analytics:kickoff:sent", { placeId, dayStamp });
          hasKickedOffRef.current = true;
        } else {
          const errorData = await response.json().catch(() => ({
            error: `HTTP ${response.status}`,
          }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
      } catch (err: any) {
        console.error("analytics:kickoff:error", err);
        // Non-blocking - call onError callback if provided
        if (onError) {
          onError(err.message || "Failed to start analysis. Please try refreshing.");
        }
      }
    }

    doKickoff();
  }, [placeId, userId, onError]);

  /**
   * Clear idempotency key to allow retry
   */
  const clearIdempotency = () => {
    if (!placeId) return;
    const dayStamp = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `gbp:kickoff:${placeId}:${dayStamp}`;
    localStorage.removeItem(idempotencyKey);
    hasKickedOffRef.current = false;
  };

  return { clearIdempotency };
}

