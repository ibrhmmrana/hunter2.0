import { SupabaseClient } from "@supabase/supabase-js";

export type AnalysisRunStatus = "pending" | "running" | "complete" | "error";

export interface AnalysisRun {
  id: number;
  owner_id: string;
  business_place_id: string;
  status: AnalysisRunStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  run_key: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mark an analysis run as complete
 */
export async function markAnalysisRunComplete(
  serviceSupabase: SupabaseClient,
  ownerId: string,
  placeId: string
): Promise<void> {
  const updateData: any = {
    status: "complete",
    completed_at: new Date().toISOString(),
    last_completed_at: new Date().toISOString(), // Support old column name
    error_message: null,
    last_error: null, // Support old column name
    updated_at: new Date().toISOString(),
  };

  const { error } = await serviceSupabase
    .from("analysis_runs")
    .update(updateData)
    .eq("owner_id", ownerId)
    .eq("business_place_id", placeId);

  if (error) {
    console.error(`[markAnalysisRunComplete] Failed for ${placeId}:`, error);
    throw error;
  }

  console.log(`[markAnalysisRunComplete] Marked complete for ${placeId}`);
}

/**
 * Mark an analysis run as error
 */
export async function markAnalysisRunError(
  serviceSupabase: SupabaseClient,
  ownerId: string,
  placeId: string,
  errorMessage: string
): Promise<void> {
  const updateData: any = {
    status: "error",
    error_message: errorMessage,
    last_error: errorMessage, // Support old column name
    updated_at: new Date().toISOString(),
  };

  const { error } = await serviceSupabase
    .from("analysis_runs")
    .update(updateData)
    .eq("owner_id", ownerId)
    .eq("business_place_id", placeId);

  if (error) {
    console.error(`[markAnalysisRunError] Failed for ${placeId}:`, error);
    throw error;
  }

  console.error(`[markAnalysisRunError] Marked error for ${placeId}: ${errorMessage}`);
}

/**
 * Get analysis run status and progress
 */
export async function getAnalysisRunStatus(
  supabase: SupabaseClient,
  ownerId: string,
  placeId: string
): Promise<{
  status: AnalysisRunStatus | "not_started";
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}> {
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("status, started_at, last_started_at, completed_at, last_completed_at, error_message, last_error")
    .eq("owner_id", ownerId)
    .eq("business_place_id", placeId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("last_started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error(`[getAnalysisRunStatus] Error for ${placeId}:`, error);
    throw error;
  }

  if (!data) {
    return {
      status: "not_started",
      progress: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    };
  }

  // Handle both old and new column names for migration period
  const startedAt = data.started_at || data.last_started_at;
  const completedAt = data.completed_at || data.last_completed_at;
  const errorMessage = data.error_message || data.last_error;

  // Calculate progress heuristically based on status
  let progress = 0;
  if (data.status === "pending") {
    progress = 10;
  } else if (data.status === "running") {
    // Estimate progress: if running for a while, assume we're further along
    if (startedAt) {
      const startDate = new Date(startedAt);
      const now = new Date();
      const elapsedMinutes = (now.getTime() - startDate.getTime()) / (1000 * 60);
      
      if (elapsedMinutes < 1) {
        progress = 20; // Just started
      } else if (elapsedMinutes < 2) {
        progress = 50; // Snapshot likely done
      } else if (elapsedMinutes < 3) {
        progress = 80; // Competitors likely done
      } else {
        progress = 90; // Almost done
      }
    } else {
      progress = 20; // Default if no start time
    }
  } else if (data.status === "complete") {
    progress = 100;
  } else if (data.status === "error") {
    progress = 0;
  }

  return {
    status: data.status as AnalysisRunStatus,
    progress,
    startedAt: startedAt || null,
    completedAt: completedAt || null,
    errorMessage: errorMessage || null,
  };
}

