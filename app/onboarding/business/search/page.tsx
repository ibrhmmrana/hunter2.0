"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  AlertTitle,
} from "@mui/material";
import { BusinessSearchBox } from "@/components/BusinessSearchBox";
import { ConfirmBusinessView } from "@/components/ConfirmBusinessView";
import { NotOnMapsCard } from "@/components/NotOnMapsCard";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import OnboardingShell from "@/src/components/OnboardingShell";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ConfirmBusinessData } from "@/app/api/places/confirm/route";

export default function BusinessSearchPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<ConfirmBusinessData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isPreparingAnalysis, setIsPreparingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if onboarding is already completed
  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-up");
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("user_id", user.id)
          .single();

        if (profile?.onboarding_completed_at !== null) {
          router.push("/dashboard");
          return;
        }
      } catch (err) {
        // Profile might not exist - continue with onboarding
        console.warn("[business/search] Error checking onboarding status:", err);
      }

      setCheckingAuth(false);
    }

    checkOnboarding();
  }, [router]);

  const handlePlaceSelect = useCallback(async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setIsLoadingDetails(true);
    setError(null);
    setConfirmData(null);

    try {
      const response = await fetch(`/api/places/confirm?placeId=${encodeURIComponent(placeId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          if (errorData.error === "NOT_FOUND") {
            setError("NOT_FOUND");
            return;
          }
        }
        throw new Error("Failed to load business details");
      }

      const data = await response.json();
      setConfirmData(data);
    } catch (err: any) {
      console.error("Failed to fetch place details:", err);
      if (err.message === "Place not found" || err.message.includes("NOT_FOUND")) {
        setError("NOT_FOUND");
      } else {
        setError(err.message || "Failed to load business details");
      }
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const handleReject = useCallback(() => {
    setSelectedPlaceId(null);
    setConfirmData(null);
    setError(null);
  }, []);

  if (checkingAuth) {
    return (
      <OnboardingShell>
        <LoadingSpinner message="Checking authentication..." />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell maxWidth="lg">
      <Box sx={{ width: "100%" }}>
        {/* Search Section - Always visible */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
            Find your business
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start typing your business name. We&apos;ll search Google.
          </Typography>
        
          <Box sx={{ maxWidth: 800 }}>
            <BusinessSearchBox onSelect={handlePlaceSelect} />
          </Box>
        </Box>

        {/* Loading State */}
        {isLoadingDetails && (
          <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
            <LoadingSpinner message="Loading business details..." />
          </Box>
        )}

        {/* Error State - Not Found */}
        {error === "NOT_FOUND" && (
          <Box sx={{ mt: 4 }}>
            <NotOnMapsCard onBack={handleReject} />
          </Box>
        )}

        {/* Error State - Other */}
        {error && error !== "NOT_FOUND" && (
          <Box sx={{ mt: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
            <Button onClick={handleReject} variant="outlined" size="small">
              Try again
            </Button>
          </Box>
        )}

        {/* Preview Section - Shows below search when business is selected */}
        {confirmData && selectedPlaceId && !isLoadingDetails && !error && (
          <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
            <ConfirmBusinessView 
              data={confirmData} 
              placeId={selectedPlaceId}
              isPreparing={isPreparingAnalysis}
              onConfirm={async () => {
                  if (!selectedPlaceId || !confirmData) return;
                  
                  setIsPreparingAnalysis(true);
                  
                  try {
                    // Build businessSnapshot from confirmData
                    const businessSnapshot = {
                      place_id: selectedPlaceId,
                      name: confirmData.name || undefined,
                      formatted_address: confirmData.address || undefined,
                      lat: confirmData.location?.lat || undefined,
                      lng: confirmData.location?.lng || undefined,
                      image_url: confirmData.photos?.[0] ? `/api/places/photo?ref=${encodeURIComponent(confirmData.photos[0].ref)}&w=800` : undefined,
                      google_maps_url: confirmData.google_maps_url || undefined,
                      primary_category: confirmData.categories?.[0] || undefined,
                      rating: confirmData.rating || undefined,
                      reviews_count: confirmData.reviews_count || undefined,
                      categories: confirmData.categories || undefined,
                    };

                    // Save to sessionStorage for optimistic rendering
                    try {
                      sessionStorage.setItem('hunter:selectedBusiness', JSON.stringify({
                        place_id: selectedPlaceId,
                        ...businessSnapshot,
                      }));
                    } catch (err) {
                      console.warn('Failed to save to sessionStorage:', err);
                    }

                  // Call kickoff to ensure business is saved with owner_id
                  const kickoffResponse = await fetch('/api/onboard/kickoff', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        businessPlaceId: selectedPlaceId,
                        businessSnapshot,
                      }),
                  });

                  const kickoffData = await kickoffResponse.json();

                  if (!kickoffResponse.ok || !kickoffData.ok) {
                    console.error('[Confirm] Kickoff failed:', kickoffData);
                    setError(kickoffData?.error || 'We couldn\'t start your analysis. Please try again.');
                    setIsPreparingAnalysis(false);
                    return;
                  }

                  // Navigate to connections page with the placeId from response
                  const finalPlaceId = kickoffData.placeId || selectedPlaceId;
                  router.push(`/onboard/connections?place_id=${encodeURIComponent(finalPlaceId)}`);
                } catch (error: any) {
                  console.error('[Confirm] Error preparing analysis:', error);
                  setError(error?.message || 'We couldn\'t start your analysis. Please try again.');
                  setIsPreparingAnalysis(false);
                  }
                }}
                onReject={handleReject}
              />
          </Box>
        )}
      </Box>
    </OnboardingShell>
  );
}
