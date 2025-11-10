"use client";

import { Search } from "lucide-react";

interface DiscoveryStripProps {
  queries: string[];
}

export function DiscoveryStrip({ queries }: DiscoveryStripProps) {
  if (!queries || queries.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        Searches you should be winning
      </div>
      
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Search className="h-3 w-3" />
          <span>Real queries your customers type</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {queries.slice(0, 4).map((query, index) => (
          <div
            key={index}
            className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700"
          >
            {query}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 mt-1">
        These are the kinds of searches where your Google profile, reviews and photos decide if you show up — or disappear.
      </p>
    </div>
  );
}




