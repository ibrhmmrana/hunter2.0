"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { CreatorSuggestion } from "./RealHumansSection";

interface CreatorInviteDialogProps {
  creator: CreatorSuggestion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatorInviteDialog({ creator, open, onOpenChange }: CreatorInviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Invite {creator.name} for a review visit</DialogTitle>
          <DialogDescription>
            Send an invitation to {creator.name} to visit your business and create authentic content and reviews.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-sm text-slate-600">
            <p className="font-medium mb-2">Creator details:</p>
            <ul className="space-y-1 text-xs">
              <li>• {creator.niche} creator in {creator.city}</li>
              <li>• {creator.followers >= 1000 ? `${(creator.followers / 1000).toFixed(1)}k` : creator.followers} followers</li>
              <li>• {creator.engagementRate.toFixed(1)}% engagement rate</li>
              <li>• {creator.distanceKm.toFixed(1)} km away</li>
            </ul>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                console.log("Invite sent to:", creator.name);
                onOpenChange(false);
              }}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Send invitation
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

