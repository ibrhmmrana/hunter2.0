"use client";

import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketplaceService, SERVICE_TYPE_LABELS } from "./types";
import { Instagram, Youtube, Facebook, Video, Globe, MapPin, Users, Star, CheckCircle2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface ServiceDetailsModalProps {
  service: MarketplaceService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ServiceDetailsModal({ service, open, onOpenChange, isFavorited = false, onToggleFavorite }: ServiceDetailsModalProps) {
  if (!service) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 relative">
        <DialogClose onClose={() => onOpenChange(false)} />
        
        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(service.id);
          }}
          className="absolute top-4 right-12 z-50 p-2 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-white hover:shadow-md transition-all"
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
        
        <div className="flex flex-col md:flex-row">
          {/* Left side - Image */}
          <div className="md:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
            <div className="w-full max-w-xs">
              {service.avatarUrl ? (
                <img
                  src={service.avatarUrl}
                  alt={service.name}
                  className="w-full aspect-square rounded-2xl object-cover border-4 border-white shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(service.name)}&size=400`;
                  }}
                />
              ) : (
                <div className="w-full aspect-square rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-6xl font-bold text-primary">{initials}</span>
                </div>
              )}
            </div>
            
            {/* Price display on image side */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500 mb-1">Starting from</p>
              <p className="text-3xl font-bold text-slate-900">
                R{formatNumber(service.startingFrom)}
              </p>
            </div>
          </div>

          {/* Right side - Details */}
          <div className="md:w-1/2 p-8 flex flex-col gap-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">{service.name}</h2>
                <NetworkIcon className={cn("h-6 w-6", networkColor)} />
              </div>
              <p className="text-slate-600 mb-3">{service.handle}</p>
              
              {/* Service type badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {service.serviceTypes.map((type) => (
                  <Badge
                    key={type}
                    variant="secondary"
                    className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {SERVICE_TYPE_LABELS[type]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900">{service.location}</p>
                <p className="text-sm text-slate-500">{service.city}, South Africa</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">About</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{service.shortPitch}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Followers</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatFollowers(service.followers)}
                  </p>
                </div>
              </div>
              
              {service.rating && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <div>
                    <p className="text-xs text-slate-500">Rating</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {service.rating} / 5.0
                    </p>
                  </div>
                </div>
              )}
              
              {service.completedJobs !== undefined && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-slate-500">Completed Jobs</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {service.completedJobs}
                    </p>
                  </div>
                </div>
              )}
              
              {service.metricsBlurb && (
                <div>
                  <p className="text-xs text-slate-500">Engagement</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {service.metricsBlurb}
                  </p>
                </div>
              )}
            </div>

            {/* Interests */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {service.interests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="outline"
                    className="text-xs px-2 py-1 border-slate-300 text-slate-700"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div>
              <p className="text-xs text-slate-500 mb-1">Gender</p>
              <p className="text-sm font-medium text-slate-900 capitalize">
                {service.gender === 'team' ? 'Mixed / Team' : service.gender}
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-4 border-t border-slate-200">
              <Button
                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-medium"
                onClick={() => {
                  // Placeholder: handle booking/contact
                  console.log("Contact service:", service.id);
                }}
              >
                Contact & Book
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

