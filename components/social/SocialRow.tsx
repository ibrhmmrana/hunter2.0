"use client";

import { KpiCard } from "@/components/kpi/KpiCard";
import { SocialLogoStrip } from "./SocialLogoStrip";
import {
  aggregateSocial,
  scoreSocial,
  socialMicrocopy,
} from "@/lib/social/aggregate";
import { MOCK_SOCIAL } from "@/lib/social/mock";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SocialRowProps {
  channels?: typeof MOCK_SOCIAL.channels;
}

export function SocialRow({ channels = MOCK_SOCIAL.channels }: SocialRowProps) {
  const aggregates = aggregateSocial(channels);
  const bands = scoreSocial(aggregates);
  const microcopy = socialMicrocopy(bands);

  const getColorClass = (band: "low" | "ok" | "good") => {
    if (band === "low") return "text-red-600";
    if (band === "good") return "text-emerald-600";
    return ""; // default foreground
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold">Social (preview)</h2>
          <span className="text-xs text-muted-foreground">
            — connect channels for accuracy
          </span>
        </div>
        <div className="flex items-center">
          <SocialLogoStrip channels={channels} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Followers */}
        <KpiCard
          title="Followers (All)"
          value={
            <span className={cn("text-4xl font-semibold tracking-tight", getColorClass(bands.followersBand))}>
              {formatNumber(aggregates.totalFollowers)}
            </span>
          }
          subtext={microcopy.followers}
        />

        {/* Engagement Rate */}
        <KpiCard
          title="Engagement Rate"
          value={
            aggregates.engagementRate > 0 ? (
              <span className={cn("text-4xl font-semibold tracking-tight", getColorClass(bands.engagementBand))}>
                {aggregates.engagementRate.toFixed(1)}%
              </span>
            ) : (
              "—"
            )
          }
          subtext={microcopy.engagement}
        />

        {/* Posts 7d */}
        <KpiCard
          title="Posts (7d)"
          value={
            <span className={cn("text-4xl font-semibold tracking-tight", getColorClass(bands.postsBand))}>
              {formatNumber(aggregates.posts7d)}
            </span>
          }
          subtext={microcopy.posts}
        />

        {/* Posting Streak */}
        <KpiCard
          title="Posting Streak"
          value={
            aggregates.streak > 0 ? (
              <span className={cn("inline-flex items-center gap-1.5 text-4xl font-semibold tracking-tight", getColorClass(bands.streakBand))}>
                <span className="text-2xl">🔥</span>
                <span>{aggregates.streak} weeks</span>
              </span>
            ) : (
              <span className={cn("text-4xl font-semibold tracking-tight", getColorClass(bands.streakBand))}>
                —
              </span>
            )
          }
          subtext={microcopy.streak}
        />
      </div>

      {/* Action CTAs */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-sm"
          onClick={() => {
            // TODO: Connect Instagram & Facebook
          }}
        >
          Connect Instagram & Facebook
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-sm"
          onClick={() => {
            // TODO: Schedule posts
          }}
        >
          Schedule 4 posts this week
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-sm"
          onClick={() => {
            // TODO: Reply to reviews
          }}
        >
          Reply to 5 recent reviews
        </Button>
      </div>
    </div>
  );
}

