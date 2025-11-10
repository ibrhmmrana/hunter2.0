"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WatchlistSocialModalProps {
  watchlistId: string;
  competitorName: string;
  missingNetworks: string[];
  prefilledSocials?: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
  };
  onClose: () => void;
}

const networkLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

const networkPlaceholders: Record<string, string> = {
  instagram: "@username or https://instagram.com/username",
  tiktok: "@username or https://tiktok.com/@username",
  facebook: "Page name or https://facebook.com/pagename",
};

export function WatchlistSocialModal({
  watchlistId,
  competitorName,
  missingNetworks,
  prefilledSocials = {},
  onClose,
}: WatchlistSocialModalProps) {
  // Initialize with prefilled socials if provided
  const [socials, setSocials] = useState<Record<string, string>>(prefilledSocials);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (network: string, value: string) => {
    setSocials((prev) => ({ ...prev, [network]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const socialsArray = Object.entries(socials)
        .filter(([_, value]) => value.trim().length > 0)
        .map(([network, handle_or_url]) => ({
          network,
          handle_or_url: handle_or_url.trim(),
        }));

      if (socialsArray.length === 0) {
        onClose();
        return;
      }

      const response = await fetch("/api/watchlist/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlist_id: watchlistId,
          socials: socialsArray,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        onClose();
        // You could show a success toast here
      } else {
        console.error("[WatchlistSocialModal] Failed to add socials:", result.error);
        // You could show an error toast here
      }
    } catch (error) {
      console.error("[WatchlistSocialModal] Error adding socials:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Social Profiles</DialogTitle>
          <DialogDescription>
            Add the competitor's social handles so Hunter can track their content for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {missingNetworks.map((network) => {
            const isPrefilled = !!prefilledSocials[network as keyof typeof prefilledSocials];
            return (
              <div key={network} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={network} className="text-sm font-medium">
                    {networkLabels[network] || network}
                  </Label>
                  {isPrefilled && (
                    <span className="text-xs text-slate-500">
                      Found via Google Business Profile
                    </span>
                  )}
                </div>
                <Input
                  id={network}
                  placeholder={networkPlaceholders[network] || "Enter handle or URL"}
                  value={socials[network] || ""}
                  onChange={(e) => handleInputChange(network, e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Profiles"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

