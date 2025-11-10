import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { WatchlistPageContent } from "./WatchlistPageContent";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up");
  }

  // Fetch directly from Supabase
  const serviceSupabase = createServiceRoleClient();
  
  const { data: watchlist, error: watchlistError } = await serviceSupabase
    .from("watchlist_competitors")
    .select("id, competitor_place_id, competitor_name, competitor_address, business_place_id, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (watchlistError) {
    console.error("[watchlist] Error fetching watchlist:", watchlistError);
  }

  // Get social profiles
  let socialProfiles: any[] = [];
  if (watchlist && watchlist.length > 0) {
    const watchlistIds = watchlist.map((w) => w.id);
    const { data: profiles } = await serviceSupabase
      .from("watchlist_social_profiles")
      .select("watchlist_id, network, handle_or_url")
      .in("watchlist_id", watchlistIds);

    socialProfiles = profiles || [];
  }

  // Combine watchlist with social profiles
  const watchlistWithSocials = (watchlist || []).map((entry) => {
    const socials = socialProfiles
      .filter((sp) => sp.watchlist_id === entry.id)
      .map((sp) => ({
        network: sp.network,
        handle_or_url: sp.handle_or_url,
      }));

    return {
      id: entry.id,
      competitor_name: entry.competitor_name,
      competitor_address: entry.competitor_address,
      competitor_place_id: entry.competitor_place_id,
      business_place_id: entry.business_place_id,
      created_at: entry.created_at,
      socials,
    };
  });

  return <WatchlistPageContent initialWatchlist={watchlistWithSocials} />;
}

