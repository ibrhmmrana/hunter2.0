"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Chip,
  Link as MuiLink,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Star from "@mui/icons-material/Star";
import SearchIcon from "@mui/icons-material/Search";
import RefreshCwIcon from "@mui/icons-material/Refresh";
import ArrowUpRightIcon from "@mui/icons-material/ArrowUpward";
import CloseRounded from "@mui/icons-material/CloseRounded";
import Error from "@mui/icons-material/Error";
import Favorite from "@mui/icons-material/Favorite";
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
  googleReviewSnapshot?: {
    negative_reviews: number;
    positive_reviews: number;
    days_since_last_review: number | null;
    total_reviews: number;
    reviews_distribution: {
      oneStar: number;
      twoStar: number;
      threeStar: number;
      fourStar: number;
      fiveStar: number;
    } | null;
    negative_summary: string | null;
    positive_summary: string | null;
    snapshot_ts: string;
  } | null;
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
  googleReviewSnapshot = null,
}: OnboardAnalyticsPageProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Debug log for Google review snapshot
  useEffect(() => {
    console.log('[OnboardAnalyticsPage] Google review snapshot', {
      hasSnapshot: !!googleReviewSnapshot,
      snapshot: googleReviewSnapshot,
      hasNegativeSummary: !!googleReviewSnapshot?.negative_summary,
      hasPositiveSummary: !!googleReviewSnapshot?.positive_summary,
      negativeSummary: googleReviewSnapshot?.negative_summary?.substring(0, 50),
      positiveSummary: googleReviewSnapshot?.positive_summary?.substring(0, 50),
      totalReviews: googleReviewSnapshot?.total_reviews,
      negativeReviews: googleReviewSnapshot?.negative_reviews,
      positiveReviews: googleReviewSnapshot?.positive_reviews,
    });
  }, [googleReviewSnapshot]);
  
  // Carousel state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  
  // Store punchlines in state for live updates
  const [punchlines, setPunchlines] = useState<Punchline[]>(initialPunchlines);
  const punchlinesRef = useRef<Punchline[]>(initialPunchlines);
  const [skipLoading, setSkipLoading] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [regeneratingSummaries, setRegeneratingSummaries] = useState(false);

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
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default", overflow: "hidden" }}>
      {/* Header with business name and refresh */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
          borderBottom: "1px solid",
          borderColor: "outline.variant",
          zIndex: 30,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", py: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 500 }}>
                {business.name}
            </Typography>
              {(primaryCategory || business.city) && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {primaryCategory && <span>{primaryCategory}</span>}
                  {primaryCategory && business.city && <span> · </span>}
                  {business.city && <span>{business.city}</span>}
              </Typography>
              )}
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
              {business.google_maps_url && (
              <MuiLink
                  href={business.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "14px",
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { color: "text.primary" },
                }}
                >
                  View on Maps
                <ArrowUpRightIcon size={16} />
              </MuiLink>
              )}
            <Button
                onClick={handleRefresh}
                disabled={refreshing}
              startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshCwIcon size={16} />}
              sx={{
                fontSize: "14px",
                color: "text.secondary",
                "&:hover": { color: "text.primary" },
              }}
            >
                Refresh data
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Carousel Container with internal scrolling */}
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box
          sx={{
            display: "flex",
            height: "100%",
            transition: "transform 0.3s ease-in-out",
            transform: `translateX(-${activeSlideIndex * 100}%)`,
          }}
        >
          {/* Slide 1: How people should be finding you */}
          <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
            <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: "1.5rem", md: "1.875rem" },
                  fontWeight: 600,
                  mb: 2,
                  color: "text.primary"
                }}
              >
                How people should be finding you
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: "0.875rem",
                  mt: 1,
                  mb: 3
                }}
              >
                These are the searches your ideal customers are using to find businesses like yours.
              </Typography>
              {discoveryQueries.length > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {discoveryQueries.slice(0, 5).map((phrase: string, index: number) => {
                    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(phrase)}`;
                    return (
                      <Chip
                        key={index}
                        component="a"
                        href={googleSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<SearchIcon size={16} />}
                        label={phrase}
                        clickable
                        sx={{
                          bgcolor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                          border: "1px solid",
                          borderColor: "outline.variant",
                          "&:hover": {
                            bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
                            borderColor: "outline.main",
                          },
                        }}
                      />
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ 
                  borderRadius: 2, 
                  border: "1px solid", 
                  borderColor: "outline.variant", 
                  bgcolor: "surface.variant", 
                  p: 3,
                  textAlign: "center"
                }}>
                  <Typography variant="body2" color="text.secondary">
                    We're analyzing search patterns for your business. Discovery queries will appear here once analysis is complete.
                  </Typography>
                </Box>
              )}
            </Container>
          </Box>

          {/* Slide 2: You're ranked #X for your top search */}
          <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
            <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, mb: 2 }}>
                <Box>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontSize: { xs: "1.5rem", md: "1.875rem" },
                      fontWeight: 600,
                      mb: 2,
                      color: "text.primary"
                    }}
                  >
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
                  </Typography>
                  {primaryQuery && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: "0.875rem",
                        mt: 1
                      }}
                    >
                      {isChasers 
                        ? "These businesses are right behind you. Stay ahead with consistent reviews and updates."
                        : "We've looked at live Google results for this search and highlighted businesses appearing above you."
                      }
                    </Typography>
                  )}
                </Box>
                {primaryQuery && (
                  <Chip
                    component="a"
                    href={`https://www.google.com/search?q=${encodeURIComponent(primaryQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    label={`Top search: "${primaryQuery}"`}
                    clickable
                    sx={{
                      bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                      border: "1px solid",
                      borderColor: "outline.variant",
                      "&:hover": {
                        bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
                        borderColor: "outline.main",
                      },
                    }}
                  />
                )}
              </Box>
              {leaders.length > 0 ? (
                <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2.5 }}>
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
                </Box>
              ) : primaryQuery ? (
                <Box sx={{ 
                  mt: 3,
                  borderRadius: 2, 
                  border: "1px solid", 
                  borderColor: "outline.variant", 
                  bgcolor: "surface.variant", 
                  p: 3,
                  textAlign: "center"
                }}>
                  <Typography variant="body2" color="text.secondary">
                    You're not clearly being outranked for "{primaryQuery}" right now on Google. Let's use creators to protect that position.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ 
                  mt: 3,
                  borderRadius: 2, 
                  border: "1px solid", 
                  borderColor: "outline.variant", 
                  bgcolor: "surface.variant", 
                  p: 3,
                  textAlign: "center"
                }}>
                  <Typography variant="body2" color="text.secondary">
                    We're analyzing your search rankings. Top search competitors will appear here once analysis is complete.
                  </Typography>
                </Box>
              )}
            </Container>
          </Box>

          {/* Slide 3: Your competitors are ahead */}
          {hasInitialCompetitors && syncedCompetitors.length > 0 ? (
            <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
              <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontSize: { xs: "1.5rem", md: "1.875rem" },
                    fontWeight: 600,
                    mb: 2,
                    color: "text.primary"
                  }}
                >
                  Your competitors are ahead
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: "0.875rem",
                    mt: 1,
                    mb: 3,
                    lineHeight: 1.7
                  }}
                >
                  For real searches like these, nearby customers are choosing other spots first. Here's
                  who is winning your 'near me' moments.
                </Typography>

                {/* Competitor Grid */}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
                  {competitors.map((competitor, index) => (
                    <CompetitorTile key={competitor.competitor_place_id} competitor={competitor} index={index} kpis={kpis} />
                  ))}
                </Box>

                {/* CTA */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                  <Button
                    onClick={() => {
                      console.log("Generate 30-day catch-up plan");
                      // TODO: Implement
                    }}
                    variant="contained"
                    sx={{ borderRadius: 2 }}
                  >
                    Generate a 30-day catch-up plan
                  </Button>
                </Box>
              </Container>
            </Box>
          ) : (
            <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
              <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontSize: { xs: "1.5rem", md: "1.875rem" },
                    fontWeight: 600,
                    mb: 2,
                    color: "text.primary"
                  }}
                >
                  Your competitors are ahead
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: "0.875rem",
                    mt: 1,
                    mb: 3
                  }}
                >
                  For real searches like these, nearby customers are choosing other spots first. Here's who is winning your 'near me' moments.
                </Typography>
                <Box sx={{ 
                  borderRadius: 2, 
                  border: "1px solid", 
                  borderColor: "outline.variant", 
                  bgcolor: "surface.variant", 
                  p: 3,
                  textAlign: "center"
                }}>
                  <Typography variant="body2" color="text.secondary">
                    We're analyzing your competitors. Competitor cards will appear here once analysis is complete.
                  </Typography>
                </Box>
              </Container>
            </Box>
          )}

          {/* Slide 4: Why you're not winning that search (yet) */}
          <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
            <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: "1.5rem", md: "1.875rem" },
                  fontWeight: 600,
                  mb: 2,
                  color: "text.primary"
                }}
              >
                Why you're not winning that search (yet)
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: "0.875rem",
                  mt: 1,
                  mb: 3
                }}
              >
                Here's how you stack up against spots already winning those 'near me' moments.
              </Typography>

              {/* Google Review Analysis */}
              {googleReviewSnapshot ? (
                <Box sx={{ mb: 3 }}>
                  <Card
                    variant="filled"
                    sx={{
                      borderRadius: 2,
                      backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                      boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        boxShadow: "0px 4px 8px rgba(0,0,0,0.12)",
                        transform: "translateY(-2px)",
                      },
                    }}
                    onClick={() => setGoogleDialogOpen(true)}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2.5}>
                        {googleReviewSnapshot.negative_summary ? (
                          <Box
                            sx={{
                              bgcolor: (theme) => theme.palette.error?.light || "#FFEBEE",
                              borderLeft: "4px solid",
                              borderColor: (theme) => theme.palette.error?.main || "#C62828",
                              borderRadius: "0 12px 12px 0",
                              p: 3,
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 2,
                              boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
                            }}
                          >
                            <Error sx={{ color: (theme) => theme.palette.error?.main || "#C62828", fontSize: 24, flexShrink: 0, mt: 0.5 }} />
                            <Typography
                              variant="bodyLarge"
                              sx={{
                                color: (theme) => theme.palette.error?.dark || "#B71C1C",
                                fontWeight: 500,
                                lineHeight: 1.7,
                                fontSize: "0.9375rem",
                              }}
                            >
                              {googleReviewSnapshot.negative_summary}
                            </Typography>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                              borderRadius: 2,
                              p: 2.5,
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="bodySmall" sx={{ color: "text.secondary", fontSize: "0.75rem", mb: 1.5 }}>
                              Negative review analysis pending
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setRegeneratingSummaries(true);
                                try {
                                  const response = await fetch("/api/google/reviews/regenerate-summaries", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ businessId: placeId }),
                                  });
                                  const data = await response.json();
                                  if (data.ok) {
                                    window.location.reload();
                                  }
                                } catch (error) {
                                  console.error("Error regenerating summaries:", error);
                                } finally {
                                  setRegeneratingSummaries(false);
                                }
                              }}
                              disabled={regeneratingSummaries}
                              startIcon={regeneratingSummaries ? <CircularProgress size={14} /> : <RefreshCwIcon />}
                              sx={{ fontSize: "0.75rem", borderRadius: 999 }}
                            >
                              Generate
                            </Button>
                          </Box>
                        )}
                        {googleReviewSnapshot.positive_summary ? (
                          <Box
                            sx={{
                              bgcolor: (theme) => theme.palette.success?.light || "#E8F5E9",
                              borderLeft: "4px solid",
                              borderColor: (theme) => theme.palette.success?.main || "#4CAF50",
                              borderRadius: "0 12px 12px 0",
                              p: 3,
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 2,
                              boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
                            }}
                          >
                            <Favorite sx={{ color: (theme) => theme.palette.success?.main || "#4CAF50", fontSize: 24, flexShrink: 0, mt: 0.5 }} />
                            <Typography
                              variant="bodyLarge"
                              sx={{
                                color: (theme) => theme.palette.success?.dark || "#2E7D32",
                                fontWeight: 500,
                                lineHeight: 1.7,
                                fontSize: "0.9375rem",
                              }}
                            >
                              {googleReviewSnapshot.positive_summary}
                            </Typography>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                              borderRadius: 2,
                              p: 2.5,
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="bodySmall" sx={{ color: "text.secondary", fontSize: "0.75rem", mb: 1.5 }}>
                              Positive review analysis pending
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setRegeneratingSummaries(true);
                                try {
                                  const response = await fetch("/api/google/reviews/regenerate-summaries", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ businessId: placeId }),
                                  });
                                  const data = await response.json();
                                  if (data.ok) {
                                    window.location.reload();
                                  }
                                } catch (error) {
                                  console.error("Error regenerating summaries:", error);
                                } finally {
                                  setRegeneratingSummaries(false);
                                }
                              }}
                              disabled={regeneratingSummaries}
                              startIcon={regeneratingSummaries ? <CircularProgress size={14} /> : <RefreshCwIcon />}
                              sx={{ fontSize: "0.75rem", borderRadius: 999 }}
                            >
                              Generate
                            </Button>
                          </Box>
                        )}
                        {googleReviewSnapshot.days_since_last_review !== null && (
                          <Box sx={{ pt: 2, borderTop: "1px solid", borderColor: "outline.variant" }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="bodyMedium" sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
                                Days since last review:
                              </Typography>
                              <Typography variant="bodyMedium" sx={{ fontWeight: 600, fontSize: "0.875rem", color: "text.primary" }}>
                                {googleReviewSnapshot.days_since_last_review}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                        {(googleReviewSnapshot.negative_summary || googleReviewSnapshot.positive_summary) && (
                          <Box 
                            sx={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center", 
                              gap: 0.75, 
                              pt: 1.5,
                              mt: 0.5,
                            }}
                          >
                            <Typography 
                              variant="bodySmall" 
                              sx={{ 
                                color: "primary.main", 
                                fontSize: "0.8125rem",
                                fontWeight: 500,
                              }}
                            >
                              Click for detailed analysis
                            </Typography>
                            <ArrowUpRightIcon sx={{ fontSize: 16, color: "primary.main" }} />
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              ) : (
                <Box sx={{ mb: 3 }}>
                  <Card
                    variant="filled"
                    sx={{
                      borderRadius: 2,
                      backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
                      boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
                    }}
                  >
                    <CardContent sx={{ p: 2, textAlign: "center" }}>
                      <Typography variant="bodyMedium" sx={{ color: "text.secondary", mb: 2 }}>
                        Google review analysis is being prepared. This will appear once your reviews have been analyzed.
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          setRegeneratingSummaries(true);
                          try {
                            const response = await fetch("/api/google/reviews/analyze", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ businessId: placeId, placeId: placeId }),
                            });
                            const data = await response.json();
                            if (data.ok) {
                              // Wait a bit then reload to check for new snapshot
                              setTimeout(() => {
                                window.location.reload();
                              }, 5000);
                            } else {
                              console.error("Failed to start analysis:", data.error);
                            }
                          } catch (error) {
                            console.error("Error starting analysis:", error);
                          } finally {
                            setRegeneratingSummaries(false);
                          }
                        }}
                        disabled={regeneratingSummaries}
                        startIcon={regeneratingSummaries ? <CircularProgress size={16} /> : <RefreshCwIcon />}
                        sx={{ borderRadius: 999, textTransform: "none" }}
                      >
                        {regeneratingSummaries ? "Starting analysis..." : "Start Google Review Analysis"}
                      </Button>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Simplified Punchlines */}
              {punchlines.length === 0 && !shouldShowInstagramLoading && !shouldShowTikTokLoading && !shouldShowFacebookLoading ? (
                <Box sx={{ borderRadius: 3, border: "1px solid", borderColor: "outline.variant", bgcolor: "surface.variant", p: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    You're in a solid position. We'll highlight gaps here when we find them.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
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
                </Stack>
              )}
            </Container>
          </Box>

          {/* Slide 5: Real humans ready to fix that */}
          <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
            <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 3, md: 5 } }}>
              <RealHumansSection
                businessName={business.name}
                category={primaryCategory}
                city={business.city}
                discoveryQueries={discoveryQueries}
              />
            </Container>
          </Box>

          {/* Slide 6: Soft Paywall */}
          <Box sx={{ minWidth: "100%", flexShrink: 0, height: "100%", overflow: "hidden" }}>
            {/* Main content area - perfectly fit, scales proportionally */}
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", p: { xs: 1, sm: 2 } }}>
              <Container maxWidth="lg" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: { xs: 1, sm: 1.5 } }}>
                {/* Breadcrumb / Context */}
                <Box sx={{ width: "100%", textAlign: "center", flexShrink: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: { xs: "0.625rem", sm: "0.75rem" },
                      color: "text.secondary",
                      fontWeight: 500,
                    }}
                  >
                    Step 6 of 6
                  </Typography>
                </Box>

                {/* Main Heading */}
                <Box sx={{ textAlign: "center", width: "100%", maxWidth: "48rem", mx: "auto", flexShrink: 0, px: 1 }}>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.2,
                      fontSize: { xs: "1rem", sm: "1.5rem", md: "2rem" },
                      mb: { xs: 0.5, sm: 1 },
                    }}
                  >
                    Premium business growth at the<br />
                    <Box component="span" sx={{ color: "primary.main", position: "relative" }}>
                      cost of lunch
                      <Box
                        component="span"
                        sx={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: "2px",
                          bgcolor: "primary.main",
                          opacity: 0.3,
                          transform: "rotate(-1deg)",
                        }}
                      />
                    </Box>{" "}
                    with a friend
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      maxWidth: "36rem",
                      mx: "auto",
                      lineHeight: 1.5,
                      px: 1,
                      fontSize: { xs: "0.7rem", sm: "0.9rem" },
                    }}
                  >
                    Get the full Hunter playbook, done-for-you insights, and always-on monitoring for just <Box component="strong" sx={{ color: "text.primary" }}>R299/m</Box>. No confusing tiers, no hidden fees.
                  </Typography>
                </Box>

                {/* Premium Card */}
                <Box sx={{ width: "100%", maxWidth: { xs: "16rem", sm: "20rem", md: "24rem" }, mx: "auto", flexShrink: 0 }}>
                  <Card sx={{ borderRadius: 3, border: "2px solid", borderColor: "outline.variant", boxShadow: 4, p: { xs: 1.5, sm: 2 } }}>
                    <CardContent>
                    {/* Card Header */}
                      <Box sx={{ textAlign: "center", mb: { xs: 1, sm: 1.5 } }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: { xs: 0.5, sm: 1 } }}>
                        Hunter Premium
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="center">
                          <Typography variant="h3" sx={{ fontWeight: 700 }}>
                            R299
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            /month
                          </Typography>
                        </Stack>
                      </Box>

                    {/* Features List */}
                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ fontSize: { xs: 14, sm: 18 }, color: "primary.main", mt: 0.5, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                          Deeper competitor & "near me" ranking insights
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ fontSize: { xs: 14, sm: 18 }, color: "primary.main", mt: 0.5, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                          Weekly opportunity alerts & action steps
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ fontSize: { xs: 14, sm: 18 }, color: "primary.main", mt: 0.5, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                          Social + GBP performance tracking in one place
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ fontSize: { xs: 14, sm: 18 }, color: "primary.main", mt: 0.5, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                          Priority onboarding & support
                          </Typography>
                        </Stack>
                      </Stack>

                    {/* Primary CTA */}
                      <Box sx={{ mb: { xs: 0.5, sm: 1 } }}>
                        <Button
                        onClick={handleCompleteOnboarding}
                        disabled={paywallLoading}
                          variant="contained"
                          fullWidth
                          sx={{
                            borderRadius: 2,
                            py: { xs: 1, sm: 1.5 },
                            fontSize: { xs: "0.8rem", sm: "1rem" },
                            fontWeight: 600,
                        }}
                      >
                        {paywallLoading ? "Processing..." : "Unlock Hunter Premium"}
                        </Button>
                      </Box>

                    {/* Secondary CTA - Below primary button */}
                      <Box sx={{ textAlign: "center" }}>
                        <Button
                        onClick={handleSkipToDashboard}
                        disabled={skipLoading || paywallLoading}
                          variant="text"
                          sx={{
                            fontSize: { xs: "0.7rem", sm: "0.8rem" },
                            color: "text.secondary",
                            textDecoration: "underline",
                            textDecorationColor: "outline.variant",
                            "&:hover": {
                              color: "text.primary",
                              textDecorationColor: "outline.main",
                            },
                          }}
                      >
                        {skipLoading ? "Loading..." : "Not now — take me to my dashboard"}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Container>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Navigation Controls - Sticky Footer */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
          borderTop: "1px solid",
          borderColor: "outline.variant",
          zIndex: 30,
          mt: "auto",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", maxWidth: "lg", mx: "auto", width: "100%" }}>
          <Button
            onClick={goToPrevious}
            disabled={activeSlideIndex === 0}
            startIcon={<ChevronLeft sx={{ fontSize: 20 }} />}
            sx={{
              fontSize: "14px",
              color: "text.secondary",
              "&:hover": { color: "text.primary" },
            }}
          >
            Previous
          </Button>

          {/* Step Indicator */}
          <Stack direction="row" spacing={1} alignItems="center">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <Box
                key={index}
                component="button"
                onClick={() => setActiveSlideIndex(index)}
                sx={{
                  width: activeSlideIndex === index ? 32 : 8,
                  height: 8,
                  borderRadius: 999,
                  bgcolor: activeSlideIndex === index ? "primary.main" : "outline.variant",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    bgcolor: activeSlideIndex === index ? "primary.dark" : "outline.main",
                  },
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
              {activeSlideIndex + 1} of {totalSlides}
            </Typography>
          </Stack>

          {activeSlideIndex === totalSlides - 1 ? (
            <Box sx={{ width: 96 }} /> // Spacer
          ) : (
            <Button
              onClick={goToNext}
              endIcon={<ChevronRight sx={{ fontSize: 20 }} />}
              sx={{
                fontSize: "14px",
                color: "text.secondary",
                "&:hover": { color: "text.primary" },
              }}
            >
              Next
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Sticky Action Bar */}
      {selectedActions.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 40,
            bgcolor: "primary.main",
            color: "onPrimary.main",
            borderRadius: 2,
            boxShadow: 4,
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography variant="body2">
              Plan: +30 reviews · 2 creators · launch in 14 days
          </Typography>
          <Button
              onClick={() => {
                console.log("Start plan");
                // TODO: Implement
              }}
            variant="contained"
            sx={{
              bgcolor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
              color: "primary.main",
              "&:hover": {
                bgcolor: (theme) => theme.palette.surfaceContainerLow?.main || "#E9EEE4",
              },
            }}
            >
              Start plan
          </Button>
        </Box>
      )}

      {/* Google Review Analysis Dialog */}
      <Dialog
        open={googleDialogOpen}
        onClose={() => setGoogleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 2,
            backgroundColor: (theme) => theme.palette.surfaceContainer?.main || "#FFFFFF",
            boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
            px: 3,
            pt: 3,
          }}
        >
          <Typography variant="titleLarge" sx={{ fontWeight: 500 }}>
            Google Reviews Analysis
          </Typography>
          <IconButton
            onClick={() => setGoogleDialogOpen(false)}
            size="small"
            sx={{
              color: (theme) => theme.palette.onSurfaceVariant?.main,
              "&:hover": {
                backgroundColor: (theme) => theme.palette.surfaceContainerHigh?.main,
              },
            }}
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={3}>
            {googleReviewSnapshot && (
              <>
                {/* Negative Reviews Summary */}
                {googleReviewSnapshot.negative_summary && (
                  <Box>
                    <Typography variant="titleMedium" sx={{ mb: 2, fontWeight: 600 }}>
                      Negative Reviews Analysis
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: (theme) => theme.palette.error?.light || "#FFEBEE",
                        borderLeft: "4px solid",
                        borderColor: (theme) => theme.palette.error?.main || "#C62828",
                        borderRadius: "0 8px 8px 0",
                        p: 2.5,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Error sx={{ color: (theme) => theme.palette.error?.main || "#C62828", fontSize: 24, flexShrink: 0, mt: 0.5 }} />
                        <Box>
                          <Typography
                            variant="bodyMedium"
                            sx={{
                              color: (theme) => theme.palette.error?.dark || "#B71C1C",
                              fontWeight: 500,
                              lineHeight: 1.6,
                              mb: 1,
                            }}
                          >
                            {googleReviewSnapshot.negative_summary}
                          </Typography>
                          {googleReviewSnapshot.negative_reviews > 0 && (
                            <Typography variant="bodySmall" sx={{ color: (theme) => theme.palette.error?.dark || "#B71C1C", opacity: 0.8 }}>
                              Based on {googleReviewSnapshot.negative_reviews} negative reviews
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                )}

                {/* Positive Reviews Summary */}
                {googleReviewSnapshot.positive_summary && (
                  <Box>
                    <Typography variant="titleMedium" sx={{ mb: 2, fontWeight: 600 }}>
                      Positive Reviews Analysis
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: (theme) => theme.palette.success?.light || "#E8F5E9",
                        borderLeft: "4px solid",
                        borderColor: (theme) => theme.palette.success?.main || "#4CAF50",
                        borderRadius: "0 8px 8px 0",
                        p: 2.5,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Favorite sx={{ color: (theme) => theme.palette.success?.main || "#4CAF50", fontSize: 24, flexShrink: 0, mt: 0.5 }} />
                        <Box>
                          <Typography
                            variant="bodyMedium"
                            sx={{
                              color: (theme) => theme.palette.success?.dark || "#2E7D32",
                              fontWeight: 500,
                              lineHeight: 1.6,
                              mb: 1,
                            }}
                          >
                            {googleReviewSnapshot.positive_summary}
                          </Typography>
                          {googleReviewSnapshot.positive_reviews > 0 && (
                            <Typography variant="bodySmall" sx={{ color: (theme) => theme.palette.success?.dark || "#2E7D32", opacity: 0.8 }}>
                              Based on {googleReviewSnapshot.positive_reviews} positive reviews
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                )}

                {/* Review Statistics */}
                <Box
                  sx={{
                    bgcolor: (theme) => theme.palette.surfaceContainerHigh?.main || "#F6FAF0",
                    borderRadius: 2,
                    p: 2.5,
                  }}
                >
                  <Typography variant="titleMedium" sx={{ mb: 2, fontWeight: 600 }}>
                    Review Statistics
                  </Typography>
                  <Stack spacing={1.5}>
                    {googleReviewSnapshot.total_reviews > 0 && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="bodyMedium" sx={{ color: "text.secondary" }}>
                          Total reviews:
                        </Typography>
                        <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                          {googleReviewSnapshot.total_reviews.toLocaleString()}
                        </Typography>
                      </Stack>
                    )}
                    {googleReviewSnapshot.days_since_last_review !== null && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="bodyMedium" sx={{ color: "text.secondary" }}>
                          Days since last review:
                        </Typography>
                        <Typography variant="bodyMedium" sx={{ fontWeight: 500 }}>
                          {googleReviewSnapshot.days_since_last_review}
                        </Typography>
                      </Stack>
                    )}
                    {googleReviewSnapshot.reviews_distribution && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="bodySmall" sx={{ color: "text.secondary", mb: 1 }}>
                          Review distribution:
                        </Typography>
                        <Stack spacing={0.5}>
                          {[5, 4, 3, 2, 1].map((stars) => {
                            const count = googleReviewSnapshot.reviews_distribution?.[
                              stars === 5 ? 'fiveStar' :
                              stars === 4 ? 'fourStar' :
                              stars === 3 ? 'threeStar' :
                              stars === 2 ? 'twoStar' : 'oneStar'
                            ] || 0;
                            const percentage = googleReviewSnapshot.total_reviews > 0
                              ? (count / googleReviewSnapshot.total_reviews) * 100
                              : 0;
                            return (
                              <Stack key={stars} direction="row" alignItems="center" spacing={1}>
                                <Stack direction="row" spacing={0.25} sx={{ minWidth: 80 }}>
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      sx={{
                                        fontSize: 14,
                                        color: s <= stars ? "#FFC107" : "#E0E0E0",
                                        fill: s <= stars ? "#FFC107" : "transparent",
                                      }}
                                    />
                                  ))}
                                </Stack>
                                <Box sx={{ flex: 1, height: 8, bgcolor: "surface.variant", borderRadius: 999, overflow: "hidden" }}>
                                  <Box
                                    sx={{
                                      width: `${percentage}%`,
                                      height: "100%",
                                      bgcolor: stars >= 4 ? "success.main" : stars >= 3 ? "warning.main" : "error.main",
                                      transition: "width 0.3s",
                                    }}
                                  />
                                </Box>
                                <Typography variant="bodySmall" sx={{ minWidth: 60, textAlign: "right", fontSize: "0.75rem" }}>
                                  {count} ({percentage.toFixed(1)}%)
                                </Typography>
                              </Stack>
                            );
                          })}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: "space-between",
            p: { xs: 2, md: 3 },
            borderTop: "1px solid",
            borderColor: (theme) => theme.palette.outlineVariant?.main,
            bgcolor: (theme) => theme.palette.surfaceContainerLow?.main,
          }}
        >
          <Button
            onClick={async () => {
              setRegeneratingSummaries(true);
              try {
                const response = await fetch("/api/google/reviews/regenerate-summaries", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ businessId: placeId }),
                });
                const data = await response.json();
                if (data.ok) {
                  // Reload the page to show updated summaries
                  window.location.reload();
                } else {
                  console.error("Failed to regenerate summaries:", data.error);
                }
              } catch (error) {
                console.error("Error regenerating summaries:", error);
              } finally {
                setRegeneratingSummaries(false);
              }
            }}
            disabled={regeneratingSummaries}
            variant="outlined"
            startIcon={regeneratingSummaries ? <CircularProgress size={16} /> : <RefreshCwIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 500,
              fontSize: "14px",
            }}
          >
            {regeneratingSummaries ? "Regenerating..." : "Regenerate summaries"}
          </Button>
          <Button
            onClick={() => setGoogleDialogOpen(false)}
            variant="contained"
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 500,
              fontSize: "14px",
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.onPrimary?.main || "#FFFFFF",
              "&:hover": {
                backgroundColor: (theme) => theme.palette.primary.dark || "#005005",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
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
              <ChevronLeft sx={{ width: 20, height: 20, color: "text.secondary" }} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 hover:bg-white shadow-lg transition-all"
              aria-label="Next photo"
            >
              <ChevronRight sx={{ width: 20, height: 20, color: "text.secondary" }} />
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
              <Star sx={{ width: 12, height: 12, color: "#FBBF24", fill: "#FBBF24" }} />
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


