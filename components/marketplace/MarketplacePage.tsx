"use client";

import { useState, useMemo, useEffect } from "react";
import { FiltersBar } from "./FiltersBar";
import { ServiceCard } from "./ServiceCard";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import {
  DUMMY_SERVICES,
  ServiceType,
  FollowerRange,
  GenderFilter,
  FOLLOWER_RANGES,
  MarketplaceService,
} from "./types";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const FAVORITES_STORAGE_KEY = "hunter_marketplace_favorites";

type ViewMode = "all" | "favorites";

export function MarketplacePage() {
  // View mode (All vs Favorites)
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  
  // Filter state
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<ServiceType[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [followerRange, setFollowerRange] = useState<FollowerRange>("any");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("any");
  
  // Modal state
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Favorites state - initialize as empty, then load from localStorage
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Load favorites from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setFavoriteIds(new Set(ids));
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage:", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save favorites to localStorage whenever they change (but not on initial mount)
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      const idsArray = Array.from(favoriteIds);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(idsArray));
    } catch (error) {
      console.error("Failed to save favorites to localStorage:", error);
    }
  }, [favoriteIds, isInitialized]);

  // Service type toggle
  const handleServiceTypeToggle = (type: ServiceType | "all") => {
    if (type === "all") {
      setSelectedServiceTypes([]);
    } else {
      setSelectedServiceTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
      );
    }
  };

  // Interest toggle
  const handleInterestToggle = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  // Filter logic
  const filteredServices = useMemo(() => {
    let services = DUMMY_SERVICES;

    // First filter by view mode (favorites vs all)
    if (viewMode === "favorites") {
      services = services.filter((service) => favoriteIds.has(service.id));
    }

    // Then apply other filters
    return services.filter((service) => {
      // Service type filter
      if (selectedServiceTypes.length > 0) {
        const hasMatchingType = selectedServiceTypes.some((type) =>
          service.serviceTypes.includes(type)
        );
        if (!hasMatchingType) return false;
      }

      // Location filter
      if (locationFilter.trim()) {
        const searchTerm = locationFilter.toLowerCase().trim();
        const matchesLocation =
          service.location.toLowerCase().includes(searchTerm) ||
          service.city.toLowerCase().includes(searchTerm) ||
          service.suburb.toLowerCase().includes(searchTerm);
        if (!matchesLocation) return false;
      }

      // Interests filter
      if (selectedInterests.length > 0) {
        const hasMatchingInterest = selectedInterests.some((interest) =>
          service.interests.includes(interest)
        );
        if (!hasMatchingInterest) return false;
      }

      // Followers filter
      if (followerRange !== "any") {
        const range = FOLLOWER_RANGES.find((r) => r.value === followerRange);
        if (range) {
          if (range.min !== undefined && service.followers < range.min) {
            return false;
          }
          if (range.max !== undefined && service.followers > range.max) {
            return false;
          }
        }
      }

      // Gender filter
      if (genderFilter !== "any" && service.gender !== genderFilter) {
        return false;
      }

      return true;
    });
  }, [
    viewMode,
    favoriteIds,
    selectedServiceTypes,
    locationFilter,
    selectedInterests,
    followerRange,
    genderFilter,
  ]);

  // Quick filter tags
  const quickFilterTags = [
    { label: "Need more reviews?", types: ["review_booster" as ServiceType] },
    { label: "Need content?", types: ["ugc_creator" as ServiceType] },
    {
      label: "Drive local traffic?",
      types: ["local_influencer" as ServiceType],
    },
  ];

  const handleQuickFilter = (types: ServiceType[]) => {
    setSelectedServiceTypes(types);
  };

  const handleViewDetails = (service: MarketplaceService) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleToggleFavorite = (serviceId: string) => {
    setFavoriteIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">
            Browse on-demand growth partners for reviews, content, and local visibility.
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 self-start">
          <button
            onClick={() => setViewMode("all")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              viewMode === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            All
          </button>
          <button
            onClick={() => setViewMode("favorites")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
              viewMode === "favorites"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                viewMode === "favorites"
                  ? "fill-red-500 text-red-500"
                  : "text-slate-400"
              )}
            />
            Favorites
            {favoriteIds.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-200 rounded-full">
                {favoriteIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick filter tags */}
      <div className="flex flex-wrap gap-2">
        {quickFilterTags.map((tag) => (
          <button
            key={tag.label}
            onClick={() => handleQuickFilter(tag.types)}
            className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <FiltersBar
        selectedServiceTypes={selectedServiceTypes}
        onServiceTypeToggle={handleServiceTypeToggle}
        locationFilter={locationFilter}
        onLocationChange={setLocationFilter}
        selectedInterests={selectedInterests}
        onInterestToggle={handleInterestToggle}
        followerRange={followerRange}
        onFollowerRangeChange={setFollowerRange}
        genderFilter={genderFilter}
        onGenderChange={setGenderFilter}
        resultCount={filteredServices.length}
        totalCount={viewMode === "favorites" ? favoriteIds.size : DUMMY_SERVICES.length}
      />

      {/* Results Grid */}
      {filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ServiceCard 
              key={service.id} 
              service={service} 
              onViewDetails={handleViewDetails}
              isFavorited={favoriteIds.has(service.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="max-w-md">
            {viewMode === "favorites" ? (
              <>
                <Heart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No favorites yet
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Start favoriting influencers to see them here. Click the heart icon on any service card to add them to your favorites.
                </p>
                <button
                  onClick={() => setViewMode("all")}
                  className="text-sm text-primary hover:text-primary/80 hover:underline"
                >
                  Browse all influencers
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No matches yet
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Try widening your filters or changing location.
                </p>
                <button
                  onClick={() => {
                    setSelectedServiceTypes([]);
                    setLocationFilter("");
                    setSelectedInterests([]);
                    setFollowerRange("any");
                    setGenderFilter("any");
                  }}
                  className="text-sm text-primary hover:text-primary/80 hover:underline"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Service Details Modal */}
      <ServiceDetailsModal
        service={selectedService}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        isFavorited={selectedService ? favoriteIds.has(selectedService.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />
    </>
  );
}

