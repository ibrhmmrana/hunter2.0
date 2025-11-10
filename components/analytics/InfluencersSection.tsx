"use client";

export interface Influencer {
  id: string;
  name: string;
  avatarUrl: string;
  tag: string;
  followers: number;
  engagementRate: number;
  distanceKm: number;
  matchReason: string;
}

interface InfluencersSectionProps {
  influencers: Influencer[];
}

export function InfluencersSection({ influencers }: InfluencersSectionProps) {
  if (!influencers || influencers.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Influencers ready to put you on the map
        </h2>
        <p className="text-[10px] text-slate-500">
          Local nano-creators matched to your niche and area.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Influencer cards */}
        {influencers.slice(0, 3).map((influencer) => (
          <div
            key={influencer.id}
            className="rounded-2xl border border-slate-100 bg-white/80 shadow-soft p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <img
                src={influencer.avatarUrl}
                alt={influencer.name}
                className="h-8 w-8 rounded-full object-cover"
                onError={(e) => {
                  // Fallback to a placeholder if image fails to load
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(influencer.name)}&size=32`;
                }}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {influencer.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {influencer.tag} • {influencer.distanceKm}km away
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-600">
              <span>{influencer.followers.toLocaleString()} followers</span>
              <span>{influencer.engagementRate.toFixed(1)}% engagement</span>
            </div>

            <div className="text-[10px] text-emerald-700">
              {influencer.matchReason}
            </div>
          </div>
        ))}

        {/* CTA Card */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 shadow-soft p-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Turn searches into visits
            </div>
            <div className="mt-1 text-xs text-emerald-900">
              We&apos;ve found {influencers.length} ideal local creators who can visit, create content, and help you earn more real reviews.
            </div>
          </div>
          <button
            className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[#153E23] px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-[#1a4d2a] transition-colors"
            type="button"
          >
            Activate a review campaign
          </button>
        </div>
      </div>
    </section>
  );
}




