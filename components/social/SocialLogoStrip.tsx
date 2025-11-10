"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface SocialLogoStripProps {
  channels: Array<{
    key: string;
    name: string;
    on: boolean;
  }>;
}

const LOGO_MAP: Record<string, string> = {
  instagram: "https://cdn.simpleicons.org/instagram/E4405F",
  facebook: "https://cdn.simpleicons.org/facebook/1877F2",
  tiktok: "https://cdn.simpleicons.org/tiktok/000000",
  x: "https://cdn.simpleicons.org/x/000000",
  youtube: "https://cdn.simpleicons.org/youtube/FF0000",
  linkedin: "https://cdn.simpleicons.org/linkedin/0A66C2",
};

export function SocialLogoStrip({ channels }: SocialLogoStripProps) {
  const enabled = channels.filter((ch) => ch.on);
  const visible = enabled.slice(0, 4);
  const remaining = enabled.length - visible.length;

  if (enabled.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No channels connected</p>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visible.map((channel) => {
        const logoUrl = LOGO_MAP[channel.key];
        return (
          <div
            key={channel.key}
            className="relative w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200"
            title={channel.name}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={channel.name}
                width={20}
                height={20}
                className="object-contain"
                unoptimized
              />
            ) : (
              <span className="text-xs font-medium text-gray-600">
                {channel.name[0]?.toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">
          + {remaining} more
        </span>
      )}
    </div>
  );
}






