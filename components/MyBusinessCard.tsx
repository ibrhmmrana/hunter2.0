"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Globe, ExternalLink } from "lucide-react";

interface MyBusinessCardProps {
  business: {
    place_id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
    image_url?: string | null;
    google_maps_url?: string | null;
  };
}

export function MyBusinessCard({ business }: MyBusinessCardProps) {
  const displayAddress = [business.address, business.city].filter(Boolean).join(', ');

  return (
    <Card className="rounded-2xl border shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Image Column */}
          <div className="lg:col-span-5 relative aspect-video lg:aspect-auto lg:h-full min-h-[200px]">
            {business.image_url ? (
              <Image
                src={business.image_url}
                alt={business.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                unoptimized={business.image_url.startsWith('/api/places/photo')}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
                    <MapPin className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">{business.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="lg:col-span-7 p-6 space-y-4">
            {/* Header with Maps Link */}
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl font-bold text-gray-900 leading-tight">{business.name}</h3>
              {business.google_maps_url && (
                <Link
                  href={business.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#153E23] transition-colors flex-shrink-0"
                  aria-label="View on Google Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View on Maps</span>
                </Link>
              )}
            </div>

            {/* Meta Information */}
            <div className="flex flex-col gap-3">
              {displayAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="line-clamp-2">{displayAddress}</p>
                </div>
              )}

              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>{business.phone}</span>
                </a>
              )}

              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#153E23] transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{business.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}






