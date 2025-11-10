/**
 * Unified post-authentication routing logic.
 * Determines where to redirect a user after authentication based on their profile state.
 * Server-side only.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfileForUser } from "./ensureProfileForUser";

export interface PostAuthRouteResult {
  redirectPath: "/dashboard" | "/onboarding/business/search" | "/sign-up";
  profileId: string;
  onboardingCompleted: boolean;
}

/**
 * Determine where to redirect a user after authentication.
 * 
 * Logic:
 * - If no session → /sign-up
 * - If session exists:
 *   - Ensure profile exists (create if needed)
 *   - If onboarding_completed === true → /dashboard
 *   - Else → /onboarding/business/search
 */
export async function getPostAuthRoute(
  supabase: SupabaseClient
): Promise<PostAuthRouteResult> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      redirectPath: "/sign-up",
      profileId: "",
      onboardingCompleted: false,
    };
  }

  // Ensure profile exists
  const profileResult = await ensureProfileForUser(supabase, user);
  if (!profileResult.success) {
    console.error("[postAuthRouter] Failed to ensure profile:", profileResult.error);
    // Still try to continue - profile might exist but RLS blocked it
  }

  // Fetch profile to check onboarding status
  // Use maybeSingle in case profile doesn't exist yet (shouldn't happen, but be safe)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST116") {
    // PGRST116 is "no rows returned" which is acceptable
    console.error("[postAuthRouter] Error fetching profile:", profileError);
  }

  // If no profile found, default to onboarding (shouldn't happen due to trigger, but be safe)
  if (!profile) {
    console.warn(`[postAuthRouter] No profile found for user ${user.id}, defaulting to onboarding`);
    return {
      redirectPath: "/onboarding/business/search",
      profileId: user.id,
      onboardingCompleted: false,
    };
  }

  const onboardingCompleted = profile?.onboarding_completed_at !== null;

  return {
    redirectPath: onboardingCompleted ? "/dashboard" : "/onboarding/business/search",
    profileId: user.id,
    onboardingCompleted,
  };
}

