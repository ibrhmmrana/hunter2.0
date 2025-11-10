"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Search, Star, MapPin, Users, TrendingUp, MessageSquare, ExternalLink } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatReviewCount } from "@/lib/format";

interface AnalyticsModel {
  placeId: string;
  business: {
    name: string;
    google_maps_url: string | null;
    city: string | null;
    categories: string[] | null;
  };
  kpis: {
    rating_avg: number | null;
    reviews_total: number | null;
    reviews_last_30: number | null;
    visual_trust: number | null;
    negative_share_percent: number | null;
    has_gbp?: boolean;
  } | null;
  discoveryQueries: string[];
  competitors: Array<{
    competitor_place_id: string;
    name: string;
    rating_avg: number | null;
    reviews_total: number | null;
    distance_m: number;
    is_stronger: boolean;
    raw?: {
      photo_reference?: string;
      lat?: number;
      lng?: number;
    };
  }>;
  influencers: Array<{
    id: string;
    name: string;
    avatarUrl: string;
    tag: string;
    followers: number;
    engagementRate: number;
    distanceKm: number;
    matchReason: string;
  }>;
}

interface OnboardAnalyticsCarouselProps {
  analyticsModel: AnalyticsModel;
}

const STEPS = [
  { number: 1, label: "How people should be finding you" },
  { number: 2, label: "Why you're not winning that search (yet)" },
  { number: 3, label: "Real humans ready to fix that" },
] as const;

type StepNumber = 1 | 2 | 3;

export function OnboardAnalyticsCarousel({ analyticsModel }: OnboardAnalyticsCarouselProps) {
  const [step, setStep] = useState<StepNumber>(1);
  const hasKickedOffRef = useRef(false);
  const supabase = createBrowserSupabaseClient();

  // Trigger analysis kickoff once
  useEffect(() => {
    if (hasKickedOffRef.current) return;

    async function kickoffAnalysis() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !analyticsModel.placeId) return;

        const dayStamp = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `gbp:kickoff:${analyticsModel.placeId}:${dayStamp}`;

        if (typeof window !== "undefined" && localStorage.getItem(idempotencyKey)) {
          hasKickedOffRef.current = true;
          return;
        }

        const response = await fetch("/api/analyze/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: analyticsModel.placeId,
            user_id: user.id,
            source: "webapp:onboard/analytics",
          }),
        });

        if (response.ok || response.status === 202) {
          if (typeof window !== "undefined") {
            localStorage.setItem(idempotencyKey, Date.now().toString());
          }
          hasKickedOffRef.current = true;
        }
      } catch (error) {
        console.error("Error kicking off analysis:", error);
      }
    }

    kickoffAnalysis();
  }, [supabase, analyticsModel.placeId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && step > 1) {
        setStep((s) => (s - 1) as StepNumber);
      } else if (e.key === "ArrowRight" && step < 3) {
        setStep((s) => (s + 1) as StepNumber);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  // Helper to get competitor photo URL
  const getCompetitorPhotoUrl = (competitor: AnalyticsModel["competitors"][0]): string => {
    if (competitor.raw?.photo_reference) {
      return `/api/places/photo?ref=${encodeURIComponent(competitor.raw.photo_reference)}&max=800`;
    }
    return "";
  };

  // Helper to get initials for fallback
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  // Compute competitor stats
  const strongerCount = analyticsModel.competitors.filter((c) => c.is_stronger).length;
  const topCompetitor = analyticsModel.competitors[0];
  const avgCompetitorRating =
    analyticsModel.competitors.length > 0
      ? analyticsModel.competitors.reduce((sum, c) => sum + (c.rating_avg || 0), 0) /
        analyticsModel.competitors.length
      : 0;
  const avgCompetitorReviews =
    analyticsModel.competitors.length > 0
      ? analyticsModel.competitors.reduce((sum, c) => sum + (c.reviews_total || 0), 0) /
        analyticsModel.competitors.length
      : 0;

  // Generate creator chips for step 3
  const generateCreatorChips = () => {
    const category = analyticsModel.business.categories?.[0]?.replace(/_/g, " ") || "local business";
    const city = analyticsModel.business.city || "your area";
    
    return [
      {
        name: "Leah",
        tag: "Foodie",
        distance: "3km away",
        description: `loves ${category} spots in ${city}`,
      },
      {
        name: "Thabo",
        tag: category.includes("coffee") ? "Coffee vlogger" : "Lifestyle",
        distance: "5.2km away",
        description: `5.2k followers in ${city}`,
      },
      {
        name: "Sarah",
        tag: "Local",
        distance: "2.1km away",
        description: `creates content about ${category} in ${city}`,
      },
    ];
  };

  const creatorChips = generateCreatorChips();
  const topQuery = analyticsModel.discoveryQueries[0] || "local businesses";

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Stepper */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        {STEPS.map((stepItem) => (
          <button
            key={stepItem.number}
            onClick={() => setStep(stepItem.number as StepNumber)}
            className={`rounded-full px-4 py-2.5 md:px-6 md:py-3 text-sm md:text-base font-medium transition-all duration-200 ${
              step === stepItem.number
                ? "bg-[#153E23] text-white shadow-soft scale-105"
                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {stepItem.number} · {stepItem.label}
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div className="relative min-h-[600px] md:min-h-[700px] overflow-hidden">
        {/* Step 1: How people should be finding you */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            step === 1
              ? "opacity-100 translate-x-0"
              : step > 1
              ? "opacity-0 -translate-x-full"
              : "opacity-0 translate-x-full"
          }`}
        >
          <div className="space-y-6 md:space-y-8">
            {/* Header */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-2">
                <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
                  {analyticsModel.business.name}
                </h1>
                {analyticsModel.business.google_maps_url && (
                  <a
                    href={analyticsModel.business.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm md:text-base text-[#153E23] hover:underline"
                  >
                    View on Maps
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="text-sm md:text-base text-slate-500">
                When people nearby search like this, they should be finding you.
              </p>
            </div>

            {/* Query Pills */}
            {analyticsModel.discoveryQueries.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
                  <span className="text-sm md:text-base text-slate-600 font-medium">
                    Real searches near you:
                  </span>
                  {analyticsModel.discoveryQueries.slice(0, 5).map((query, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 text-slate-700 text-sm md:text-base"
                    >
                      <Search className="h-4 w-4" />
                      {query}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitor Grid */}
            {analyticsModel.competitors.length > 0 ? (
              <>
                <p className="text-base md:text-lg text-slate-700 font-medium">
                  These nearby spots are winning the searches you should own.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {analyticsModel.competitors.slice(0, 6).map((competitor) => {
                    const photoUrl = getCompetitorPhotoUrl(competitor);
                    const isOutranking =
                      competitor.is_stronger ||
                      ((competitor.rating_avg || 0) >= (analyticsModel.kpis?.rating_avg || 0) &&
                        (competitor.reviews_total || 0) >= (analyticsModel.kpis?.reviews_total || 0));

                    return (
                      <div
                        key={competitor.competitor_place_id}
                        className="bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 shadow-soft/0 hover:shadow-soft transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
                      >
                        {/* Photo */}
                        <div className="relative h-32 md:h-48 bg-gradient-to-br from-slate-200 to-slate-300">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={competitor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div
                            className={`absolute inset-0 flex items-center justify-center text-2xl md:text-3xl font-bold text-slate-600 ${
                              photoUrl ? "hidden" : ""
                            }`}
                          >
                            {getInitials(competitor.name)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 md:p-5 space-y-2">
                          <h3 className="text-base md:text-lg font-semibold text-slate-900">
                            {competitor.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>
                              {competitor.distance_m < 1000
                                ? `${competitor.distance_m}m away`
                                : `${(competitor.distance_m / 1000).toFixed(1)} km away`}
                            </span>
                            {competitor.rating_avg && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                  {competitor.rating_avg.toFixed(1)}
                                </span>
                              </>
                            )}
                            {competitor.reviews_total && (
                              <>
                                <span>•</span>
                                <span>{formatReviewCount(competitor.reviews_total)} reviews</span>
                              </>
                            )}
                          </div>
                          {isOutranking && (
                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                              Outranking you
                            </div>
                          )}
                          <p className="text-xs md:text-sm text-slate-500">
                            More proof for searches like &apos;{analyticsModel.discoveryQueries[0] || "local businesses"}&apos;.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8 text-center">
                <p className="text-base md:text-lg text-slate-600">
                  We couldn&apos;t find strong nearby competitors yet — this is your chance to own these searches.
                </p>
              </div>
            )}

            {/* Next hint */}
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(2)}
                className="text-sm md:text-base text-slate-500 hover:text-slate-700 transition-colors"
              >
                Next: see exactly why they&apos;re ahead →
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Why you're not winning that search (yet) */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            step === 2
              ? "opacity-100 translate-x-0"
              : step > 2
              ? "opacity-0 -translate-x-full"
              : "opacity-0 translate-x-full"
          }`}
        >
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
                Why you&apos;re not winning that search (yet).
              </h2>
              <p className="text-base md:text-lg text-slate-600">
                Here&apos;s how you compare to leaders showing up for those searches.
              </p>
            </div>

            {analyticsModel.kpis && topCompetitor ? (
              <div className="space-y-4">
                {/* Rating & Reviews */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                  <div className="flex-1">
                    <div className="text-sm md:text-base text-slate-600 mb-2">You</div>
                    <div className="text-xl md:text-2xl font-semibold text-slate-900">
                      {analyticsModel.kpis.rating_avg?.toFixed(1) || "—"}★ ·{" "}
                      {analyticsModel.kpis.reviews_total
                        ? formatReviewCount(analyticsModel.kpis.reviews_total)
                        : "—"}{" "}
                      reviews
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-sm md:text-base text-slate-600 mb-2">
                      Leader {topCompetitor.distance_m < 1000
                        ? `${topCompetitor.distance_m}m`
                        : `${(topCompetitor.distance_m / 1000).toFixed(1)}km`}{" "}
                      away
                    </div>
                    <div className="text-xl md:text-2xl font-semibold text-slate-900">
                      {topCompetitor.rating_avg?.toFixed(1) || "—"}★ ·{" "}
                      {topCompetitor.reviews_total
                        ? formatReviewCount(topCompetitor.reviews_total)
                        : "—"}{" "}
                      reviews
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-slate-500 -mt-2">
                  Customers trust the busier profile first.
                </p>

                {/* Freshness */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                  <div className="flex-1">
                    <div className="text-sm md:text-base text-slate-600 mb-2">You</div>
                    <div
                      className={`text-xl md:text-2xl font-semibold ${
                        (analyticsModel.kpis.reviews_last_30 || 0) < 3
                          ? "text-red-500"
                          : "text-slate-900"
                      }`}
                    >
                      {analyticsModel.kpis.reviews_last_30 || 0} new review
                      {(analyticsModel.kpis.reviews_last_30 || 0) !== 1 ? "s" : ""} in the last 30
                      days
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-sm md:text-base text-slate-600 mb-2">Leaders</div>
                    <div className="text-xl md:text-2xl font-semibold text-slate-900">
                      avg {Math.round(avgCompetitorReviews / 20) || 8} new reviews in the last 30
                      days
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-slate-500 -mt-2">
                  Google favours fresher activity.
                </p>

                {/* GBP Visibility */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 md:px-6 md:py-5">
                  {analyticsModel.kpis.has_gbp === false ? (
                    <>
                      <div className="text-base md:text-lg font-semibold text-red-500 mb-2">
                        You don&apos;t appear on Google Maps.
                      </div>
                      <div className="text-sm md:text-base text-slate-600">
                        Walk-ins never find you first.
                      </div>
                    </>
                  ) : (
                    <div className="text-sm md:text-base text-slate-600">
                      You appear on Maps, but leaders have more proof.
                    </div>
                  )}
                </div>

                {/* Social Signal (Placeholder) */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 md:px-6 md:py-5">
                  <div className="text-sm md:text-base text-slate-600">
                    They posted 4 Reels this week. Your last Instagram post was 21 days ago.
                    {/* TODO: Wire to real social data */}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8 text-center">
                <p className="text-base md:text-lg text-slate-600">
                  Loading your comparison data...
                </p>
              </div>
            )}

            {/* Next hint */}
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(3)}
                className="text-sm md:text-base text-slate-500 hover:text-slate-700 transition-colors"
              >
                Next: meet the people who can flip this for you →
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: Real humans ready to fix that */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            step === 3
              ? "opacity-100 translate-x-0"
              : step < 3
              ? "opacity-0 translate-x-full"
              : "opacity-0 -translate-x-full"
          }`}
        >
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
                Real humans ready to fix that.
              </h2>
              <p className="text-sm md:text-base text-slate-500">
                Quick, honest ways to grow your credibility and discoverability with local people —
                not bots.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Solution 1: Reviews */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white shadow-soft/0 hover:shadow-soft transition-all duration-200 hover:-translate-y-0.5 px-5 py-5 md:px-6 md:py-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#153E23]/10 flex items-center justify-center mb-4">
                    <Star className="h-6 w-6 text-[#153E23]" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-3">
                    Stand out from your local competitors
                  </h3>
                  <p className="text-sm md:text-base text-slate-600 mb-2">
                    Invite vetted local customers to visit and leave transparent Google reviews.
                  </p>
                  <p className="text-xs md:text-sm text-slate-500">
                    Ideal for: closing the rating & volume gap.
                  </p>
                </div>
                <button
                  className="w-full rounded-xl bg-[#153E23] px-4 py-2.5 text-sm md:text-base font-semibold text-white hover:bg-[#1a4d2a] transition-colors"
                  onClick={() => {
                    // Placeholder: open modal or mailto
                    window.location.href = "mailto:support@example.com?subject=Review Boost";
                  }}
                >
                  Activate review boost
                </button>
              </div>

              {/* Solution 2: Creators */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white shadow-soft/0 hover:shadow-soft transition-all duration-200 hover:-translate-y-0.5 px-5 py-5 md:px-6 md:py-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#153E23]/10 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-[#153E23]" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-3">
                    Get people talking about your business
                  </h3>
                  <p className="text-sm md:text-base text-slate-600 mb-3">
                    Match with nano & micro creators who already speak to your ideal customers.
                  </p>
                  <p className="text-xs md:text-sm text-slate-500 mb-4">
                    They visit, create content, and share their real experience.
                  </p>
                  {/* Creator chips */}
                  <div className="space-y-2">
                    {creatorChips.map((chip, index) => (
                      <div
                        key={index}
                        className="text-xs md:text-sm text-slate-600 bg-white/50 rounded-lg px-3 py-2"
                      >
                        <span className="font-semibold">{chip.name}</span> — {chip.tag},{" "}
                        {chip.distance}, {chip.description}.
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="w-full rounded-xl border border-[#153E23] px-4 py-2.5 text-sm md:text-base font-semibold text-[#153E23] hover:bg-[#153E23]/5 transition-colors"
                  onClick={() => {
                    // Placeholder
                    console.log("View matching creators");
                  }}
                >
                  View matching creators
                </button>
              </div>

              {/* Solution 3: Ads */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white shadow-soft/0 hover:shadow-soft transition-all duration-200 hover:-translate-y-0.5 px-5 py-5 md:px-6 md:py-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#153E23]/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-[#153E23]" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-3">
                    Increase online traffic to your business
                  </h3>
                  <p className="text-sm md:text-base text-slate-600 mb-2">
                    Own the searches above with targeted Google Ads.
                  </p>
                  <p className="text-xs md:text-sm text-slate-500">
                    We build campaigns around &apos;{topQuery}&apos; so you&apos;re seen first.
                  </p>
                </div>
                <button
                  className="w-full rounded-xl border border-[#153E23] px-4 py-2.5 text-sm md:text-base font-semibold text-[#153E23] hover:bg-[#153E23]/5 transition-colors"
                  onClick={() => {
                    // Placeholder
                    window.location.href = "mailto:support@example.com?subject=Google Ads Campaign";
                  }}
                >
                  Talk to us about campaigns
                </button>
              </div>
            </div>

            {/* Trust disclaimer */}
            <p className="text-xs md:text-sm text-slate-500 text-center pt-4">
              We never buy or fake reviews. Creators visit, experience your business, and share
              honestly.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1) as StepNumber)}
          disabled={step === 1}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous step"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <button
          onClick={() => setStep((s) => Math.min(3, s + 1) as StepNumber)}
          disabled={step === 3}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next step"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
