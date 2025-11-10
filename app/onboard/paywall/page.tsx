import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PaywallPage } from "./PaywallPage";

export const dynamic = "force-dynamic";

export default async function PaywallRoute() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Check if already completed onboarding
  let onboardingCompleted = false;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .single();
    onboardingCompleted = profile?.onboarding_completed_at !== null;
  } catch (err) {
    // Profile might not exist yet
    onboardingCompleted = false;
  }

  // If already completed, redirect to dashboard
  if (onboardingCompleted) {
    redirect("/dashboard");
  }

  return <PaywallPage />;
}

