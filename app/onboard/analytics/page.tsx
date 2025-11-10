import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { syncCompetitorsForBusiness } from "@/lib/competitors/syncCompetitorsForBusiness";
import { ensureGbpSnapshotUpToDate } from "@/lib/onboard/ensureGbpSnapshot";
import { getBusinessCompetitorInsights } from "@/lib/analytics/getBusinessCompetitorInsights";
import type { Punchline } from "@/lib/insights/punchlines";
import { OnboardAnalyticsPage } from "./OnboardAnalyticsPage";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
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
    console.warn("[analytics] Error checking onboarding status:", err);
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
    // Check if they have any business
    const { data: anyBusiness } = await supabase
      .from("businesses")
      .select("place_id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (anyBusiness) {
      redirect(`/onboard/analytics?place_id=${anyBusiness.place_id}`);
    } else {
      redirect("/onboarding/business/search");
    }
  }

  // Verify business exists and belongs to user
  const { data: business } = await supabase
    .from("businesses")
    .select("place_id, name, google_maps_url, city, categories, address")
    .eq("place_id", placeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
    // Business doesn't exist or doesn't belong to user
    const { data: anyBusiness } = await supabase
      .from("businesses")
      .select("place_id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (anyBusiness) {
      redirect(`/onboard/analytics?place_id=${anyBusiness.place_id}`);
    } else {
      redirect("/onboarding/business/search");
    }
  }

  // Ensure GBP snapshot is up to date (this will also save review metrics)
  try {
    await ensureGbpSnapshotUpToDate(placeId);
  } catch (error) {
    console.error('[analytics page] GBP snapshot failed:', error);
    // Continue anyway - we'll use existing snapshot data
  }

  // Sync competitors server-side before rendering (idempotent)
  // With tiered fallbacks, this should always find some competitors
  try {
    await syncCompetitorsForBusiness(placeId);
  } catch (error) {
    console.error('[analytics page] Competitor sync failed:', error);
    // Continue anyway - we'll check DB for existing competitors
  }

  // Fetch competitors from DB after sync (or use existing if sync failed)
  const serviceSupabase = createServiceRoleClient();
  const { data: competitors } = await serviceSupabase
    .from("business_competitors")
    .select("competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw, snapshot_ts")
    .eq("business_place_id", placeId)
    .order("is_stronger", { ascending: false })
    .order("reviews_total", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(6);

  const initialCompetitors = competitors || [];
  
  // With tiered fallbacks, we should always have competitors unless Google API fails completely
  // Log if we have 0 competitors for debugging
  if (initialCompetitors.length === 0) {
    console.warn('[analytics page] No competitors found after sync - may indicate Google API failure or very isolated location', { placeId });
  }

  // Fetch precomputed insights from business_insights table (using shared function for top_search)
  const competitorInsights = await getBusinessCompetitorInsights({
    supabaseServerClient: supabase,
    userId: user.id,
    placeId: placeId,
  });

  // Also fetch discovery_queries separately (needed for onboarding carousel)
  const { data: insights } = await serviceSupabase
    .from("business_insights")
    .select("discovery_queries")
    .eq("business_place_id", placeId)
    .maybeSingle();

  // Fetch stored punchlines from social_insights
  const { data: storedInsights, error: insightsError } = await serviceSupabase
    .from("social_insights")
    .select("network, punchline, severity, metrics, analysis, headline, bullets")
    .eq("business_id", placeId)
    .in("network", ["google", "instagram", "tiktok", "facebook"]);

  if (insightsError) {
    console.error('[analytics page] Error fetching social insights', insightsError);
  }

  // Log what we fetched for debugging
  console.log('[analytics page] Fetched social insights', {
    placeId,
    count: storedInsights?.length || 0,
    insights: storedInsights?.map(s => ({
      network: s.network,
      hasPunchline: !!s.punchline,
      hasSeverity: !!s.severity,
      punchlinePreview: s.punchline?.substring(0, 50),
    })),
  });

  // Build punchlines from stored data
  const punchlines: Punchline[] = [];
  
  if (storedInsights) {
    for (const insight of storedInsights) {
      // Normalize network to lowercase
      const normalizedNetwork = (insight.network || '').toLowerCase().trim();
      
      // Only include if we have both punchline and severity
      if (insight.punchline && insight.punchline.trim() && insight.severity) {
        // Map network to label
        const labelMap: Record<string, string> = {
          google: 'GOOGLE',
          instagram: 'INSTAGRAM',
          tiktok: 'TIKTOK',
          facebook: 'FACEBOOK',
        };
        const networkLabel = labelMap[normalizedNetwork] || normalizedNetwork.toUpperCase();
        
        punchlines.push({
          source: normalizedNetwork as 'google' | 'instagram' | 'tiktok' | 'facebook',
          label: networkLabel,
          punchline: insight.punchline.trim(),
          severity: insight.severity as 'low' | 'medium' | 'high' | 'critical',
        });
      } else {
        console.warn('[analytics page] Skipping insight due to missing data', {
          network: normalizedNetwork,
          hasPunchline: !!insight.punchline,
          hasSeverity: !!insight.severity,
        });
      }
    }
    
    // Sort: Google first, then Instagram, then TikTok, then Facebook, then others
    punchlines.sort((a, b) => {
      const order: Record<string, number> = { google: 0, instagram: 1, tiktok: 2, facebook: 3 };
      const aOrder = order[a.source] ?? 99;
      const bOrder = order[b.source] ?? 99;
      return aOrder - bOrder;
    });
  }

  console.log('[analytics page] Built punchlines', {
    count: punchlines.length,
    punchlines: punchlines.map(p => ({ 
      source: p.source, 
      label: p.label, 
      preview: p.punchline.substring(0, 50),
      severity: p.severity,
    })),
  });

  // Sanity check: Log if we're missing expected punchlines
  const hasGoogle = punchlines.some(p => p.source === 'google');
  const hasInstagram = punchlines.some(p => p.source === 'instagram');
  if (!hasGoogle) {
    console.warn('[analytics page] ⚠️ No Google punchline found');
  }
  if (!hasInstagram) {
    console.warn('[analytics page] ⚠️ No Instagram punchline found (this is expected if Instagram analysis hasn\'t run yet)');
  }

  // Fetch Instagram profile to check if handle exists
  const { data: instagramProfile } = await serviceSupabase
    .from("social_profiles")
    .select("handle")
    .eq("business_id", placeId)
    .eq("network", "instagram")
    .maybeSingle();

  const hasInstagramProfile = Boolean(instagramProfile?.handle);

  // Check if Instagram insight exists
  const instagramInsight = storedInsights?.find(s => s.network === 'instagram');
  const hasInstagramInsight = Boolean(instagramInsight?.punchline && instagramInsight?.punchline.trim());

  // Fetch TikTok profile to check if handle exists
  const { data: tiktokProfile } = await serviceSupabase
    .from("social_profiles")
    .select("handle")
    .eq("business_id", placeId)
    .eq("network", "tiktok")
    .maybeSingle();

  const hasTikTokProfile = Boolean(tiktokProfile?.handle);

  // Check if TikTok insight exists
  const tiktokInsight = storedInsights?.find(s => s.network === 'tiktok');
  const hasTikTokInsight = Boolean(tiktokInsight?.punchline && tiktokInsight?.punchline.trim());

  // Fetch Facebook profile to check if handle exists
  const { data: facebookProfile } = await serviceSupabase
    .from("social_profiles")
    .select("handle")
    .eq("business_id", placeId)
    .eq("network", "facebook")
    .maybeSingle();

  const hasFacebookProfile = Boolean(facebookProfile?.handle);

  // Check if Facebook insight exists
  const facebookInsight = storedInsights?.find(s => s.network === 'facebook');
  const hasFacebookInsight = Boolean(facebookInsight?.punchline && facebookInsight?.punchline.trim());

  console.log('[analytics page] Social profiles context', {
    instagram: {
      hasProfile: hasInstagramProfile,
      hasInsight: hasInstagramInsight,
      handle: instagramProfile?.handle || null,
    },
    tiktok: {
      hasProfile: hasTikTokProfile,
      hasInsight: hasTikTokInsight,
      handle: tiktokProfile?.handle || null,
    },
    facebook: {
      hasProfile: hasFacebookProfile,
      hasInsight: hasFacebookInsight,
      handle: facebookProfile?.handle || null,
    },
  });

  // Pass data - client will use initialCompetitors to determine section visibility
  return (
    <OnboardAnalyticsPage
      placeId={placeId}
      businessId={placeId}
      initialBusiness={{
        name: business.name,
        google_maps_url: business.google_maps_url,
        city: business.city,
        categories: business.categories,
        address: business.address,
      }}
      initialCompetitors={initialCompetitors}
      initialDiscoveryQueries={insights?.discovery_queries ?? null}
      initialTopSearch={competitorInsights?.topSearch ? {
        query: competitorInsights.topSearch.query,
        userRank: competitorInsights.topSearch.position ?? undefined,
        leaders: competitorInsights.leaders.map(l => ({
          place_id: l.placeId,
          rank: l.rank || 1,
          name: l.name,
          rating: l.rating ?? undefined,
          user_ratings_total: l.reviews ?? undefined,
          distance_m: l.distance_m ?? undefined,
          photo_reference: l.photo_reference ?? undefined,
          photos: l.photos || [],
        })),
        heading: competitorInsights.topSearch.heading,
        isChasers: competitorInsights.topSearch.isChasers,
      } : null}
      initialInstagramInsights={instagramInsight?.analysis ? (instagramInsight.analysis as {
        network: 'instagram';
        headline: string;
        score: {
          posting_consistency: number;
          profile_clarity: number;
          content_to_offer: number;
          engagement_effectiveness: number;
          cta_usage: number;
          responsiveness: number;
        };
        bullets: string[];
      }) : null}
      initialPunchlines={punchlines}
      hasInstagramProfile={hasInstagramProfile}
      hasInstagramInsight={hasInstagramInsight}
      hasTikTokProfile={hasTikTokProfile}
      hasTikTokInsight={hasTikTokInsight}
      hasFacebookProfile={hasFacebookProfile}
      hasFacebookInsight={hasFacebookInsight}
    />
  );
}
