"use client";

import { motion } from "framer-motion";
import { Star, MapPin, ExternalLink } from "lucide-react";
import { formatReviewCount } from "@/lib/format";
import Link from "next/link";

interface CompetitorCardV2Props {
  competitor: {
    competitor_place_id: string;
    name: string;
    distance_m: number;
    rating_avg: number | null;
    reviews_total: number | null;
    photo_url: string;
    bullets: string[];
    is_stronger?: boolean;
  };
  index?: number;
}

export function CompetitorCardV2({ competitor, index = 0 }: CompetitorCardV2Props) {
  const isOutranking =
    competitor.is_stronger ||
    (competitor.rating_avg !== null && competitor.rating_avg >= 4.0);

  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${competitor.competitor_place_id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="soft-card overflow-hidden flex flex-col h-full"
    >
      {/* Photo */}
      {/* Image border radius - change rounded-2xl to adjust: rounded-none (0px), rounded-sm (2px), rounded (4px), rounded-md (6px), rounded-lg (8px), rounded-xl (12px), rounded-2xl (16px), rounded-3xl (24px) */}
      <div className="relative h-40 md:h-48 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl overflow-hidden">
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
        <div
          className={`absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-600 ${
            competitor.photo_url ? "hidden" : ""
          }`}
        >
          {competitor.name
            .split(" ")
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase()}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base md:text-lg font-semibold text-slate-900 flex-1">
            {competitor.name}
          </h3>
          {isOutranking && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium whitespace-nowrap">
              Outranking you
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
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

        {/* Bullets */}
        {competitor.bullets && competitor.bullets.length > 0 && (
          <div className="mb-4 flex-1">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Why they&apos;re beating you here:
            </div>
            <ul className="space-y-1.5">
              {competitor.bullets.slice(0, 3).map((bullet, idx) => (
                <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <Link
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-auto"
        >
          Open on Maps
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
}




