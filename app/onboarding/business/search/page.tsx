"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusinessSearchBox } from "@/components/BusinessSearchBox";
import { ConfirmBusinessView } from "@/components/ConfirmBusinessView";
import { NotOnMapsCard } from "@/components/NotOnMapsCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
    // Focus will be handled by BusinessSearchBox
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-950 mb-2">
            Find your business
          </h1>
          <p className="text-sm md:text-[15px] text-slate-600 mb-6">
                    Start typing your business name. We&apos;ll search Google.
                  </p>
          
          <div className="max-w-2xl">
            <BusinessSearchBox onSelect={handlePlaceSelect} />
          </div>
                </div>

                {/* Loading State */}
                {isLoadingDetails && (
          <div className="mt-8 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            <span className="ml-3 text-sm text-slate-600">
                      Loading business details...
                    </span>
                  </div>
                )}

                {/* Error State - Not Found */}
                {error === "NOT_FOUND" && (
          <div className="mt-8">
                  <NotOnMapsCard onBack={handleReject} />
          </div>
                )}

                {/* Error State - Other */}
                {error && error !== "NOT_FOUND" && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 max-w-2xl">
                    <p className="text-sm text-red-700">{error}</p>
                    <Button
                      onClick={handleReject}
                      variant="outline"
                      className="mt-4"
                      size="sm"
                    >
                      Try again
                    </Button>
                  </div>
                )}

        {/* Confirmation Section - Inline Below Search */}
      {confirmData && selectedPlaceId && !isLoadingDetails && !error && (
          <div className="mt-8">
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
                    // Show error but don't redirect - let user retry
                    setError(kickoffData?.error || 'We couldn\'t start your analysis. Please try again.');
                    setIsPreparingAnalysis(false);
                    return;
                  }

                  // Navigate to connections page with the placeId from response
                  const finalPlaceId = kickoffData.placeId || selectedPlaceId;
                  router.push(`/onboard/connections?place_id=${encodeURIComponent(finalPlaceId)}`);
                } catch (error: any) {
                  console.error('[Confirm] Error preparing analysis:', error);
                  // Show error but don't redirect
                  setError(error?.message || 'We couldn\'t start your analysis. Please try again.');
                  setIsPreparingAnalysis(false);
                  }
                }}
                onReject={handleReject}
              />
            </div>
        )}
          </div>
        </div>
  );
}

