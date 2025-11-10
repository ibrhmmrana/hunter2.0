"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram,
  Facebook,
  Linkedin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useAnalysisStatus } from "@/lib/hooks/useAnalysisStatus";

interface ConnectionsPageProps {
  placeId: string;
  businessName: string;
  category: string | null;
  city: string | null;
  googleMapsUrl: string | null;
}

type Platform = "website" | "instagram" | "tiktok" | "facebook" | "linkedin";

interface StepConfig {
  id: Platform;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  icon: React.ReactNode;
  placeholder: string;
  prefix?: string;
  inputType: "url" | "handle";
  helperText: string;
}

const steps: StepConfig[] = [
  {
    id: "instagram",
    label: "Instagram",
    title: "What's your Instagram?",
    description: "We benchmark your content and recency against local leaders.",
    bullets: [
      "Compare posting frequency",
      "Analyze engagement patterns",
      "Identify content gaps",
    ],
    icon: <Instagram className="w-3.5 h-3.5 text-emerald-600" />,
    placeholder: "yourbrand",
    prefix: "instagram.com/@",
    inputType: "handle",
    helperText: "Paste your full URL or handle. We never post on your behalf.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    title: "What's your TikTok?",
    description: "We look for short-form reach potential near your location.",
    bullets: [
      "Measure local video reach",
      "Track trending content",
      "Find creator opportunities",
    ],
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
    placeholder: "yourbrand",
    prefix: "tiktok.com/@",
    inputType: "handle",
    helperText: "Paste your full URL or handle. We never post on your behalf.",
  },
  {
    id: "facebook",
    label: "Facebook",
    title: "What's your Facebook page?",
    description: "We review your Facebook page to understand your community engagement.",
    bullets: [
      "Track review responses",
      "Monitor event promotion",
      "Assess local presence",
    ],
    icon: <Facebook className="w-3.5 h-3.5 text-emerald-600" />,
    placeholder: "yourbrand",
    prefix: "facebook.com/",
    inputType: "handle",
    helperText: "Paste your full URL or page name. We never post on your behalf.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    title: "What's your LinkedIn company page?",
    description: "We check your LinkedIn to see your professional network and B2B presence.",
    bullets: [
      "Evaluate B2B credibility",
      "Track company updates",
      "Measure professional reach",
    ],
    icon: <Linkedin className="w-3.5 h-3.5 text-emerald-600" />,
    placeholder: "yourbrand",
    prefix: "linkedin.com/company/",
    inputType: "handle",
    helperText: "Paste your full URL or company handle. We never post on your behalf.",
  },
];

export function ConnectionsPage({
  placeId,
  businessName,
  category,
  city,
  googleMapsUrl,
}: ConnectionsPageProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<Platform, string>>({
    website: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    linkedin: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll analysis status (kickoff should have been called from confirmation)
  const analysisStatus = useAnalysisStatus(placeId, 5000);

  // Background preloading: start competitor sync, ranking, and discovery queries while user fills connections
  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        // Preload competitor sync and discovery queries
        await fetch("/api/onboard/preload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessPlaceId: placeId }),
          keepalive: true,
        });
        
        // Also trigger ranking API to preload search leaders
        fetch("/api/competitors/ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessPlaceId: placeId }),
          keepalive: true,
        }).catch((e) => {
          console.error("[connect-profiles] ranking preload failed", e);
        });
      } catch (e) {
        console.error("[connect-profiles] preload failed", e);
      }
    })();
  }, [placeId]);

  const handleSave = async () => {
    const step = steps[currentStep];
    const value = values[step.id].trim();

    if (value) {
      setIsSubmitting(true);

      // Optimistically update state
      setValues((prev) => ({ ...prev, [step.id]: value }));

      // Fire non-blocking sync
      fetch("/api/onboard/social-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          platform: step.id,
          value,
        }),
        keepalive: true,
      }).catch((err) => {
        console.error(`[Connections] Failed to sync ${step.id}:`, err);
      });

      // For Instagram, trigger analysis
      if (step.id === "instagram") {
        console.log("[connections] instagram submitted", { placeId, handle: value });
        fetch("/api/social/instagram/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId,
            handle: value,
          }),
          keepalive: true,
        })
          .then((res) => {
            console.log("[connections] Instagram analysis response", { status: res.status, ok: res.ok });
            if (!res.ok) {
              return res.json().then((data) => {
                console.error("[Connections] Instagram analysis failed", { status: res.status, data });
              });
            }
          })
          .catch((err) => {
            console.error("[Connections] Failed to trigger Instagram analysis:", err);
            // Continue anyway - analysis will retry in background
          });
      }

      // For TikTok, trigger analysis
      if (step.id === "tiktok") {
        console.log("[connections] tiktok submitted", { placeId, handle: value });
        fetch("/api/social/tiktok/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId,
            handle: value,
          }),
          keepalive: true,
        })
          .then((res) => {
            console.log("[connections] TikTok analysis response", { status: res.status, ok: res.ok });
            if (!res.ok) {
              return res.json().then((data) => {
                console.error("[Connections] TikTok analysis failed", { status: res.status, data });
              });
            }
          })
          .catch((err) => {
            console.error("[Connections] Failed to trigger TikTok analysis:", err);
            // Continue anyway - analysis will retry in background
          });
      }

      // For Facebook, trigger analysis
      if (step.id === "facebook") {
        console.log("[connections] facebook submitted", { placeId, handle: value });
        fetch("/api/social/facebook/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId,
            handle: value,
          }),
          keepalive: true,
        })
          .then((res) => {
            console.log("[connections] Facebook analysis response", { status: res.status, ok: res.ok });
            if (!res.ok) {
              return res.json().then((data) => {
                console.error("[Connections] Facebook analysis failed", { status: res.status, data });
              });
            }
          })
          .catch((err) => {
            console.error("[Connections] Failed to trigger Facebook analysis:", err);
            // Continue anyway - analysis will retry in background
          });
      }

      // Small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 200));
      setIsSubmitting(false);
    }

    // Move to next step
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - navigate to analytics
      router.push(`/onboard/analytics?place_id=${encodeURIComponent(placeId)}`);
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - navigate to analytics
      router.push(`/onboard/analytics?place_id=${encodeURIComponent(placeId)}`);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepConfig = steps[currentStep];
  const currentValue = values[currentStepConfig.id];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const meta = [category, city].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        {/* Hero Header */}
        <header className="mb-6">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 uppercase">
            Profile setup
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">{businessName}</h1>
              {meta && <p className="mt-1 text-sm text-slate-500">{meta}</p>}
              <p className="mt-2 text-sm text-slate-600">
                We're already analysing your market in the background. Connect your profiles so we can go deeper.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {googleMapsUrl && (
                <Link
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  View on Maps
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
              {/* Analysis Status Indicator */}
              {analysisStatus.status === "running" && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                  <span>Preparing insights… {analysisStatus.progress}%</span>
                </div>
              )}
              {analysisStatus.status === "complete" && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Insights ready ✓</span>
                </div>
              )}
              {analysisStatus.status === "error" && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>We'll retry in the background. You can still continue.</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Progress Indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Step Panel */}
        <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)] gap-10 p-8 md:p-10 rounded-3xl bg-white border border-slate-200 shadow-[0_14px_45px_rgba(15,23,42,0.07)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* Left Column: Context */}
              <div className="space-y-4">
                {/* Platform Pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-700">
                  {currentStepConfig.icon}
                  <span>{currentStepConfig.label}</span>
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-slate-900">
                  {currentStepConfig.title}
                </h2>

                {/* Description */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {currentStepConfig.description}
                </p>

                {/* Bullet Points */}
                <ul className="space-y-1.5 text-[11px] text-slate-500">
                  {currentStepConfig.bullets.map((bullet, idx) => (
                    <li key={idx}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right Column: Input & Actions */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`input-${currentStep}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">
                  {currentStepConfig.label} URL or handle
                </label>

                {/* Input */}
                {currentStepConfig.prefix ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">
                      {currentStepConfig.prefix}
                    </span>
                    <input
                      type="text"
                      placeholder={currentStepConfig.placeholder}
                      value={currentValue}
                      onChange={(e) => {
                        setValues((prev) => ({
                          ...prev,
                          [currentStepConfig.id]: e.target.value,
                        }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && currentValue.trim() && !isSubmitting) {
                          handleSave();
                        }
                      }}
                      className="flex-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500 transition"
                      autoFocus
                    />
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder={currentStepConfig.placeholder}
                    value={currentValue}
                    onChange={(e) => {
                      setValues((prev) => ({
                        ...prev,
                        [currentStepConfig.id]: e.target.value,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && currentValue.trim() && !isSubmitting) {
                        handleSave();
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500 transition"
                    autoFocus
                  />
                )}

                {/* Helper Text */}
                <p className="text-[10px] text-slate-400">
                  {currentStepConfig.helperText}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-2 flex items-center justify-between gap-4">
                <div>
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitting || !currentValue.trim()}
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-2xl bg-[#153E23] text-white text-sm font-medium hover:bg-[#1a4d2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentStep < steps.length - 1 ? (
                      <>
                        Save & continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Continue to analysis
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
