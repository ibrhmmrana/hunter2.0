import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { openai } from "@/lib/openaiClient";
import { buildImageAdPrompt } from "@/lib/adPrompts";
import { toFile } from "openai/uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute timeout

export async function POST(request: NextRequest) {
  let adId: string | null = null;
  
  try {
    // Auth check
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const businessName = formData.get("businessName") as string;
    const tagline = formData.get("tagline") as string;
    const address = formData.get("address") as string | null;
    const phone = formData.get("phone") as string | null;
    const preset = formData.get("preset") as string;
    adId = formData.get("adId") as string | null;

    // Validate required fields
    if (!image || !(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        { ok: false, error: "No image file uploaded" },
        { status: 400 }
      );
    }

    if (!businessName || !tagline || !preset) {
      return NextResponse.json(
        { ok: false, error: "businessName, tagline, and preset are required" },
        { status: 400 }
      );
    }

    console.log("[ads][generate-image] Starting generation:", {
      preset,
      businessName,
      imageName: image.name,
      imageSize: image.size,
    });

    // Convert image to File format for OpenAI
    const imageFile = await toFile(image, "input.png");

    // Build prompt based on preset
    const prompt = buildImageAdPrompt(preset, {
      businessName,
      tagline,
      address: address || undefined,
      phone: phone || undefined,
    });

    console.log("[ads][generate-image] Prompt length:", prompt.length);

    // Call OpenAI API - single File is fine, no response_format
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile, // Single File (not array)
      prompt,
      size: "1024x1536", // Valid portrait size
    });

    console.log("[ads][generate-image] OpenAI response received");

    // Extract base64 image
    const imageBase64 = response.data?.[0]?.b64_json;
    
    if (!imageBase64) {
      console.error("[ads][generate-image] No b64_json in response", response);
      
      // Update ad status to failed if adId is available
      if (adId) {
        try {
          const serviceSupabase = createServiceRoleClient();
          await serviceSupabase
            .from("ads")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
              meta: {
                error: "No image data returned from OpenAI",
              },
            })
            .eq("id", adId);
          console.log("[ads][generate-image] Ad status updated to failed for adId:", adId);
        } catch (updateErr: any) {
          console.error("[ads][generate-image] Failed to update ad status to failed:", updateErr);
        }
      }
      
      return NextResponse.json(
        { ok: false, error: "No image data returned from OpenAI" },
        { status: 500 }
      );
    }

    console.log("[ads][generate-image] Image generated successfully");

    // If adId is provided, update the ad status directly on the server
    if (adId) {
      try {
        const serviceSupabase = createServiceRoleClient();
        const { error: updateError } = await serviceSupabase
          .from("ads")
          .update({
            status: "ready",
            output_url: `data:image/png;base64,${imageBase64}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", adId);

        if (updateError) {
          console.error("[ads][generate-image] Failed to update ad status:", updateError);
          // Still return the image even if status update fails
        } else {
          console.log("[ads][generate-image] Ad status updated to ready for adId:", adId);
        }
      } catch (updateErr: any) {
        console.error("[ads][generate-image] Error updating ad status:", updateErr);
        // Still return the image even if status update fails
      }
    }

    return NextResponse.json({
      ok: true,
      imageBase64,
    });
  } catch (error: any) {
    console.error("[ads][generate-image] Failed", {
      message: error?.message,
      status: error?.status,
      responseData: error?.response?.data,
      stack: error?.stack,
    });

    // Extract error message from OpenAI response if available
    const errorMessage =
      error?.response?.data?.error?.message ??
      error?.message ??
      "Unexpected error while generating ad image";

    // If adId is available, update the ad status to failed
    if (adId) {
      try {
        const serviceSupabase = createServiceRoleClient();
        await serviceSupabase
          .from("ads")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
            meta: {
              error: errorMessage,
            },
          })
          .eq("id", adId);
        console.log("[ads][generate-image] Ad status updated to failed for adId:", adId);
      } catch (updateErr: any) {
        console.error("[ads][generate-image] Failed to update ad status to failed:", updateErr);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      { status: error?.status || 500 }
    );
  }
}

