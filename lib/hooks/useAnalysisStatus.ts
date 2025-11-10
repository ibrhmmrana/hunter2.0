import { useEffect, useState } from "react";

export type AnalysisStatus = "pending" | "running" | "complete" | "error" | "not_started";

export interface AnalysisStatusResult {
  status: AnalysisStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  isLoading: boolean;
}

/**
 * Hook to poll analysis status for a given placeId
 */
export function useAnalysisStatus(placeId?: string | null, pollInterval: number = 5000): AnalysisStatusResult {
  const [status, setStatus] = useState<AnalysisStatus>("not_started");
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!placeId) {
      setStatus("not_started");
      setProgress(0);
      setIsLoading(false);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/onboard/status?placeId=${encodeURIComponent(placeId)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.ok) {
          setStatus(data.status || "not_started");
          setProgress(data.progress || 0);
          setStartedAt(data.startedAt || null);
          setCompletedAt(data.completedAt || null);
          setErrorMessage(data.errorMessage || null);
          setIsLoading(false);

          // Stop polling if complete or error
          if (data.status === "complete" || data.status === "error") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        } else {
          console.error("[useAnalysisStatus] Failed to fetch status:", data);
          setIsLoading(false);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("[useAnalysisStatus] Error:", error);
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchStatus();

    // Poll every pollInterval ms, but stop if complete/error
    if (status !== "complete" && status !== "error") {
      intervalId = setInterval(fetchStatus, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [placeId, pollInterval, status]);

  return {
    status,
    progress,
    startedAt,
    completedAt,
    errorMessage,
    isLoading,
  };
}

