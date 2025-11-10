"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AD_CATEGORIES, getPresetByKey, AD_PRESETS } from "@/lib/adPresets";
import { Image as ImageIcon, Video, Loader2, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { MyAdsGallery } from "./MyAdsGallery";

interface BusinessData {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  category?: string;
}

interface AdsPageContentProps {
  initialBusinessData: BusinessData | null;
}

type WizardStep = "category" | "format" | "preset" | "details" | "generating";

export function AdsPageContent({ initialBusinessData }: AdsPageContentProps) {
  const [step, setStep] = useState<WizardStep>("category");
  const [category, setCategory] = useState<string>("");
  const [format, setFormat] = useState<"image" | "video" | null>(null);
  const [presetKey, setPresetKey] = useState<string>("");
  const [businessDetails, setBusinessDetails] = useState<BusinessData>({
    name: initialBusinessData?.name || "",
    address: initialBusinessData?.address || "",
    phone: initialBusinessData?.phone || "",
    website: initialBusinessData?.website || "",
    category: initialBusinessData?.category || "",
  });
  const [tagline, setTagline] = useState<string>("");
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAdId, setGeneratedAdId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<{ refresh: () => void }>(null);

  // Auto-select category if business has one
  useEffect(() => {
    if (initialBusinessData?.category && !category) {
      const categoryMap: Record<string, string> = {
        restaurant: "restaurant",
        food: "restaurant",
        medical: "medical",
        health: "medical",
        automotive: "automotive",
        car: "automotive",
        fitness: "health",
        legal: "legal",
      };
      
      const matchedCategory = Object.entries(categoryMap).find(([key]) =>
        initialBusinessData.category?.toLowerCase().includes(key)
      );
      
      if (matchedCategory) {
        setCategory(matchedCategory[1]);
      }
    }
  }, [initialBusinessData, category]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!presetKey || !businessDetails.name || !tagline) {
      setError("Please fill in all required fields");
      return;
    }

    // For image ads, require an uploaded image
    if (format === "image" && !inputImage) {
      setError("Please upload an image for image ads");
      return;
    }

    setError(null);

    // Create ad entry immediately with "generating" status
    let adId: string | null = null;
    try {
      const saveResponse = await fetch("/api/ads/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: format,
          category,
          preset_key: presetKey,
          title: tagline || `${businessDetails.name} - ${getPresetByKey(presetKey)?.label}`,
          output_url: null, // Will be set after generation
          status: "generating",
          businessName: businessDetails.name,
          tagline,
          phone: businessDetails.phone || "",
          website: businessDetails.website || "",
          address: businessDetails.address || "",
        }),
      });

      const saveResult = await saveResponse.json();
      if (!saveResult.ok) {
        throw new Error(saveResult.error || "Failed to create ad entry");
      }

      adId = saveResult.id;
    } catch (saveError: any) {
      console.error("[AdsPage] Failed to create ad entry", saveError);
      setError(saveError.message || "Failed to create ad entry");
      return;
    }

    // Refresh gallery immediately to show the new "generating" ad
    if (galleryRef.current) {
      galleryRef.current.refresh();
    }

    // Reset wizard immediately so user can create another ad
    resetWizard();

    // Generate image in background (fire-and-forget)
    if (format === "image" && adId) {
      (async () => {
        try {
          const formData = new FormData();
          formData.append("image", inputImage!);
          formData.append("businessName", businessDetails.name);
          formData.append("tagline", tagline);
          formData.append("address", businessDetails.address || "");
          formData.append("phone", businessDetails.phone || "");
          formData.append("preset", presetKey);
          formData.append("adId", adId!); // Pass ad ID to update

          const response = await fetch("/api/ads/generate-image", {
            method: "POST",
            body: formData,
          });

          let result;
          try {
            result = await response.json();
          } catch (parseError) {
            console.error("[AdsPage] Failed to parse response as JSON", parseError);
            // Update ad status to failed
            await fetch("/api/ads/update-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: adId,
                status: "failed",
                error: `Failed to generate ad image (${response.status})`,
              }),
            });
            return;
          }

          if (!response.ok || !result?.ok) {
            const errorMsg = result?.error || "Failed to generate ad image";
            console.error("[AdsPage] generate-image error", errorMsg);
            // Update ad status to failed
            await fetch("/api/ads/update-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: adId,
                status: "failed",
                error: errorMsg,
              }),
            });
            return;
          }

          const imageBase64 = result.imageBase64;
          if (!imageBase64) {
            // Update ad status to failed
            await fetch("/api/ads/update-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: adId,
                status: "failed",
                error: "No image returned from generator",
              }),
            });
            return;
          }

          // Update ad with generated image
          await fetch("/api/ads/update-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: adId,
              status: "ready",
              output_url: `data:image/png;base64,${imageBase64}`,
            }),
          });
        } catch (err: any) {
          console.error("[AdsPage] Background generation error", err);
          // Update ad status to failed
          try {
            await fetch("/api/ads/update-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: adId,
                status: "failed",
                error: err?.message || "Generation failed",
              }),
            });
          } catch (updateError) {
            console.error("[AdsPage] Failed to update ad status", updateError);
          }
        }
      })();
    } else if (format === "video" && adId) {
      // Video generation - still use old endpoint
      (async () => {
        try {
          const formData = new FormData();
          formData.append("type", format!);
          formData.append("category", category);
          formData.append("preset_key", presetKey);
          formData.append("title", tagline || `${businessDetails.name} - ${getPresetByKey(presetKey)?.label}`);
          formData.append("businessName", businessDetails.name);
          formData.append("tagline", tagline);
          formData.append("phone", businessDetails.phone || "");
          formData.append("website", businessDetails.website || "");
          formData.append("address", businessDetails.address || "");
          formData.append("category", businessDetails.category || category);
          
          if (inputImage) {
            formData.append("inputImage", inputImage);
          }

          const response = await fetch("/api/ads/generate", {
            method: "POST",
            body: formData,
          });

          // Video generation will update the ad status via the backend
        } catch (err: any) {
          console.error("[AdsPage] Video generation error", err);
        }
      })();
    }
  };

  const resetWizard = () => {
    setStep("category");
    setCategory("");
    setFormat(null);
    setPresetKey("");
    setTagline("");
    setInputImage(null);
    setInputImagePreview(null);
    setError(null);
    setGeneratedAdId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-8 h-8" />
          My Ads
        </h1>
        <p className="text-muted-foreground">
          Create AI-powered ads for your business
        </p>
      </div>

      {/* Wizard */}
      {step !== "generating" && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Ad</CardTitle>
            <CardDescription>
              Follow the steps to generate your AI-powered advertisement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Category */}
            {step === "category" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">1. Choose Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {AD_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.value}
                      variant={category === cat.value ? "default" : "outline"}
                      onClick={() => {
                        setCategory(cat.value);
                        setStep("format");
                      }}
                      className="h-auto py-4 flex flex-col gap-2"
                    >
                      <span className="font-medium">{cat.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Format */}
            {step === "format" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">2. Choose Format</h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep("category")}>
                    Back
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={format === "image" ? "default" : "outline"}
                    onClick={() => {
                      setFormat("image");
                      setStep("preset");
                    }}
                    className="h-32 flex flex-col gap-3"
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="font-medium">Image Ad</span>
                  </Button>
                  <Button
                    variant={format === "video" ? "default" : "outline"}
                    onClick={() => {
                      setFormat("video");
                      setStep("preset");
                    }}
                    className="h-32 flex flex-col gap-3"
                  >
                    <Video className="w-8 h-8" />
                    <span className="font-medium">Video Ad</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Preset */}
            {step === "preset" && format && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">3. Choose Preset</h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep("format")}>
                    Back
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(AD_PRESETS)
                    .filter(([key, preset]) => {
                      const matchesCategory = 
                        category === "other" ||
                        (category === "restaurant" && key.includes("restaurant")) ||
                        (category === "medical" && key.includes("medical")) ||
                        (category === "automotive" && key.includes("auto")) ||
                        (category === "health" && key.includes("fitness")) ||
                        (category === "legal" && key.includes("legal")) ||
                        (category === "other" && (key.includes("generic") || (!key.includes("restaurant") && !key.includes("medical") && !key.includes("auto") && !key.includes("fitness") && !key.includes("legal"))));
                      return matchesCategory && preset.mediaType === format;
                    })
                    .map(([key, preset]) => (
                      <Card
                        key={key}
                        className={cn(
                          "cursor-pointer transition-all",
                          presetKey === key && "ring-2 ring-primary"
                        )}
                        onClick={() => {
                          setPresetKey(key);
                          setStep("details");
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="text-base">{preset.label}</CardTitle>
                          <CardDescription>{preset.description}</CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Step 4: Details */}
            {step === "details" && presetKey && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">4. Business Details</h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep("preset")}>
                    Back
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={businessDetails.name}
                      onChange={(e) =>
                        setBusinessDetails({ ...businessDetails, name: e.target.value })
                      }
                      placeholder="Your business name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline / Offer Title *</Label>
                    <Input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="e.g., New Dish: Truffle Burger"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={businessDetails.phone || ""}
                      onChange={(e) =>
                        setBusinessDetails({ ...businessDetails, phone: e.target.value })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={businessDetails.website || ""}
                      onChange={(e) =>
                        setBusinessDetails({ ...businessDetails, website: e.target.value })
                      }
                      placeholder="https://example.com"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={businessDetails.address || ""}
                      onChange={(e) =>
                        setBusinessDetails({ ...businessDetails, address: e.target.value })
                      }
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                {format === "image" && (
                  <div className="space-y-2">
                    <Label htmlFor="inputImage">
                      Upload Product/Dish Image {getPresetByKey(presetKey)?.label.includes("Dish") ? "*" : ""}
                    </Label>
                    <Input
                      id="inputImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    {inputImagePreview && (
                      <div className="mt-2">
                        <img
                          src={inputImagePreview}
                          alt="Preview"
                          className="max-w-xs rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                )}

                {format === "video" && (
                  <div className="space-y-2">
                    <Label htmlFor="inputImage">Upload Base Image (Optional)</Label>
                    <Input
                      id="inputImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    {inputImagePreview && (
                      <div className="mt-2">
                        <img
                          src={inputImagePreview}
                          alt="Preview"
                          className="max-w-xs rounded-lg border"
                        />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      If no image is provided, we'll generate one from your prompt
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetWizard}>
                    Start Over
                  </Button>
                  <Button onClick={handleGenerate} disabled={!businessDetails.name || !tagline}>
                    Generate My Ad
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Ads Gallery */}
      <MyAdsGallery ref={galleryRef} />
    </div>
  );
}

