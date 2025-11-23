"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Image as ImageIcon, Video, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getPresetByKey } from "@/lib/adPresets";
import { cn } from "@/lib/utils";

interface Ad {
  id: string;
  type: "image" | "video";
  category: string;
  preset_key: string;
  title: string | null;
  output_url: string | null;
  status: "pending" | "generating" | "ready" | "failed";
  created_at: string;
  meta?: {
    error?: string;
    errorDetails?: any;
  };
}

export const MyAdsGallery = forwardRef<{ refresh: () => void }, {}>((props, ref) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adsRef = useRef<Ad[]>([]);

  const fetchAds = async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const fetchedAds = data || [];
      setAds(fetchedAds);
      adsRef.current = fetchedAds; // Keep ref in sync
    } catch (error) {
      console.error("[MyAdsGallery] Error fetching ads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchAds,
  }));

  useEffect(() => {
    fetchAds();
  }, []);

  // Update ref whenever ads change
  useEffect(() => {
    adsRef.current = ads;
  }, [ads]);

  // Polling effect - only manages starting/stopping based on current ads
  useEffect(() => {
    const hasGenerating = ads.some(ad => ad.status === "generating" || ad.status === "pending");
    
    // If no generating ads, ensure polling is stopped
    if (!hasGenerating) {
      if (pollingIntervalRef.current) {
        console.log("[MyAdsGallery] No generating ads, stopping polling");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // If we already have an interval running, don't create another one
    if (pollingIntervalRef.current) {
      return;
    }

    console.log("[MyAdsGallery] Starting polling for generating ads");
    pollingIntervalRef.current = setInterval(async () => {
      console.log("[MyAdsGallery] Polling for updates...");
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from("ads")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        
        const fetchedAds = data || [];
        const hasGeneratingAfterUpdate = fetchedAds.some(ad => ad.status === "generating" || ad.status === "pending");
        
        // Update ads state (this will trigger the effect, but the guard will prevent creating a new interval)
        setAds(fetchedAds);
        adsRef.current = fetchedAds;
        
        // If no more generating ads, stop polling
        if (!hasGeneratingAfterUpdate && pollingIntervalRef.current) {
          console.log("[MyAdsGallery] All ads completed, stopping polling");
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (error) {
        console.error("[MyAdsGallery] Polling error:", error);
      }
    }, 3000);

    return () => {
      // Only cleanup on unmount or when effect dependencies change significantly
      // Don't clear here since we want polling to continue
    };
  }, [ads]);

  const handleDownload = async (ad: Ad) => {
    if (!ad.output_url) return;

    try {
      const response = await fetch(ad.output_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ad.title || "ad"}.${ad.type === "image" ? "jpg" : "mp4"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("[MyAdsGallery] Download error:", error);
      // Fallback: open in new tab
      window.open(ad.output_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (ads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No ads created yet. Create your first ad above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ads.map((ad) => {
              const preset = getPresetByKey(ad.preset_key);
              const isReady = ad.status === "ready";
              const isGenerating = ad.status === "generating";
              const isFailed = ad.status === "failed";

              return (
                <div key={ad.id} className="group">
                  <div 
                    className="relative aspect-square bg-slate-50 rounded-lg overflow-hidden cursor-pointer border border-slate-200 hover:border-slate-300 transition-colors"
                    onClick={() => {
                      if (isReady && ad.output_url && ad.type === "image") {
                        setEnlargedImage(ad.output_url);
                      }
                    }}
                  >
                    {isReady && ad.output_url ? (
                      ad.type === "image" ? (
                        <img
                          src={ad.output_url}
                          alt={ad.title || "Generated ad"}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      ) : (
                        <video
                          src={ad.output_url}
                          className="w-full h-full object-contain"
                          controls
                        />
                      )
                    ) : isGenerating ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : isFailed ? (
                      <div className="flex items-center justify-center h-full text-red-500">
                        <span className="text-xs">Failed</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <span className="text-xs">Pending</span>
                      </div>
                    )}
                    
                    {isReady && ad.output_url && ad.type === "image" && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <div className="text-xs text-slate-600 bg-white/90 px-2 py-1 rounded">
                          Click to enlarge
                        </div>
                      </div>
                    )}
                  </div>
                  {isReady && ad.output_url && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {ad.title || preset?.label || "Untitled"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(ad);
                        }}
                        className="h-6 px-2"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {isGenerating && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Generating...
                    </p>
                  )}
                  {isFailed && (
                    <div className="mt-2">
                      <p className="text-xs text-red-500 text-center">
                        Failed
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Enlarged Image Dialog */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setEnlargedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-[101] text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedImage(null);
            }}
          >
            <X className="w-5 h-5" />
          </Button>
          <img
            src={enlargedImage}
            alt="Enlarged ad"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onLoad={() => console.log('[MyAdsGallery] Enlarged image loaded:', enlargedImage)}
          />
        </div>
      )}
    </>
  );
});

MyAdsGallery.displayName = "MyAdsGallery";

