"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfluencerCardProps {
  influencer: {
    id: string;
    name: string;
    avatarUrl: string;
    tag: string;
    followers: number;
    engagementRate: number;
    distanceKm: number;
    matchReason: string;
  };
  index?: number;
}

export function InfluencerCard({ influencer, index = 0 }: InfluencerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="soft-card p-5 md:p-6 flex flex-col h-full"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <img
            src={influencer.avatarUrl}
            alt={influencer.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(influencer.name)}&size=64`;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-1">
            {influencer.name}
          </h3>
          <div className="text-sm text-slate-600 mb-2">
            {influencer.tag} • {influencer.distanceKm}km away
          </div>
          <div className="text-xs text-slate-500">
            {influencer.followers.toLocaleString()} followers • {influencer.engagementRate.toFixed(1)}% engagement
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-4 flex-1">
        {influencer.matchReason}
      </p>

      <Button
        className="w-full rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white"
        onClick={() => {
          // Placeholder: open invite modal
          console.log("Invite influencer:", influencer.id);
        }}
      >
        Invite for a review visit
      </Button>
    </motion.div>
  );
}




