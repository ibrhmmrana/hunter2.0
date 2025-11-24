"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  LinearProgress,
  Stack,
  Chip,
  Link as MuiLink,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Instagram,
  Facebook,
  LinkedIn,
  ArrowRight,
  ArrowLeft,
  OpenInNew,
  CheckCircle,
  ErrorOutline,
} from "@mui/icons-material";
import Link from "next/link";
import { useAnalysisStatus } from "@/lib/hooks/useAnalysisStatus";
import OnboardingShell from "@/src/components/OnboardingShell";

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
  icon: React.ReactElement;
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
    icon: <Instagram sx={{ fontSize: 18, color: "primary.main" }} />,
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
      <Box
        component="svg"
        viewBox="0 0 24 24"
        sx={{ width: 18, height: 18, color: "primary.main" }}
        fill="currentColor"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </Box>
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
    icon: <Facebook sx={{ fontSize: 18, color: "primary.main" }} />,
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
    icon: <LinkedIn sx={{ fontSize: 18, color: "primary.main" }} />,
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
  const [isSkipping, setIsSkipping] = useState(false);

  // Poll analysis status
  const analysisStatus = useAnalysisStatus(placeId, 5000);

  // Background preloading
  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        await fetch("/api/onboard/preload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessPlaceId: placeId }),
          keepalive: true,
        });
        
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

      setValues((prev) => ({ ...prev, [step.id]: value }));

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

      // Trigger analysis for social platforms
      if (step.id === "instagram") {
        fetch("/api/social/instagram/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, handle: value }),
          keepalive: true,
        }).catch((err) => {
            console.error("[Connections] Failed to trigger Instagram analysis:", err);
          });
      }

      if (step.id === "tiktok") {
        fetch("/api/social/tiktok/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, handle: value }),
          keepalive: true,
        }).catch((err) => {
            console.error("[Connections] Failed to trigger TikTok analysis:", err);
          });
      }

      if (step.id === "facebook") {
        fetch("/api/social/facebook/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, handle: value }),
          keepalive: true,
        }).catch((err) => {
            console.error("[Connections] Failed to trigger Facebook analysis:", err);
          });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      setIsSubmitting(false);
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push(`/onboard/analytics?place_id=${encodeURIComponent(placeId)}`);
    }
  };

  const handleSkip = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // On LinkedIn step (last step), show loading animation
      setIsSkipping(true);
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500));
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
    <OnboardingShell maxWidth="lg">
      {/* Loading Overlay when skipping on LinkedIn step */}
      {isSkipping && currentStep === steps.length - 1 && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            gap: 3,
          }}
        >
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 3,
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              maxWidth: 400,
              mx: 2,
            }}
          >
            <CircularProgress size={48} sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 500, textAlign: "center" }}>
              Preparing your analysis...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              We're gathering insights about your business and competitors. This will just take a moment.
            </Typography>
          </Box>
        </Box>
      )}
      <Box sx={{ width: "100%" }}>
        {/* Hero Header */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "primary.main",
              fontWeight: 600,
            }}
          >
            Profile setup
          </Typography>
          <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
            <Box>
              <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 500 }}>
                {businessName}
              </Typography>
              {meta && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {meta}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                We're already analysing your market in the background. Connect your profiles so we can go deeper.
              </Typography>
            </Box>
            <Stack spacing={1} alignItems="flex-end">
              {googleMapsUrl && (
                <MuiLink
                  component={Link}
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "primary.main",
                    textDecoration: "none",
                    "&:hover": { color: "primary.dark" },
                  }}
                >
                  View on Maps
                  <OpenInNew sx={{ fontSize: 16 }} />
                </MuiLink>
              )}
              {/* Analysis Status */}
              {analysisStatus.status === "running" && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "10px", color: "text.secondary" }}>
                  <CircularProgress size={12} sx={{ color: "primary.main" }} />
                  <Typography variant="caption">
                    Preparing insights… {analysisStatus.progress}%
                  </Typography>
                </Box>
              )}
              {analysisStatus.status === "complete" && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "10px", color: "primary.main" }}>
                  <CheckCircle sx={{ fontSize: 12 }} />
                  <Typography variant="caption">Insights ready ✓</Typography>
                </Box>
              )}
              {analysisStatus.status === "error" && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "10px", color: "warning.main" }}>
                  <ErrorOutline sx={{ fontSize: 12 }} />
                  <Typography variant="caption">
                    We'll retry in the background. You can still continue.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>

        {/* Progress Indicator */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "11px" }}>
              Step {currentStep + 1} of {steps.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "11px" }}>
              {Math.round(progress)}% complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 999,
              backgroundColor: "surface.variant",
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
                backgroundColor: "primary.main",
              },
            }}
            />
        </Box>

        {/* Step Panel */}
        <Card sx={{ borderRadius: 3, p: { xs: 3, md: 4 } }}>
          <CardContent>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1.8fr" }, gap: 4 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Stack spacing={2}>
                    {/* Platform Chip */}
                    <Chip
                      icon={currentStepConfig.icon}
                      label={currentStepConfig.label}
                      size="small"
                      sx={{
                        width: "fit-content",
                        bgcolor: "surfaceContainerHigh.main",
                        color: "primary.main",
                        fontWeight: 500,
                        fontSize: "11px",
                      }}
                    />

                {/* Title */}
                    <Typography variant="h5" sx={{ fontWeight: 500 }}>
                  {currentStepConfig.title}
                    </Typography>

                {/* Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {currentStepConfig.description}
                    </Typography>

                {/* Bullet Points */}
                    <Box component="ul" sx={{ m: 0, pl: 2, listStyle: "none" }}>
                  {currentStepConfig.bullets.map((bullet, idx) => (
                        <Box
                          key={idx}
                          component="li"
                          sx={{
                            fontSize: "11px",
                            color: "text.secondary",
                            mb: 0.5,
                            "&::before": {
                              content: '"•"',
                              mr: 1,
                            },
                          }}
                        >
                          {bullet}
                        </Box>
                  ))}
                    </Box>
                  </Stack>
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
            >
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" sx={{ fontSize: "12px", fontWeight: 500, mb: 0.5, display: "block" }}>
                  {currentStepConfig.label} URL or handle
                      </Typography>

                {currentStepConfig.prefix ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                      {currentStepConfig.prefix}
                          </Typography>
                          <TextField
                            fullWidth
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
                      autoFocus
                            size="small"
                    />
                        </Box>
                ) : (
                        <TextField
                          fullWidth
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
                    autoFocus
                          size="small"
                  />
                )}

                      <Typography variant="caption" sx={{ fontSize: "10px", color: "text.disabled", mt: 0.5, display: "block" }}>
                  {currentStepConfig.helperText}
                      </Typography>
                    </Box>

              {/* Actions */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                      <Box>
                  {currentStep > 0 && (
                          <Button
                            startIcon={<ArrowLeft />}
                      onClick={handleBack}
                            size="small"
                            sx={{ fontSize: "12px", color: "text.secondary" }}
                          >
                      Back
                          </Button>
                  )}
                      </Box>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Button
                    onClick={handleSkip}
                          disabled={isSkipping}
                          size="small"
                          sx={{ fontSize: "12px", color: "text.secondary" }}
                          startIcon={isSkipping && currentStep === steps.length - 1 ? <CircularProgress size={14} /> : undefined}
                  >
                    {isSkipping && currentStep === steps.length - 1 ? "Loading analysis..." : "Skip for now"}
                        </Button>
                        <Button
                    onClick={handleSave}
                    disabled={isSubmitting || !currentValue.trim()}
                          variant="contained"
                          endIcon={<ArrowRight />}
                          size="medium"
                  >
                          {currentStep < steps.length - 1 ? "Save & continue" : "Continue to analysis"}
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
            </motion.div>
          </AnimatePresence>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </OnboardingShell>
  );
}
