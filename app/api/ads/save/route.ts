import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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

    // Get user's default business
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_business_place_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const body = await request.json();
    const {
      type,
      category,
      preset_key,
      title,
      output_url,
      status,
      businessName,
      tagline,
      phone,
      website,
      address,
    } = body;

    // Validate
    if (!type || !category || !preset_key || !title) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Save to ads table
    const serviceSupabase = createServiceRoleClient();
    const { data: adRecord, error: insertError } = await serviceSupabase
      .from("ads")
      .insert({
        user_id: user.id,
        business_place_id: profile?.default_business_place_id || null,
        type: type as "image" | "video",
        category,
        preset_key,
        title,
        output_url: output_url || null,
        status: (status as "pending" | "generating" | "ready" | "failed") || "generating",
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
      console.error("[ads/save] Insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to save ad" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: adRecord.id,
    });
  } catch (error: any) {
    console.error("[ads/save] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

