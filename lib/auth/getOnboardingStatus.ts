/**
 * Helper to check user's onboarding status and determine redirect path.
 * Server-side only.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface OnboardingStatus {
  isCompleted: boolean;
  redirectPath: "/dashboard" | "/onboarding/business/search";
}

/**
 * Check if user has completed onboarding.
 * Returns the appropriate redirect path.
 */
export async function getOnboardingStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingStatus> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    const isCompleted = profile?.onboarding_completed_at !== null;

    return {
      isCompleted,
      redirectPath: isCompleted ? "/dashboard" : "/onboarding/business/search",
    };
  } catch (err) {
    // Profile might not exist yet - default to incomplete
    console.warn("[getOnboardingStatus] Error fetching profile:", err);
    return {
      isCompleted: false,
      redirectPath: "/onboarding/business/search",
    };
  }
}

