"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ConfirmBusinessErrorProps {
  error: string;
  placeId?: string;
}

export function ConfirmBusinessError({ error, placeId }: ConfirmBusinessErrorProps) {
  return (
    <div className="rounded-2xl bg-white shadow-soft p-6 lg:p-8">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/onboarding/business/search"
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Pick a different business
          </Link>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="px-4 py-2 text-sm"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

