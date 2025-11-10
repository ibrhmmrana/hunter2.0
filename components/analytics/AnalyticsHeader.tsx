import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface AnalyticsHeaderProps {
  name?: string | null;
  googleMapsUrl?: string | null;
}

export function AnalyticsHeader({ name, googleMapsUrl }: AnalyticsHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 flex-wrap">
        {name && (
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        )}
        {googleMapsUrl && (
          <Link
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#153E23] hover:underline"
            aria-label="View on Google Maps"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View on Maps</span>
          </Link>
        )}
      </div>
    </div>
  );
}






