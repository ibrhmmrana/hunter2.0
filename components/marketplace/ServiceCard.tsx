"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketplaceService, SERVICE_TYPE_LABELS } from "./types";
import { Instagram, Youtube, Facebook, Video, Globe, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface ServiceCardProps {
  service: MarketplaceService;
  onViewDetails?: (service: MarketplaceService) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (serviceId: string) => void;
}

const networkIcons = {
  instagram: Instagram,
  tiktok: Video,
  facebook: Facebook,
  youtube: Youtube,
  multi: Globe,
};

const networkColors = {
  instagram: "text-pink-600",
  tiktok: "text-black",
  facebook: "text-blue-600",
  youtube: "text-red-600",
  multi: "text-slate-600",
};

export function ServiceCard({ service, onViewDetails, isFavorited = false, onToggleFavorite }: ServiceCardProps) {
  const NetworkIcon = networkIcons[service.network];
  const networkColor = networkColors[service.network];

  // Generate avatar initials
  const initials = service.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Format followers
  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition relative">
      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite?.(service.id);
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-white hover:shadow-md transition-all"
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-colors",
            isFavorited
              ? "fill-red-500 text-red-500"
              : "text-slate-400 hover:text-red-500"
          )}
        />
      </button>

      {/* Top row: Avatar + Handle + Location */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {service.avatarUrl ? (
            <img
              src={service.avatarUrl}
              alt={service.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(service.name)}&size=48`;
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-slate-200">
              <span className="text-sm font-semibold text-primary">{initials}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-900 truncate">
              {service.handle}
            </span>
            <NetworkIcon className={cn("h-4 w-4 flex-shrink-0", networkColor)} />
          </div>
          <p className="text-xs text-slate-500 truncate">{service.location}</p>
        </div>
      </div>

      {/* Name + Service type chips */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-2">
          {service.name}
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {service.serviceTypes.map((type) => (
            <Badge
              key={type}
              variant="secondary"
              className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {SERVICE_TYPE_LABELS[type].split(" ")[0]}
            </Badge>
          ))}
        </div>
      </div>

      {/* Short pitch */}
      <p className="text-sm text-slate-600 line-clamp-2 flex-1">
        {service.shortPitch}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
        <span className="font-medium text-slate-700">
          {formatFollowers(service.followers)} followers
        </span>
        {service.rating && (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            {service.rating}
          </span>
        )}
        {service.completedJobs !== undefined && (
          <span>{service.completedJobs} jobs</span>
        )}
      </div>

      {/* Metrics blurb */}
      {service.metricsBlurb && (
        <p className="text-xs text-slate-500 italic">{service.metricsBlurb}</p>
      )}

      {/* Price + CTA */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Starting from</p>
            <p className="text-lg font-bold text-slate-900">
              R{formatNumber(service.startingFrom)}
            </p>
          </div>
        </div>
        <Button
          className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            onViewDetails?.(service);
          }}
        >
          View details
        </Button>
      </div>
    </div>
  );
}

