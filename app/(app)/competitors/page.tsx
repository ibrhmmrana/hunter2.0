import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getBusinessCompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import { TopSearchPositionCard } from "@/components/competitors/TopSearchPositionCard";
import { SearchRankingLeaders } from "@/components/competitors/SearchRankingLeaders";
import { CompetitorLeadersList } from "@/components/competitors/CompetitorLeadersList";
import { WatchlistProvider } from "@/components/competitors/WatchlistContext";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up");
  }

  // Get competitor insights
  const insights = await getBusinessCompetitorInsights({
    supabaseServerClient: supabase,
    userId: user.id,
  });

  // Fetch watchlist on server side to avoid client-side lag
  const serviceSupabase = createServiceRoleClient();
  const { data: watchlistData } = await serviceSupabase
    .from("watchlist_competitors")
    .select("id, competitor_place_id, competitor_name, competitor_address")
    .eq("user_id", user.id)
    .eq("active", true);

  const initialWatchlist = watchlistData || [];

  // If no business configured, show empty state
  if (!insights) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Competitors</h1>
          <p className="text-muted-foreground">
            Track where you stand and who's winning your 'near me' searches.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No business configured
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              To see your competitor insights, you need to set up a default business first.
            </p>
            <Button asChild>
              <Link href="/onboarding/business/search">
                Set up your business
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WatchlistProvider initialWatchlist={initialWatchlist}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Competitors</h1>
          <p className="text-muted-foreground">
            Track where you stand and who's winning your 'near me' searches.
          </p>
        </div>

        {/* Top Search Position Card */}
        <TopSearchPositionCard insights={insights} />

        {/* Search Ranking Leaders - shows actual search ranking with rank stickers */}
        <SearchRankingLeaders insights={insights} />

        {/* General Competitors Ahead - shows competitors that meet criteria (no rank stickers) */}
        <CompetitorLeadersList insights={insights} />
      </div>
    </WatchlistProvider>
  );
}
