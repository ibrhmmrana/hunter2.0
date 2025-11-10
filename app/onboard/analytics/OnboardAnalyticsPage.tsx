"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import {
  Search,
  Star,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatReviewCount } from "@/lib/format";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRow1Kpis } from "@/lib/hooks/useRow1Kpis";
import { useSyncedCompetitors } from "@/lib/hooks/useSyncedCompetitors";
import { RealHumansSection } from "@/components/onboard/RealHumansSection";
import { placePhotoUrl } from "@/lib/google/photos";
import { buildAdvantageChips } from "@/lib/competitors/advantageChips";
import { cn } from "@/lib/utils";

interface Business {
  name: string;
  google_maps_url: string | null;
  city: string | null;
  categories: string[] | null;
  address?: string | null;
}

interface KPIs {
  rating_avg: number | null;
  reviews_total: number | null;
  reviews_last_30: number | null;
  visual_trust: number | null;
  negative_share_percent: number | null;
  has_gbp?: boolean;
}

interface Competitor {
  competitor_place_id: string;
  name: string;
  distance_m: number;
  rating_avg: number | null;
  reviews_total: number | null;
  photo_url: string;
  bullets: string[];
  reasons_short?: string[];
  source: "ai" | "heuristic";
  is_stronger?: boolean;
}

interface Creator {
  id: string;
  name: string;
  niche: string;
  distanceLabel: string;
  followers: string;
  engagement: string;
  platformsLabel: string;
  fitScore: number;
  reasons: string[];
}

type TopSearchLeader = {
  rank: number;
  place_id: string;
  name: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  distance_m?: number | null;
  photo_reference?: string | null;
  photos?: string[];
};

type TopSearchResult = {
  query: string;
  leaders: TopSearchLeader[];
  userRank?: number;
  heading?: string;
  isChasers?: boolean;
};

interface InstagramInsights {
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
}

type Punchline = {
  source: 'google' | 'instagram' | 'tiktok' | 'facebook' | string;
  label: string;
  punchline: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

interface OnboardAnalyticsPageProps {
  placeId: string;
  businessId: string;
  initialBusiness: Business;
  initialCompetitors?: Array<{
    competitor_place_id: string;
    name: string;
    rating_avg: number | null;
    reviews_total: number | null;
    distance_m: number | null;
    is_stronger: boolean | null;
    raw?: Record<string, unknown> | null;
    snapshot_ts?: string | null;
  }>;
  initialDiscoveryQueries?: string[] | null;
  initialTopSearch?: TopSearchResult | null;
  initialInstagramInsights?: InstagramInsights | null;
  initialPunchlines?: Punchline[];
  hasInstagramProfile?: boolean;
  hasInstagramInsight?: boolean;
  hasTikTokProfile?: boolean;
  hasTikTokInsight?: boolean;
  hasFacebookProfile?: boolean;
  hasFacebookInsight?: boolean;
}

export function OnboardAnalyticsPage({ 
  placeId,
  businessId,
  initialBusiness, 
  initialCompetitors = [],
  initialDiscoveryQueries = null,
  initialTopSearch = null,
  initialInstagramInsights = null,
  initialPunchlines = [],
  hasInstagramProfile = false,
  hasInstagramInsight = false,
  hasTikTokProfile = false,
  hasTikTokInsight = false,
  hasFacebookProfile = false,
  hasFacebookInsight = false,
}: OnboardAnalyticsPageProps) {
  const router = useRouter();
  
  // Carousel state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  
  // Store punchlines in state for live updates
  const [punchlines, setPunchlines] = useState<Punchline[]>(initialPunchlines);
  const punchlinesRef = useRef<Punchline[]>(initialPunchlines);
  const [skipLoading, setSkipLoading] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    punchlinesRef.current = punchlines;
  }, [punchlines]);

  const handleSkipToDashboard = async () => {
    setSkipLoading(true);
    try {
      const response = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      console.log("[onboarding] Completed via skip (free plan)");
      // Force a hard navigation to ensure middleware picks up the change
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[analytics] Error completing onboarding", err);
      setSkipLoading(false);
      // Still redirect even if API call fails
      window.location.href = "/dashboard";
    }
  };

  const handleCompleteOnboarding = async () => {
    setPaywallLoading(true);
    try {
      const response = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "premium" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      console.log("[onboarding] Completed via paywall (premium plan)");
      // Force a hard navigation to ensure middleware picks up the change
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[paywall] Error completing onboarding", err);
      setPaywallLoading(false);
      // Still redirect even if API call fails
      window.location.href = "/dashboard";
    }
  };

  // Carousel navigation
  const totalSlides = 6;
  const goToNext = () => {
    if (activeSlideIndex < totalSlides - 1) {
      setActiveSlideIndex(activeSlideIndex + 1);
    }
  };
  const goToPrevious = () => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('[OnboardAnalyticsPage] punchlines state', {
      punchlines,
      hasInstagramProfile,
      hasInstagramInsight,
      hasTikTokProfile,
      hasTikTokInsight,
    });
  }, [punchlines, hasInstagramProfile, hasInstagramInsight, hasTikTokProfile, hasTikTokInsight]);

  // Log punchlines on client side for debugging
  useEffect(() => {
    console.log('[OnboardAnalyticsPage] Received punchlines', {
      count: initialPunchlines.length,
      punchlines: initialPunchlines.map(p => ({
        source: p.source,
        label: p.label,
        preview: p.punchline.substring(0, 50),
        severity: p.severity,
      })),
      hasInstagramProfile,
      hasInstagramInsight,
      hasTikTokProfile,
      hasTikTokInsight,
      hasFacebookProfile,
      hasFacebookInsight,
    });
  }, [initialPunchlines, hasInstagramProfile, hasInstagramInsight, hasTikTokProfile, hasTikTokInsight, hasFacebookProfile, hasFacebookInsight]);

  // Poll for Instagram, TikTok, and Facebook insights if profile exists but insight doesn't
  useEffect(() => {
    // Check initial state
    const initialHasInstagram = punchlines.some(p => p.source === 'instagram');
    const initialHasTikTok = punchlines.some(p => p.source === 'tiktok');
    const initialHasFacebook = punchlines.some(p => p.source === 'facebook');
    const shouldPollInstagram = hasInstagramProfile && !initialHasInstagram;
    const shouldPollTikTok = hasTikTokProfile && !initialHasTikTok;
    const shouldPollFacebook = hasFacebookProfile && !initialHasFacebook;

    if (!shouldPollInstagram && !shouldPollTikTok && !shouldPollFacebook) {
      console.log('[OnboardAnalyticsPage] No polling needed - all insights available or no profiles');
      return;
    }

    console.log('[OnboardAnalyticsPage] Starting polling for insights', {
      shouldPollInstagram,
      shouldPollTikTok,
      shouldPollFacebook,
      businessId,
    });

    let cancelled = false;
    let pollCount = 0;
    const start = Date.now();
    const MAX_POLL_TIME = 120000; // 2 minutes (increased from 60 seconds)
    const POLL_INTERVAL = 3000; // Poll every 3 seconds (slightly faster)

    const poll = async () => {
      pollCount++;
      
      // Stop after max time to avoid infinite loop
      if (Date.now() - start > MAX_POLL_TIME || cancelled) {
        console.log('[OnboardAnalyticsPage] Polling stopped', {
          reason: cancelled ? 'cancelled' : 'timeout',
          pollCount,
          elapsed: Date.now() - start,
        });
        return;
      }

      // Check current state to see if we still need to poll
      setPunchlines(current => {
        const hasInstagram = current.some(p => p.source === 'instagram');
        const hasTikTok = current.some(p => p.source === 'tiktok');
        const hasFacebook = current.some(p => p.source === 'facebook');
        const stillNeedInstagram = shouldPollInstagram && !hasInstagram;
        const stillNeedTikTok = shouldPollTikTok && !hasTikTok;
        const stillNeedFacebook = shouldPollFacebook && !hasFacebook;
        
        if (!stillNeedInstagram && !stillNeedTikTok && !stillNeedFacebook) {
          cancelled = true; // Stop polling
          console.log('[OnboardAnalyticsPage] All insights found, stopping polling', {
            pollCount,
            elapsed: Date.now() - start,
          });
        }
        return current; // Don't modify state, just check
      });

      if (cancelled) return;

      try {
        // Check current state using ref (synchronous read)
        const currentPunchlines = punchlinesRef.current;
        const hasInstagram = currentPunchlines.some(p => p.source === 'instagram');
        const hasTikTok = currentPunchlines.some(p => p.source === 'tiktok');
        const hasFacebook = currentPunchlines.some(p => p.source === 'facebook');

        // Poll for all networks if needed
        const networksToPoll: string[] = [];
        if (shouldPollInstagram && !hasInstagram) {
          networksToPoll.push('instagram');
        }
        if (shouldPollTikTok && !hasTikTok) {
          networksToPoll.push('tiktok');
        }
        if (shouldPollFacebook && !hasFacebook) {
          networksToPoll.push('facebook');
        }

        if (networksToPoll.length === 0) {
          cancelled = true;
          console.log('[OnboardAnalyticsPage] No networks to poll, stopping');
          return;
        }

        console.log(`[OnboardAnalyticsPage] Polling attempt ${pollCount} for networks:`, networksToPoll);

        const promises = networksToPoll.map(async (network) => {
          try {
          const res = await fetch(
            `/api/social/insights?businessId=${businessId}&network=${network}`,
              { 
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-cache',
                },
              }
          );

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: Failed to fetch ${network} insights`);
            }

          const data = await res.json();

            if (!data || !data.ok) {
              throw new Error(`Invalid response for ${network}: ${JSON.stringify(data)}`);
          }

            return { network, insights: data.insights || [] };
          } catch (error) {
            console.warn(`[OnboardAnalyticsPage] Error fetching ${network} insights:`, error);
            return { network, insights: [] };
          }
        });

        const results = await Promise.all(promises);

        // Process each result
        let foundAny = false;
        for (const { network, insights } of results) {
          if (cancelled) break;

          // Look for insight with punchline
          const insight = (insights || []).find(
            (i: any) =>
              i.network?.toLowerCase() === network &&
              i.punchline &&
              typeof i.punchline === 'string' &&
              i.punchline.trim().length > 0
          );

          if (insight) {
            foundAny = true;
            setPunchlines(prev => {
              // Avoid duplicates
              const exists = prev.some(
                p =>
                  p.source === network &&
                  p.punchline === insight.punchline.trim()
              );

              if (exists) {
                console.log(`[OnboardAnalyticsPage] ${network} punchline already exists, skipping`);
                return prev;
              }

              const networkLabels: Record<string, string> = {
                instagram: 'INSTAGRAM',
                tiktok: 'TIKTOK',
                facebook: 'FACEBOOK',
              };

              const newPunchline: Punchline = {
                source: network as 'instagram' | 'tiktok' | 'facebook',
                label: networkLabels[network] || network.toUpperCase(),
                punchline: insight.punchline.trim(),
                severity: (insight.severity?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high' | 'critical',
              };

              // Sort: Google first, then Instagram, then TikTok, then Facebook
              const updated = [...prev, newPunchline].sort((a, b) => {
                const order: Record<string, number> = { google: 0, instagram: 1, tiktok: 2, facebook: 3 };
                const aOrder = order[a.source] ?? 99;
                const bOrder = order[b.source] ?? 99;
                return aOrder - bOrder;
              });

              console.log(`[OnboardAnalyticsPage] ✅ ${network} punchline received via polling`, {
                punchline: newPunchline.punchline.substring(0, 50) + '...',
                severity: newPunchline.severity,
                pollCount,
                elapsed: Date.now() - start,
              });

              return updated;
            });
          } else {
            console.log(`[OnboardAnalyticsPage] No ${network} insight found yet (attempt ${pollCount})`);
          }
        }

        // Check if we found all expected insights
        if (foundAny) {
          setPunchlines(current => {
            const hasInstagram = current.some(p => p.source === 'instagram');
            const hasTikTok = current.some(p => p.source === 'tiktok');
            const hasFacebook = current.some(p => p.source === 'facebook');
            const stillNeedInstagram = shouldPollInstagram && !hasInstagram;
            const stillNeedTikTok = shouldPollTikTok && !hasTikTok;
            const stillNeedFacebook = shouldPollFacebook && !hasFacebook;
            
            if (!stillNeedInstagram && !stillNeedTikTok && !stillNeedFacebook) {
              cancelled = true;
              console.log('[OnboardAnalyticsPage] All insights found after update, stopping polling');
            }
            return current;
          });
          if (cancelled) return;
        }
      } catch (err) {
        // Log error but continue polling
        console.warn('[OnboardAnalyticsPage] Poll error (will retry)', {
          error: err,
          pollCount,
          elapsed: Date.now() - start,
        });
      }

      // Schedule next poll
      if (!cancelled) {
        setTimeout(poll, POLL_INTERVAL);
      }
    };

    // Start polling after a short delay to allow initial render
    const timeoutId = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [businessId, hasInstagramProfile, hasTikTokProfile, hasFacebookProfile, initialPunchlines]); // Include initialPunchlines to re-check when they change

  const [business, setBusiness] = useState<Business>(initialBusiness);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  const supabase = createBrowserSupabaseClient();
  
  // Progressive data loading
  const { row: kpiRow, loading: kpisLoading } = useRow1Kpis({ supabase, placeId });
  
  // Compute "your" stats for advantage chip comparisons
  const yourStats = {
    rating: kpiRow?.rating_avg ?? null,
    reviews: kpiRow?.reviews_total ?? null,
  };
  
  // Use preloaded discovery queries (no client-side fetching in normal flow)
  const discoveryQueries = initialDiscoveryQueries && initialDiscoveryQueries.length > 0
    ? initialDiscoveryQueries
    : [];

  // Use preloaded top search data (no client-side fetching in normal flow)
  const topSearch = initialTopSearch;
  const primaryQuery = topSearch?.query || null;
  const userRank = topSearch?.userRank ?? undefined;
  const leaders = topSearch?.leaders || [];
  const isChasers = topSearch?.isChasers || false;
  
  // Use heading from topSearch if available, otherwise generate dynamically
  const topSearchHeading = topSearch?.heading || (() => {
    if (!primaryQuery) {
      return "Who's beating you for your top search?";
    }
    if (userRank !== undefined && userRank > 0) {
      return { type: 'ranked', rank: userRank };
    }
    return { type: 'not-ranked' };
  })();

  // Calculate rank offset for leader cards (if first leader is #2, it means #1 was sponsored)
  const rankOffset = leaders.length > 0 && leaders[0].rank > 1 ? leaders[0].rank - 1 : 0;
  
  // Debug log for top search leaders
  useEffect(() => {
    console.log("[ui] topSearchLeaders", { 
      primaryQuery, 
      userRank,
      leadersLength: leaders?.length,
      leaders: leaders?.slice(0, 3).map(l => ({ name: l.name, rank: l.rank }))
    });
  }, [primaryQuery, userRank, leaders]);
  
  // Lock visibility based ONLY on server-side data (no flash)
  const hasInitialCompetitors = initialCompetitors.length > 0;
  
  // Use initial competitors as the base, allow background refresh if needed
  const [syncedCompetitors, setSyncedCompetitors] = useState(initialCompetitors);
  
  // Only refresh in background if we had initial competitors (optional optimization)
  // If no initial competitors, section won't render anyway
  useEffect(() => {
    if (!hasInitialCompetitors) {
      return; // No competitors from server - section won't render, skip refresh
    }

    // Optional: refresh competitors in background to get latest data
    // This is safe because section visibility is locked to initialCompetitors
    const refreshCompetitors = async () => {
      try {
        const { data: dbCompetitors } = await supabase
          .from("business_competitors")
          .select("competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw, snapshot_ts")
          .eq("business_place_id", placeId)
          .order("is_stronger", { ascending: false })
          .order("reviews_total", { ascending: false })
          .order("rating_avg", { ascending: false })
          .limit(6);

        if (dbCompetitors && dbCompetitors.length > 0) {
          setSyncedCompetitors(dbCompetitors);
        }
      } catch (err) {
        console.warn("[OnboardAnalytics] Background competitor refresh failed:", err);
        // Ignore errors - we already have initialCompetitors
      }
    };

    // Small delay to avoid blocking initial render
    const timeoutId = setTimeout(refreshCompetitors, 1000);
    return () => clearTimeout(timeoutId);
  }, [placeId, hasInitialCompetitors, supabase]);

  // Convert kpiRow to KPIs format
  const kpis: KPIs | null = kpiRow
    ? {
        rating_avg: kpiRow.rating_avg,
        reviews_total: kpiRow.reviews_total,
        reviews_last_30: kpiRow.reviews_last_30,
        visual_trust: kpiRow.visual_trust,
        negative_share_percent: kpiRow.negative_share_percent,
        has_gbp: kpiRow.has_gbp,
      }
    : null;

  const primaryCategory = Array.isArray(business.categories) && business.categories.length > 0
    ? business.categories[0]?.replace(/_/g, " ")
    : null;


  // Load optimistic business data from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("hunter:selectedBusiness");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.place_id === placeId) {
          setBusiness({
            name: parsed.name || initialBusiness.name,
            google_maps_url: parsed.google_maps_url || initialBusiness.google_maps_url,
            city: parsed.city || initialBusiness.city,
            categories: parsed.categories || initialBusiness.categories,
            address: parsed.address || initialBusiness.address,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to read sessionStorage:", err);
    }
  }, [placeId, initialBusiness]);

  // Fire kickoff on mount (non-blocking, idempotent)
  useEffect(() => {
    fetch("/api/onboard/kickoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPlaceId: placeId }),
    }).catch((err) => {
      console.error("Kickoff failed:", err);
    });
  }, [placeId]);

  // Discovery phrases are now preloaded from server - no client-side fetching needed

  // Creator matches are built from business data (no API call needed)

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger kickoff again (idempotent)
      await fetch("/api/onboard/kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessPlaceId: placeId }),
      });
      
      // Force a re-sync by reloading the page to trigger a fresh sync
      // The useSyncedCompetitors hook will run again on mount
      window.location.reload();
    } catch (error) {
      console.error("Failed to refresh:", error);
      setRefreshing(false);
    }
  };

  // Convert synced competitors to UI format and compute leader metrics for gap analysis
  const competitors: Competitor[] = syncedCompetitors.map((synced) => {
    const photoRef = synced.raw?.photo_reference as string | undefined;
    const photoUrl = photoRef ? placePhotoUrl(photoRef, { maxWidth: 800 }) : '';
    const reasonsShort = (synced.raw?.reasons_short as string[]) || [];
    return {
      competitor_place_id: synced.competitor_place_id,
      name: synced.name,
      distance_m: synced.distance_m || 0,
      rating_avg: synced.rating_avg,
      reviews_total: synced.reviews_total,
      photo_url: photoUrl,
      bullets: reasonsShort, // Use reasons_short as bullets for display
      reasons_short: reasonsShort,
      source: "heuristic" as const,
      is_stronger: synced.is_stronger || false,
    };
  });

  // Note: Gap analysis has been replaced with AI-generated punchlines

  // Prepare punchline loading states
  const hasInstagramPunchline = punchlines.some(p => p.source === 'instagram');
  const hasTikTokPunchline = punchlines.some(p => p.source === 'tiktok');
  const hasFacebookPunchline = punchlines.some(p => p.source === 'facebook');
  const shouldShowInstagramLoading = hasInstagramProfile && !hasInstagramPunchline;
  const shouldShowTikTokLoading = hasTikTokProfile && !hasTikTokPunchline;
  const shouldShowFacebookLoading = hasFacebookProfile && !hasFacebookPunchline;

  // Calculate delays for staggered animations
  const baseDelay = punchlines.length;
  const instagramDelay = baseDelay;
  const tiktokDelay = baseDelay + (shouldShowInstagramLoading ? 1 : 0);
  const facebookDelay = baseDelay + (shouldShowInstagramLoading ? 1 : 0) + (shouldShowTikTokLoading ? 1 : 0);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header with business name and refresh */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 z-30">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-950">
                {business.name}
              </h1>
              {(primaryCategory || business.city) && (
                <p className="text-xs md:text-sm text-slate-600 mt-1">
                  {primaryCategory && <span>{primaryCategory}</span>}
                  {primaryCategory && business.city && <span> · </span>}
                  {business.city && <span>{business.city}</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {business.google_maps_url && (
                <a
                  href={business.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 transition-colors"
                >
                  View on Maps
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Container with internal scrolling */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
        >
          {/* Slide 1: How people should be finding you */}
          <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-4">
                How people should be finding you
              </h2>
              <p className="text-sm md:text-[15px] text-slate-600 mb-6">
                These are the searches your ideal customers are using to find businesses like yours.
              </p>
              {discoveryQueries.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {discoveryQueries.slice(0, 5).map((phrase: string, index: number) => {
                    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(phrase)}`;
                    return (
                      <a
                        key={index}
                        href={googleSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white/90 text-sm md:text-base text-slate-700 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                      >
                        <Search className="h-4 w-4 text-slate-500" />
                        {phrase}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Slide 2: You're ranked #X for your top search */}
          <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
                    {typeof topSearchHeading === 'string' ? (() => {
                      // Parse rank number from heading string (e.g., "You're ranked #15 for your top search" or "#15+")
                      const rankMatch = topSearchHeading.match(/#(\d+)(\+?)/);
                      if (rankMatch) {
                        const rank = parseInt(rankMatch[1], 10);
                        const hasPlus = rankMatch[2] === '+';
                        const parts = topSearchHeading.split(/#\d+\+?/);
                        return (
                          <>
                            {parts[0]}
                            <span className={cn(
                              "font-bold text-3xl md:text-4xl",
                              rank === 1 
                                ? "text-red-600" 
                                : "text-amber-600"
                            )}>
                              #{rank}{hasPlus ? '+' : ''}
                            </span>
                            {parts[1]}
                          </>
                        );
                      }
                      // If no rank found, just display the string as-is
                      return topSearchHeading;
                    })() : topSearchHeading.type === 'ranked' ? (
                      <>
                        You're ranked{' '}
                        <span className={cn(
                          "font-bold text-3xl md:text-4xl",
                          topSearchHeading.rank === 1 
                            ? "text-red-600" 
                            : "text-amber-600"
                        )}>
                          #{topSearchHeading.rank}
                        </span>
                        {' '}for your top search
                      </>
                    ) : (
                      "You're not in the top results for your top search yet"
                    )}
                  </h2>
                  {primaryQuery && (
                    <p className="text-sm md:text-[15px] text-slate-600">
                      {isChasers 
                        ? "These businesses are right behind you. Stay ahead with consistent reviews and updates."
                        : "We've looked at live Google results for this search and highlighted businesses appearing above you."
                      }
                    </p>
                  )}
                </div>
                {primaryQuery && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(primaryQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-full bg-slate-50 text-sm text-slate-700 border border-slate-200 flex-shrink-0 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    Top search: <span className="font-medium">"{primaryQuery}"</span>
                  </a>
                )}
              </div>
              {leaders.length > 0 && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {leaders.map(leader => {
                    // Get all photos, fallback to photo_reference if photos array is empty
                    const allPhotos = leader.photos && leader.photos.length > 0 
                      ? leader.photos 
                      : (leader.photo_reference ? [leader.photo_reference] : []);
                    
                    // For chasers, don't adjust rank offset - show actual ranks (#2, #3, etc.)
                    // For leaders above user, adjust if first is #2 (sponsored #1)
                    const displayedRank = isChasers 
                      ? leader.rank 
                      : (leader.rank - rankOffset);
                    
                    return (
                      <LeaderCard
                        key={leader.place_id}
                        leader={{
                          place_id: leader.place_id,
                          rank: displayedRank,
                          name: leader.name,
                          rating: leader.rating ?? null,
                          reviews_total: leader.user_ratings_total ?? null,
                          distance_m: leader.distance_m ?? null,
                        }}
                        photos={allPhotos}
                        primaryQuery={primaryQuery || ''}
                        yourStats={yourStats}
                        isChaser={isChasers}
                        userRank={userRank}
                      />
                    );
                  })}
                </div>
              )}
              {leaders.length === 0 && primaryQuery && (
                <p className="mt-4 text-sm text-emerald-600">
                  You're not clearly being outranked for "{primaryQuery}" right now on Google. Let's use creators to protect that position.
                </p>
              )}
            </div>
          </div>

          {/* Slide 3: Your competitors are ahead */}
          {hasInitialCompetitors && syncedCompetitors.length > 0 ? (
            <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-950 mb-2">
                  Your competitors are ahead
                </h2>
                <p className="text-sm md:text-[15px] text-slate-600 mb-6 leading-relaxed">
                  For real searches like these, nearby customers are choosing other spots first. Here's
                  who is winning your 'near me' moments.
                </p>

                {/* Competitor Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {competitors.map((competitor, index) => (
                    <CompetitorTile key={competitor.competitor_place_id} competitor={competitor} index={index} kpis={kpis} />
                  ))}
                </div>

                {/* CTA */}
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => {
                      console.log("Generate 30-day catch-up plan");
                      // TODO: Implement
                    }}
                    className="px-4 py-2 bg-slate-950 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    Generate a 30-day catch-up plan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-950 mb-2">
                  Your competitors are ahead
                </h2>
                <p className="text-sm text-slate-600">
                  We're analyzing your competitors. This will appear once we have data.
                </p>
              </div>
            </div>
          )}

          {/* Slide 4: Why you're not winning that search (yet) */}
          <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">

              <h2 className="text-2xl md:text-3xl font-semibold text-slate-950 mb-2">
                Why you're not winning that search (yet)
              </h2>
              <p className="text-sm md:text-[15px] text-slate-600 mb-6">
                Here's how you stack up against spots already winning those 'near me' moments.
              </p>

              {/* Simplified Punchlines */}
              {punchlines.length === 0 && !shouldShowInstagramLoading && !shouldShowTikTokLoading && !shouldShowFacebookLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-4">
                  <p className="text-sm text-slate-600">
                    You're in a solid position. We'll highlight gaps here when we find them.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {punchlines.map((line, index) => (
                    <motion.div
                      key={`${line.source}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <PunchlineItem line={line} />
                    </motion.div>
                  ))}
                  {shouldShowInstagramLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: instagramDelay * 0.1 }}
                    >
                      <InstagramPunchlineLoading />
                    </motion.div>
                  )}
                  {shouldShowTikTokLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: tiktokDelay * 0.1 }}
                    >
                      <TikTokPunchlineLoading />
                    </motion.div>
                  )}
                  {shouldShowFacebookLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: facebookDelay * 0.1 }}
                    >
                      <FacebookPunchlineLoading />
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slide 5: Real humans ready to fix that */}
          <div className="min-w-full flex-shrink-0 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">

              <RealHumansSection
                businessName={business.name}
                category={primaryCategory}
                city={business.city}
                discoveryQueries={discoveryQueries}
              />
            </div>
          </div>

          {/* Slide 6: Soft Paywall */}
          <div className="min-w-full flex-shrink-0 h-full overflow-hidden">
            {/* Main content area - perfectly fit, scales proportionally */}
            <div className="h-full flex flex-col justify-center items-center w-full" style={{ padding: 'clamp(0.5rem, 1.5vh, 1rem) clamp(1rem, 2.5vw, 1.5rem)' }}>
              <div className="w-full max-w-4xl mx-auto flex flex-col items-center" style={{ gap: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
                {/* Breadcrumb / Context */}
                <div className="w-full text-center flex-shrink-0">
                  <p className="text-slate-500 font-medium uppercase tracking-wide" style={{ fontSize: 'clamp(0.625rem, 1vh, 0.75rem)' }}>
                    Step 6 of 6
                  </p>
                </div>

                {/* Main Heading */}
                <div className="text-center w-full max-w-3xl mx-auto flex-shrink-0 px-2">
                  <h2 className="font-bold text-slate-900 leading-tight" style={{ 
                    fontSize: 'clamp(1rem, 3vw, 2rem)',
                    marginBottom: 'clamp(0.375rem, 1.2vh, 0.75rem)'
                  }}>
                    Premium business growth at the<br />
                    <span className="text-emerald-600 relative">
                      cost of lunch
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600/30 -rotate-1"></span>
                    </span>{" "}
                    with a friend
                  </h2>
                  <p className="text-slate-600 max-w-xl mx-auto leading-snug px-2" style={{ 
                    fontSize: 'clamp(0.7rem, 1.3vw, 0.9rem)'
                  }}>
                    Get the full Hunter playbook, done-for-you insights, and always-on monitoring for just <strong className="text-slate-900">R299/m</strong>. No confusing tiers, no hidden fees.
                  </p>
                </div>

                {/* Premium Card */}
                <div className="w-full mx-auto flex-shrink-0" style={{ maxWidth: 'clamp(16rem, 25vw, 24rem)' }}>
                  <div className="bg-white rounded-xl border-2 border-slate-200 shadow-lg w-full" style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem)' }}>
                    {/* Card Header */}
                    <div className="text-center" style={{ marginBottom: 'clamp(0.5rem, 1.5vh, 1rem)' }}>
                      <h3 className="font-bold text-slate-900" style={{ 
                        fontSize: 'clamp(1rem, 2.2vw, 1.5rem)',
                        marginBottom: 'clamp(0.375rem, 1.2vh, 0.625rem)'
                      }}>
                        Hunter Premium
                      </h3>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="font-bold text-slate-900" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)' }}>R299</span>
                        <span className="text-slate-600" style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.25rem)' }}>/month</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="mb-3 flex flex-col" style={{ 
                      gap: 'clamp(0.375rem, 1.2vh, 0.625rem)'
                    }}>
                      <li className="flex items-start gap-2.5">
                        <svg
                          className="text-emerald-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ width: 'clamp(0.875rem, 1.6vw, 1.25rem)', height: 'clamp(0.875rem, 1.6vw, 1.25rem)' }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-slate-700 leading-snug" style={{ fontSize: 'clamp(0.7rem, 1.3vw, 0.9rem)' }}>
                          Deeper competitor & "near me" ranking insights
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <svg
                          className="text-emerald-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ width: 'clamp(0.875rem, 1.6vw, 1.25rem)', height: 'clamp(0.875rem, 1.6vw, 1.25rem)' }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-slate-700 leading-snug" style={{ fontSize: 'clamp(0.7rem, 1.3vw, 0.9rem)' }}>
                          Weekly opportunity alerts & action steps
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <svg
                          className="text-emerald-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ width: 'clamp(0.875rem, 1.6vw, 1.25rem)', height: 'clamp(0.875rem, 1.6vw, 1.25rem)' }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-slate-700 leading-snug" style={{ fontSize: 'clamp(0.7rem, 1.3vw, 0.9rem)' }}>
                          Social + GBP performance tracking in one place
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <svg
                          className="text-emerald-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ width: 'clamp(0.875rem, 1.6vw, 1.25rem)', height: 'clamp(0.875rem, 1.6vw, 1.25rem)' }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-slate-700 leading-snug" style={{ fontSize: 'clamp(0.7rem, 1.3vw, 0.9rem)' }}>
                          Priority onboarding & support
                        </span>
                      </li>
                    </ul>

                    {/* Primary CTA */}
                    <div style={{ marginBottom: 'clamp(0.375rem, 1.2vh, 0.625rem)' }}>
                      <button
                        onClick={handleCompleteOnboarding}
                        disabled={paywallLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ 
                          padding: 'clamp(0.5rem, 1.5vh, 0.875rem) clamp(0.875rem, 2.2vw, 1.25rem)',
                          fontSize: 'clamp(0.8rem, 1.6vw, 1rem)'
                        }}
                      >
                        {paywallLoading ? "Processing..." : "Unlock Hunter Premium"}
                      </button>
                    </div>

                    {/* Secondary CTA - Below primary button */}
                    <div className="text-center">
                      <button
                        onClick={handleSkipToDashboard}
                        disabled={skipLoading || paywallLoading}
                        className="text-slate-600 hover:text-slate-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline decoration-slate-300 hover:decoration-slate-600"
                        style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)' }}
                      >
                        {skipLoading ? "Loading..." : "Not now — take me to my dashboard"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls - Sticky Footer */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 z-30">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <button
            onClick={goToPrevious}
            disabled={activeSlideIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveSlideIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  activeSlideIndex === index
                    ? "bg-slate-900 w-8"
                    : "bg-slate-300 hover:bg-slate-400"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
            <span className="ml-3 text-sm text-slate-600">
              {activeSlideIndex + 1} of {totalSlides}
            </span>
          </div>

          {activeSlideIndex === totalSlides - 1 ? (
            // On last slide, hide Next button (use paywall CTAs instead)
            <div className="w-24" /> // Spacer to maintain layout
          ) : (
            <button
              onClick={goToNext}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky Action Bar */}
      {selectedActions.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-slate-950 text-white rounded-lg shadow-lg p-4 flex items-center gap-4">
            <div className="text-sm">
              Plan: +30 reviews · 2 creators · launch in 14 days
            </div>
            <button
              onClick={() => {
                console.log("Start plan");
                // TODO: Implement
              }}
              className="px-4 py-2 bg-white text-slate-950 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              Start plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Leader Card Component with Image Carousel
function LeaderCard({ 
  leader, 
  photos, 
  primaryQuery,
  yourStats,
  isChaser = false,
  userRank = undefined
}: { 
  leader: { 
    place_id: string; 
    rank: number; 
    name: string; 
    rating: number | null; 
    reviews_total: number | null; 
    distance_m: number | null;
  }; 
  photos: string[];
  primaryQuery: string;
  yourStats: { rating: number | null; reviews: number | null };
  isChaser?: boolean;
  userRank?: number;
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const hasMultiplePhotos = photos.length > 1;

  // Preload all images on mount
  useEffect(() => {
    photos.forEach((photoRef, index) => {
      if (photoRef) {
        const img = new Image();
        const photoUrl = placePhotoUrl(photoRef, { maxWidth: 800 });
        img.src = photoUrl;
        img.onload = () => {
          setLoadedImages((prev) => new Set(prev).add(index));
        };
        img.onerror = () => {
          // Still mark as "loaded" to avoid infinite retries
          setLoadedImages((prev) => new Set(prev).add(index));
        };
      }
    });
  }, [photos]);

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  // Build all photo URLs
  const photoUrls = photos.map((photoRef) => 
    photoRef ? placePhotoUrl(photoRef, { maxWidth: 800 }) : null
  );

  return (
    <div className="group relative border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      {/* Square image container with carousel */}
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {/* Ranking pill - emphasized for FOMO */}
        <div className={cn(
          "absolute top-3 left-3 z-[25] rounded-lg font-bold shadow-lg",
          "backdrop-blur-sm border-2 transition-all duration-300",
          "group-hover:scale-110",
          leader.rank === 1
            ? "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-amber-950 border-amber-300 shadow-amber-500/50 px-3 py-1.5 text-sm"
            : leader.rank === 2
            ? "bg-gradient-to-br from-rose-500 via-red-500 to-rose-600 text-white border-rose-400 shadow-rose-500/50 px-3 py-1.5 text-sm"
            : "bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white border-orange-400 shadow-orange-500/50 px-2.5 py-1 text-xs"
        )}>
          <div className="flex items-center gap-1.5">
            {leader.rank === 1 && (
              <span className="text-base leading-none">👑</span>
            )}
            <span className="leading-tight">
              #{leader.rank}
            </span>
            {leader.rank === 1 && (
              <span className="text-[10px] font-semibold opacity-90 leading-tight">TOP SPOT</span>
            )}
          </div>
        </div>
        {photoUrls.length > 0 ? (
          <>
            {photoUrls.map((photoUrl, idx) => {
              if (!photoUrl) return null;
              const isActive = idx === currentPhotoIndex;
              
              return (
                <img
                  key={idx}
                  src={photoUrl}
                  alt={`${leader.name} - Photo ${idx + 1}`}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
                    isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                  )}
                  style={{ zIndex: isActive ? 10 : 0 }}
                  loading="eager"
                />
              );
            })}
            {/* Show placeholder while images load */}
            {loadedImages.size === 0 && (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 z-0" />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
        )}
        
        {/* Navigation arrows - only show if multiple photos */}
        {hasMultiplePhotos && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 hover:bg-white shadow-lg transition-all"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 hover:bg-white shadow-lg transition-all"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
            
            {/* Photo indicator dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {photos.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    idx === currentPhotoIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      <div className="p-4 flex flex-col gap-1">
        <div className="font-medium text-slate-900 truncate">
          {leader.name}
        </div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          {leader.distance_m != null && (
            <>
              {leader.distance_m < 1000
                ? `${leader.distance_m}m`
                : `${(leader.distance_m / 1000).toFixed(1)}km`}
              {" away"}
              {leader.rating != null && " · "}
            </>
          )}
          {leader.rating != null && (
            <>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {leader.rating.toFixed(1)} · {formatReviewCount(leader.reviews_total ?? 0)} reviews
            </>
          )}
          {leader.rating == null && leader.reviews_total != null && (
            <>{formatReviewCount(leader.reviews_total)} reviews</>
          )}
          {leader.rating == null && leader.reviews_total == null && "No rating available"}
        </div>
        
        {/* Advantage chips */}
        {(() => {
          const chips = buildAdvantageChips({
            leader: {
              rating: leader.rating ?? null,
              reviews: leader.reviews_total ?? null,
            },
            you: yourStats,
          });
          
          return chips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {chips.map((chip, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1',
                    'border text-[11px]',
                    chip.tone === 'warning'
                      ? 'border-rose-100 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null;
        })()}
        
        <div className="mt-1 text-[10px] font-medium">
          {isChaser ? (
            <span className="text-amber-600">Right behind you — stay ahead.</span>
          ) : userRank && userRank > 0 ? (
            <span className="text-rose-600">Currently ahead of you for this search.</span>
          ) : (
            <span className="text-slate-600">One of the leaders you're competing with.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Competitor Tile Component
function CompetitorTile({ competitor, index, kpis }: { competitor: Competitor; index: number; kpis: KPIs | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const distanceKm = competitor.distance_m < 1000
    ? `${competitor.distance_m}m`
    : `${(competitor.distance_m / 1000).toFixed(1)}km`;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ y: -1 }}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white/98 overflow-hidden transition-all hover:shadow-lg/40"
    >
      {/* Image block */}
      <div className="relative w-full h-[140px] md:h-[170px] bg-gradient-to-br from-slate-200 to-slate-300">
        {competitor.photo_url ? (
          <img
            src={competitor.photo_url}
            alt={competitor.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${competitor.photo_url ? "hidden" : ""}`}>
          <div className="text-2xl font-bold text-slate-400">
            {competitor.name
              .split(" ")
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toUpperCase()}
          </div>
        </div>
        {/* Overlay tag */}
        {competitor.is_stronger && (
          <div className="absolute top-2 left-2">
            <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-medium">
              Outranking you
            </span>
          </div>
        )}
      </div>

      {/* Content block */}
      <div className="p-4 space-y-2">
        {/* Top line */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
            {competitor.name}
          </h3>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            {distanceKm} away · <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{" "}
            {competitor.rating_avg?.toFixed(1) || "—"} · {formatReviewCount(competitor.reviews_total || 0)} reviews
          </p>
        </div>

        {/* Advantage chips */}
        {kpis && (() => {
          const chips = buildAdvantageChips({
            leader: {
              rating: competitor.rating_avg ?? null,
              reviews: competitor.reviews_total ?? null,
            },
            you: {
              rating: kpis.rating_avg ?? null,
              reviews: kpis.reviews_total ?? null,
            },
          });
          
          return chips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {chips.map((chip, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1',
                    'border text-[11px]',
                    chip.tone === 'warning'
                      ? 'border-rose-100 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null;
        })()}
      </div>
    </motion.div>
  );
}

// Instagram Insights Card Component
function InstagramInsightsCard({ insights }: { insights: InstagramInsights }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  // Calculate overall severity from scores (average of all scores)
  const avgScore = Object.values(insights.score).reduce((sum, score) => sum + score, 0) / Object.keys(insights.score).length;
  const severity: 'low' | 'medium' | 'high' | 'critical' = 
    avgScore < 40 ? 'critical' : 
    avgScore < 60 ? 'high' : 
    avgScore < 80 ? 'medium' : 'low';

  const severityColors = {
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const severityLabels = {
    critical: 'Critical gap',
    high: 'High gap',
    medium: 'Medium gap',
    low: 'Low gap',
  };

  // Helper to get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  // Score labels
  const scoreLabels: Record<keyof typeof insights.score, string> = {
    posting_consistency: 'Posting',
    profile_clarity: 'Profile',
    content_to_offer: 'Content',
    engagement_effectiveness: 'Engagement',
    cta_usage: 'CTAs',
    responsiveness: 'Responses',
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur px-5 py-4 md:px-6 md:py-5 transition-all hover:shadow-sm hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Instagram presence
        </h3>
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
            severityColors[severity]
          )}
        >
          {severityLabels[severity]}
        </span>
      </div>

      {/* Headline */}
      <p className="text-sm md:text-base font-medium text-slate-900 mb-4">
        {insights.headline}
      </p>

      {/* Scores Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {Object.entries(insights.score).map(([key, score]) => (
          <div key={key} className="flex flex-col">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
              {scoreLabels[key as keyof typeof insights.score]}
            </div>
            <div className={cn("text-sm font-semibold", getScoreColor(score))}>
              {score}/100
            </div>
          </div>
        ))}
      </div>

      {/* Bullets */}
      {insights.bullets.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Why you're not winning (on Instagram)
          </p>
          <ul className="space-y-1.5">
            {insights.bullets.map((bullet, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

// Punchline Item Component
function PunchlineItem({ line }: { line: Punchline }) {
  const severityColors = {
    low: 'border-slate-200 bg-slate-50 text-slate-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-800',
    high: 'border-red-200 bg-red-50 text-red-800',
    critical: 'border-red-300 bg-red-100 text-red-900',
  };

  const severityBorders = {
    low: 'border-l-slate-300',
    medium: 'border-l-amber-400',
    high: 'border-l-red-400',
    critical: 'border-l-red-500',
  };

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 px-4 py-3",
        severityColors[line.severity],
        severityBorders[line.severity]
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0 pt-0.5">
          {line.label}
        </span>
        <p className="text-sm font-medium flex-1">{line.punchline}</p>
      </div>
    </div>
  );
}

// Instagram Punchline Loading Component
function InstagramPunchlineLoading() {
  return (
    <div className="rounded-lg border-l-4 border-l-slate-300 border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0 pt-0.5">
          INSTAGRAM
        </span>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-sm text-slate-600 flex-1">
            Analyzing your Instagram presence based on your recent posts
          </p>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// TikTok Punchline Loading Component
function TikTokPunchlineLoading() {
  return (
    <div className="rounded-lg border-l-4 border-l-slate-300 border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0 pt-0.5">
          TIKTOK
        </span>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-sm text-slate-600 flex-1">
            Analyzing your TikTok performance based on your recent videos
          </p>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Facebook Punchline Loading Component
function FacebookPunchlineLoading() {
  return (
    <div className="rounded-lg border-l-4 border-l-slate-300 border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0 pt-0.5">
          FACEBOOK
        </span>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-sm text-slate-600 flex-1">
            Analyzing your Facebook page performance
          </p>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}


