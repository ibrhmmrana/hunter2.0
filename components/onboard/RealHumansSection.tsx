"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CreatorInviteDialog } from "./CreatorInviteDialog";

export interface CreatorSuggestion {
  id: string;
  name: string;
  avatarUrl: string;
  niche: string; // e.g. "Foodie", "Lifestyle", "Fashion", "Family"
  distanceKm: number;
  city: string;
  followers: number;
  engagementRate: number; // %
  platforms: string[]; // ["Instagram", "TikTok"]
  fitScore: number; // 0-100
  strengths: string[]; // 2 short bullet points
  lastPostDaysAgo: number;
  isTopMatch?: boolean; // used for #1-3 labels
}

interface RealHumansSectionProps {
  businessName: string;
  category?: string | null;
  city?: string | null;
  discoveryQueries?: string[];
}

type FilterType = "fit" | "closest" | "followers" | "foodies" | "lifestyle" | "fashion" | "beauty";

/**
 * Generate deterministic creator suggestions based on business context.
 */
function generateCreatorSuggestions(
  businessName: string,
  category?: string | null,
  city?: string | null,
  discoveryQueries?: string[]
): CreatorSuggestion[] {
  const categoryLower = (category || "").toLowerCase();
  const cityName = city || "your area";
  const isRestaurant = categoryLower.includes("restaurant") || 
                       categoryLower.includes("food") || 
                       categoryLower.includes("cafe") || 
                       categoryLower.includes("bar") ||
                       categoryLower.includes("dining");
  const isRetail = categoryLower.includes("store") || 
                   categoryLower.includes("shop") || 
                   categoryLower.includes("clothing") ||
                   categoryLower.includes("fashion");
  const isSalon = categoryLower.includes("salon") || 
                  categoryLower.includes("beauty") || 
                  categoryLower.includes("spa") ||
                  categoryLower.includes("hair");
  const isGrocery = categoryLower.includes("grocery") || 
                    categoryLower.includes("supermarket");

  // Base pool of creators
  const baseCreators: Array<{
    name: string;
    niche: string;
    avatarSeed: string;
    followers: number;
    engagementRate: number;
    distanceKm: number;
    platforms: string[];
    fitScore: number;
    strengths: string[];
    lastPostDaysAgo: number;
  }> = [
    {
      name: "Sarah Chen",
      niche: isRestaurant ? "Foodie" : isRetail ? "Fashion" : isSalon ? "Beauty" : "Lifestyle",
      avatarSeed: "sarah-chen",
      followers: 3200,
      engagementRate: 5.2,
      distanceKm: 2.3,
      platforms: ["Instagram", "TikTok"],
      fitScore: isRestaurant ? 92 : isRetail ? 88 : isSalon ? 90 : 85,
      strengths: isRestaurant 
        ? ["Drives Google review actions", `Audience: ${cityName} food lovers`]
        : isRetail
        ? ["Outfit & haul content", `Active in ${cityName} fashion scene`]
        : isSalon
        ? ["Shows before/after transformations", `Beauty expert in ${cityName}`]
        : [`Talks about places in ${cityName}`, "High engagement rate"],
      lastPostDaysAgo: 3,
    },
    {
      name: "Mike Johnson",
      niche: isRestaurant ? "Foodie" : "Lifestyle",
      avatarSeed: "mike-johnson",
      followers: 5800,
      engagementRate: 4.8,
      distanceKm: 4.1,
      platforms: ["Instagram"],
      fitScore: isRestaurant ? 88 : 82,
      strengths: isRestaurant
        ? [`Reviews ${category || "restaurants"} in ${cityName}`, "Known for honest reviews"]
        : [`Covers ${category || "local"} businesses`, `Drives Google review actions`],
      lastPostDaysAgo: 5,
    },
    {
      name: "Emma Williams",
      niche: "Lifestyle",
      avatarSeed: "emma-williams",
      followers: 2100,
      engagementRate: 6.1,
      distanceKm: 1.8,
      platforms: ["Instagram", "TikTok"],
      fitScore: 91,
      strengths: [`Neighborhood expert in ${cityName}`, "Great at interior shots"],
      lastPostDaysAgo: 2,
    },
    {
      name: "David Brown",
      niche: isRestaurant ? "Foodie" : isSalon ? "Lifestyle" : "Local",
      avatarSeed: "david-brown",
      followers: 4500,
      engagementRate: 5.5,
      distanceKm: 3.7,
      platforms: ["Instagram", "TikTok"],
      fitScore: isRestaurant ? 85 : isSalon ? 87 : 83,
      strengths: isRestaurant
        ? [`Specializes in ${category || "restaurant"} reviews`, `Within ${cityName} radius`]
        : isSalon
        ? [`Beauty & ${category || "wellness"} content`, `Active in ${cityName}`]
        : [`Reviews ${category || "local"} spots`, "Drives review responses"],
      lastPostDaysAgo: 7,
    },
    {
      name: "Lisa Anderson",
      niche: isSalon ? "Beauty" : isRetail ? "Fashion" : "Lifestyle",
      avatarSeed: "lisa-anderson",
      followers: 3700,
      engagementRate: 5.8,
      distanceKm: 2.9,
      platforms: ["Instagram"],
      fitScore: isSalon ? 89 : isRetail ? 87 : 84,
      strengths: isSalon
        ? [`Beauty & ${category || "wellness"} content`, `Audience: ${cityName} area`]
        : isRetail
        ? ["Outfit & haul content", `Fashion influencer in ${cityName}`]
        : [`Covers ${category || "local"} businesses`, "Strong visual content"],
      lastPostDaysAgo: 4,
    },
  ];

  // Convert to CreatorSuggestion format
  const suggestions: CreatorSuggestion[] = baseCreators.map((creator, index) => ({
    id: `creator-${index + 1}`,
    name: creator.name,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.avatarSeed}`,
    niche: creator.niche,
    distanceKm: creator.distanceKm,
    city: cityName,
    followers: creator.followers,
    engagementRate: creator.engagementRate,
    platforms: creator.platforms,
    fitScore: creator.fitScore,
    strengths: creator.strengths,
    lastPostDaysAgo: creator.lastPostDaysAgo,
    isTopMatch: index < 3, // Top 3 are marked as top matches
  }));

  // Sort by fit score initially and mark top 3
  const sorted = suggestions.sort((a, b) => b.fitScore - a.fitScore);
  sorted.forEach((s, i) => {
    if (i < 3) s.isTopMatch = true;
  });
  return sorted;
}

export function RealHumansSection({
  businessName,
  category,
  city,
  discoveryQueries = [],
}: RealHumansSectionProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("fit");
  const [selectedCreator, setSelectedCreator] = useState<CreatorSuggestion | null>(null);

  // Generate suggestions
  const allSuggestions = useMemo(
    () => generateCreatorSuggestions(businessName, category, city, discoveryQueries),
    [businessName, category, city, discoveryQueries]
  );

  // Filter and sort based on active filter
  const filteredSuggestions = useMemo(() => {
    let filtered = [...allSuggestions];

    // Apply niche filter
    if (activeFilter === "foodies") {
      filtered = filtered.filter((c) => c.niche === "Foodie");
    } else if (activeFilter === "fashion") {
      filtered = filtered.filter((c) => c.niche === "Fashion");
    } else if (activeFilter === "beauty") {
      filtered = filtered.filter((c) => c.niche === "Beauty");
    } else if (activeFilter === "lifestyle") {
      filtered = filtered.filter((c) => c.niche === "Lifestyle");
    }

    // If filter results in no matches, fallback to all
    if (filtered.length === 0) {
      filtered = [...allSuggestions];
    }

    // Sort based on filter
    if (activeFilter === "fit") {
      filtered.sort((a, b) => b.fitScore - a.fitScore);
    } else if (activeFilter === "closest") {
      filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (activeFilter === "followers") {
      filtered.sort((a, b) => b.followers - a.followers);
    } else {
      // For niche filters, still sort by fit
      filtered.sort((a, b) => b.fitScore - a.fitScore);
    }

    return filtered;
  }, [allSuggestions, activeFilter]);

  const filterOptions: Array<{ id: FilterType; label: string }> = [
    { id: "fit", label: "Highest fit" },
    { id: "closest", label: "Closest" },
    { id: "followers", label: "Most followers" },
    { id: "foodies", label: "Foodies" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "fashion", label: "Fashion" },
    { id: "beauty", label: "Beauty" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
          Real humans ready to fix that
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Meet vetted local creators who can visit, create content, and earn you real reviews — not bots or fake feedback.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const isActive = activeFilter === option.id;
          return (
            <button
              key={option.id}
              onClick={() => setActiveFilter(option.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                isActive
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Creators grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        {filteredSuggestions.slice(0, 5).map((creator, index) => {
          // Determine match rank for top 3
          const matchRank = creator.isTopMatch && index < 3 ? index + 1 : null;
          return (
            <CreatorCard
              key={creator.id}
              creator={creator}
              index={index}
              matchRank={matchRank}
              onInvite={() => setSelectedCreator(creator)}
            />
          );
        })}
      </div>

      {/* See more creators bar */}
      <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80">
        <p className="text-sm text-slate-700">
          We've found more local creators who match your niche and area.
        </p>
        <a
          href="/marketplace"
          className="text-xs md:text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 transition-colors"
        >
          Browse full creator marketplace
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      {/* Invite dialog */}
      {selectedCreator && (
        <CreatorInviteDialog
          creator={selectedCreator}
          open={!!selectedCreator}
          onOpenChange={(open) => !open && setSelectedCreator(null)}
        />
      )}
    </div>
  );
}

// Creator Card Component
function CreatorCard({
  creator,
  index,
  matchRank,
  onInvite,
}: {
  creator: CreatorSuggestion;
  index: number;
  matchRank: number | null;
  onInvite: () => void;
}) {
  const getFitBadgeColor = (score: number) => {
    if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 80) return "bg-sky-50 text-sky-700 border-sky-200";
    if (score >= 70) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  const initials = creator.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      whileHover={{ y: -2 }}
      className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white/80 backdrop-blur-sm transition-all duration-150 hover:shadow-sm"
    >
      {/* Top row: Avatar, Name/Niche, Fit badge */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <img
            src={creator.avatarUrl}
            alt={creator.name}
            className="w-12 h-12 rounded-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />
          <div className="hidden w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
            <span className="text-sm font-semibold text-slate-600">{initials}</span>
          </div>
        </div>

        {/* Name and niche */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{creator.name}</h3>
              <span className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 mt-1">
                {creator.niche}
              </span>
            </div>
            {/* Fit badge */}
            <div className="flex flex-col items-end gap-1">
              {matchRank && (
                <span className="text-[9px] font-medium text-emerald-700">
                  #{matchRank} match
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-semibold border ${getFitBadgeColor(
                  creator.fitScore
                )}`}
              >
                Fit {creator.fitScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <p className="text-[11px] text-slate-500 mt-2">
        {creator.distanceKm.toFixed(1)} km • {creator.city}
      </p>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-600">
        <span>{creator.followers >= 1000 ? `${(creator.followers / 1000).toFixed(1)}k` : creator.followers} followers</span>
        <span>•</span>
        <span>{creator.engagementRate.toFixed(1)}% engagement</span>
        <span>•</span>
        <span>{creator.platforms.join(" · ")}</span>
      </div>

      {/* Strengths */}
      <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
        {creator.strengths.slice(0, 2).map((strength, idx) => (
          <li key={idx} className="flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
            <span>{strength}</span>
          </li>
        ))}
      </ul>

      {/* Last post hint */}
      <p className="text-[10px] text-slate-400 mt-2">
        Last posted {creator.lastPostDaysAgo} {creator.lastPostDaysAgo === 1 ? "day" : "days"} ago
      </p>

      {/* CTA */}
      <button
        onClick={onInvite}
        className="mt-3 inline-flex items-center text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        Invite for review visit
        <ArrowRight className="w-3 h-3 ml-1" />
      </button>
    </motion.div>
  );
}

