import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ConnectionsPage } from "./ConnectionsPage";

export const dynamic = "force-dynamic";

export default async function ConnectionsRoute({
  searchParams,
}: {
  searchParams: { place_id?: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up");
  }

  // Check if onboarding is already completed - if so, redirect to dashboard
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .single();

    if (profile?.onboarding_completed_at !== null) {
      redirect("/dashboard");
    }
  } catch (err) {
    // Profile might not exist - continue with onboarding
    console.warn("[connections] Error checking onboarding status:", err);
  }

  // Resolve place_id
  const urlPlaceId = searchParams.place_id || null;
  let placeId: string | null = urlPlaceId;

  if (!placeId) {
    // Try to get most recent business
    const { data: recentBusiness } = await supabase
      .from("businesses")
      .select("place_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    placeId = recentBusiness?.place_id || null;
  }

  if (!placeId) {
    redirect("/onboarding/business/search?error=missing_place_id");
  }

  // Verify business exists with owner_id
  let business = await supabase
    .from("businesses")
    .select("place_id, name, google_maps_url, city, categories, website, owner_id")
    .eq("place_id", placeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  // If not found with owner_id, check with service client (might be RLS issue or null owner_id)
  if (!business.data) {
    const serviceSupabase = createServiceRoleClient();
    const { data: serviceBusiness } = await serviceSupabase
      .from("businesses")
      .select("place_id, name, google_maps_url, city, categories, website, owner_id")
      .eq("place_id", placeId)
      .maybeSingle();

    if (!serviceBusiness) {
      // Business truly doesn't exist - redirect
      console.error(`[Connections] Business not found for place_id: ${placeId}, user: ${user.id}`);
      redirect("/onboarding/business/search?error=missing_business");
    }

    // Business exists but owner_id is null or different - fix it
    if (serviceBusiness.owner_id !== user.id) {
      const { error: updateError } = await serviceSupabase
        .from("businesses")
        .update({ owner_id: user.id, updated_at: new Date().toISOString() })
        .eq("place_id", placeId);

      if (updateError) {
        console.error(`[Connections] Failed to update owner_id for place_id: ${placeId}`, updateError);
        redirect("/onboarding/business/search?error=update_failed");
      }

      // Use the updated business
      business = { data: { ...serviceBusiness, owner_id: user.id } };
    } else {
      // RLS issue - use service business data
      business = { data: serviceBusiness };
    }
  }

  if (!business.data) {
    console.error(`[Connections] Could not resolve business for place_id: ${placeId}, user: ${user.id}`);
    redirect("/onboarding/business/search?error=missing_business");
  }

  // Extract primary category
  const primaryCategory = Array.isArray(business.data.categories) && business.data.categories.length > 0
    ? business.data.categories[0]?.replace(/_/g, " ")
    : null;

  return (
    <ConnectionsPage
      placeId={placeId}
      businessName={business.data.name}
      category={primaryCategory}
      city={business.data.city}
      googleMapsUrl={business.data.google_maps_url}
    />
  );
}

