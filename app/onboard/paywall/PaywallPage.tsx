"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PaywallPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboard/complete", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      console.log("[onboarding] Completed via paywall");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("[paywall] Error completing onboarding", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    // For now, just complete onboarding and redirect
    // TODO: Add Stripe checkout flow here
    await completeOnboarding();
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Eyebrow */}
        <div className="text-center mb-6">
          <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Step 3 of 3
          </span>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Premium business growth at the cost of lunch with a friend
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            Get the full Hunter playbook, done-for-you insights, and always-on
            monitoring for just <strong className="text-slate-900">R299/m</strong>.
            No confusing tiers, no hidden fees.
          </p>
        </div>

        {/* Plan Block */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg p-8 md:p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Hunter Premium
              </h2>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-slate-900">R299</span>
                <span className="text-xl text-slate-600">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-700">
                  Deeper competitor & "near me" ranking insights
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-700">
                  Weekly opportunity alerts & action steps
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-700">
                  Social + GBP performance tracking in one place
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-700">
                  Priority onboarding & support
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="max-w-md mx-auto space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? "Processing..." : "Unlock Hunter Premium for R299/m"}
          </button>

          <button
            onClick={handleSkip}
            disabled={loading}
            className="w-full text-sm text-slate-600 hover:text-slate-900 font-medium py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Not now — take me to my dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

