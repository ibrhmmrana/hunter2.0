/**
 * Mark onboarding as completed for a user.
 * Server-side only.
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark a user's onboarding as completed.
 * @param supabase Supabase client (should be service role for server-side)
 * @param userId User ID
 */
export async function markOnboardingComplete(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) {
      console.error("[onboarding] Failed to mark onboarding complete", {
        userId,
        error,
      });
      throw error;
    }

    console.log("[onboarding] Marked onboarding as complete", { userId });
  } catch (err) {
    console.error("[onboarding] Error marking onboarding complete", {
      userId,
      err,
    });
    throw err;
  }
}

