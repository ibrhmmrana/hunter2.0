/**
 * Ensures a profiles row exists for a given user.
 * Server-side only.
 * 
 * Note: The database trigger should auto-create profiles, but this is a fallback
 * for cases where the trigger might not fire (e.g., existing users).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export interface EnsureProfileResult {
  success: boolean;
  profileId: string;
  error?: string;
}

/**
 * Ensure a profiles row exists for the given user.
 * If it doesn't exist, create it with default values.
 * If it exists, return it.
 * 
 * This function uses the provided supabase client. For server-side use,
 * prefer using a service role client to bypass RLS if needed.
 */
export async function ensureProfileForUser(
  supabase: SupabaseClient,
  user: User
): Promise<EnsureProfileResult> {
  try {
    // Check if profile exists
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine
      console.error("[ensureProfileForUser] Error checking profile:", selectError);
      // Continue anyway - might be RLS issue, try to insert
    }

    // If profile exists, we're done
    if (existingProfile) {
      return {
        success: true,
        profileId: user.id,
      };
    }

    // Profile doesn't exist - create it
    // Use on conflict do nothing in case trigger already created it
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        plan: 'free',
        default_business_place_id: null,
        onboarding_completed_at: null,
        plan_selected_at: null,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      // If it's a unique constraint violation, profile was created by trigger - that's fine
      if (insertError.code === "23505") {
        console.log(`[ensureProfileForUser] Profile already exists (created by trigger) for user ${user.id}`);
        return {
          success: true,
          profileId: user.id,
        };
      }
      console.error("[ensureProfileForUser] Error creating profile:", insertError);
      return {
        success: false,
        profileId: user.id,
        error: insertError.message,
      };
    }

    console.log(`[ensureProfileForUser] Created profile for user ${user.id}`);
    return {
      success: true,
      profileId: user.id,
    };
  } catch (err: any) {
    console.error("[ensureProfileForUser] Unexpected error:", err);
    return {
      success: false,
      profileId: user.id,
      error: err.message || "Unknown error",
    };
  }
}

