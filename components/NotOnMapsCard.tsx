"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface NotOnMapsCardProps {
  onBack?: () => void;
}

export function NotOnMapsCard({ onBack }: NotOnMapsCardProps) {
  return (
    <div className="rounded-2xl bg-white shadow-soft p-6 lg:p-8">
      <Card className="rounded-2xl border shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gray-100 rounded-full">
            <MapPin className="h-6 w-6 text-gray-600" />
          </div>
          <CardTitle className="text-2xl">Not on Google Maps</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 leading-relaxed">
          You&apos;re invisible to &quot;near me&quot; searches. When customers search for businesses
          like yours nearby, your business won&apos;t appear in the results.
        </p>

        <div className="pt-4 space-y-3">
          <Link href="/onboarding/verify">
            <Button className="w-full h-12 rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium">
              Create & Verify My Profile
            </Button>
          </Link>

          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full h-11 rounded-xl border-gray-200"
            >
              Go back to search
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

