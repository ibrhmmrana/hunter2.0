"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Star, MapPin } from "lucide-react";
import { formatReviewCount } from "@/lib/format";

interface Competitor {
  business_place_id: string;
  competitor_place_id: string;
  name: string;
  rating_avg: number | null;
  reviews_total: number | null;
  distance_m: number;
  is_stronger: boolean;
  snapshot_ts: string;
  raw?: {
    lat?: number;
    lng?: number;
    photo_reference?: string;
  };
}

interface OnboardCompetitorsSectionProps {
  competitors: Competitor[] | null;
  isLoading: boolean;
  error: string | null;
  userRating?: number | null;
  userReviewsTotal?: number | null;
}

export function OnboardCompetitorsSection({
  competitors,
  isLoading,
  error,
  userRating,
  userReviewsTotal,
}: OnboardCompetitorsSectionProps) {
  // Format distance in km
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m away`;
    }
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  // Generate micro-copy for competitor
  const getMicroCopy = (competitor: Competitor): string => {
    // For now, use fallback message
    // In future, could derive from AI search phrases if available
    return "Likely to win more 'near me' searches for similar customers.";
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Your competitors outranking you</h2>
          <p className="text-sm text-muted-foreground">
            These nearby spots are winning more 'near me' searches than you. We use real Google data.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="rounded-2xl border shadow-soft">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
                  <div className="h-3 bg-gray-200 animate-pulse rounded w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Your competitors outranking you</h2>
          <p className="text-sm text-muted-foreground">
            These nearby spots are winning more 'near me' searches than you. We use real Google data.
          </p>
        </div>
        <Card className="rounded-2xl border border-gray-200 bg-gray-50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center">
              We couldn&apos;t load competitor data right now. Try again in a moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No competitors found
  if (!competitors || competitors.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Your competitors outranking you</h2>
          <p className="text-sm text-muted-foreground">
            These nearby spots are winning more 'near me' searches than you. We use real Google data.
          </p>
        </div>
        <Card className="rounded-2xl border border-gray-200 bg-gray-50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center">
              No obvious local competitors are currently outranking you. Keep it that way with fresh reviews and content.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Display competitors (limit to top 6)
  const displayCompetitors = competitors.slice(0, 6);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Your competitors outranking you</h2>
        <p className="text-sm text-muted-foreground">
          These nearby spots are winning more &apos;near me&apos; searches than you. We use real Google data.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayCompetitors.map((competitor) => {
          const isOutranking =
            competitor.is_stronger ||
            (userRating !== null &&
              userRating !== undefined &&
              competitor.rating_avg !== null &&
              competitor.rating_avg !== undefined &&
              competitor.rating_avg >= userRating &&
              userReviewsTotal !== null &&
              userReviewsTotal !== undefined &&
              competitor.reviews_total !== null &&
              competitor.reviews_total !== undefined &&
              competitor.reviews_total >= userReviewsTotal);

          return (
            <Card
              key={competitor.competitor_place_id}
              className="rounded-2xl border shadow-soft bg-card"
            >
              <CardContent className="p-6 space-y-3">
                {/* Name and Outranking tag */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 leading-tight flex-1">
                    {competitor.name}
                  </h3>
                  {isOutranking && (
                    <span className="rounded-full bg-red-50 text-red-600 text-[10px] font-medium px-2 py-1 flex-shrink-0 whitespace-nowrap">
                      Outranking you
                    </span>
                  )}
                </div>

                {/* Distance */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{formatDistance(competitor.distance_m)}</span>
                </div>

                {/* Rating and Reviews */}
                <div className="flex items-center gap-2 text-sm">
                  {competitor.rating_avg !== null && competitor.rating_avg !== undefined ? (
                    <>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{competitor.rating_avg.toFixed(1)}</span>
                      </div>
                      {competitor.reviews_total !== null &&
                        competitor.reviews_total !== undefined && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              {formatReviewCount(competitor.reviews_total)} reviews
                            </span>
                          </>
                        )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No rating</span>
                  )}
                </div>

                {/* Micro-copy */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {getMicroCopy(competitor)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

