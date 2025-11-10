import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body = await request.json();
    const { placeId, platform, value }: { placeId?: string; platform?: string; value?: string } = body;

    if (!placeId || typeof placeId !== "string" || placeId.trim() === "") {
      return NextResponse.json({ ok: false, error: "placeId is required" }, { status: 400 });
    }

    if (!platform || typeof platform !== "string") {
      return NextResponse.json({ ok: false, error: "platform is required" }, { status: 400 });
    }

    if (!value || typeof value !== "string" || value.trim() === "") {
      return NextResponse.json({ ok: false, error: "value is required" }, { status: 400 });
    }

    const validPlatforms = ["website", "instagram", "tiktok", "facebook", "linkedin"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ ok: false, error: "Invalid platform" }, { status: 400 });
    }

    // 3. Log for now (stub implementation)
    console.log(`[Social Sync] User ${user.id} syncing ${platform} for place ${placeId}: ${value}`);

    // TODO: Later implementation:
    // - Upsert into business_social_accounts table
    // - Trigger platform-specific crawlers
    // - Validate URLs/handles

    return NextResponse.json({ ok: true, message: "Social account synced" });
  } catch (error: any) {
    console.error("Social sync error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}

