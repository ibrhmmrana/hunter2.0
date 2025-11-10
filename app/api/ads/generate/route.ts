import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for video generation

export async function POST(request: NextRequest) {
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
    const type = formData.get("type") as string;
    const category = formData.get("category") as string;
    const presetKey = formData.get("preset_key") as string;
    const title = formData.get("title") as string;
    const businessName = formData.get("businessName") as string;
    const tagline = formData.get("tagline") as string;
    const phone = formData.get("phone") as string | null;
    const website = formData.get("website") as string | null;
    const address = formData.get("address") as string | null;
    const inputImage = formData.get("inputImage") as File | null;

    // Validate
    if (!type || !category || !presetKey || !title || !businessName) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Image ads should use the new /api/ads/generate-image endpoint
    if (type === "image") {
      return NextResponse.json(
        { ok: false, error: "Image generation has moved to /api/ads/generate-image. Please use that endpoint." },
        { status: 400 }
      );
    }

    // Only handle video generation here
    if (type !== "video") {
      return NextResponse.json(
        { ok: false, error: "Invalid type. This endpoint only handles video generation." },
        { status: 400 }
      );
    }

    // Get user's default business
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_business_place_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Create ad record with status 'generating'
    const serviceSupabase = createServiceRoleClient();
    const { data: adRecord, error: insertError } = await serviceSupabase
      .from("ads")
      .insert({
        user_id: user.id,
        business_place_id: profile?.default_business_place_id || null,
        type: "video",
        category,
        preset_key: presetKey,
        title,
        status: "generating",
        meta: {
          businessName,
          tagline,
          phone,
          website,
          address,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[ads/generate] Insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to create ad record" },
        { status: 500 }
      );
    }

    // Handle video generation (Gemini Veo) - TODO: implement
    // Placeholder for video generation
    return NextResponse.json(
      { ok: false, error: "Video generation not yet implemented" },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("[ads/generate] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
