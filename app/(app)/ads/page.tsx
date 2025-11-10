import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdsPageContent } from "./AdsPageContent";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up");
  }

  // Get user's default business if available
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_business_place_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let businessData = null;
  if (profile?.default_business_place_id) {
    const { data: business } = await supabase
      .from("businesses")
      .select("place_id, name, address, phone, google_maps_url, primary_category")
      .eq("place_id", profile.default_business_place_id)
      .maybeSingle();
    
    if (business) {
      businessData = {
        name: business.name,
        address: business.address || undefined,
        phone: business.phone || undefined,
        website: business.google_maps_url || undefined,
        category: business.primary_category || undefined,
      };
    }
  }

  return <AdsPageContent initialBusinessData={businessData} />;
}

