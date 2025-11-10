import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAnalysisRunStatus } from "@/lib/onboard/analysisRuns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get placeId from query params
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId") || searchParams.get("place_id");

    if (!placeId || typeof placeId !== "string" || placeId.trim() === "") {
      return NextResponse.json({ ok: false, error: "placeId is required" }, { status: 400 });
    }

    // 3. Get analysis run status
    const status = await getAnalysisRunStatus(supabase, user.id, placeId.trim());

    return NextResponse.json({
      ok: true,
      status: status.status,
      progress: status.progress,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      errorMessage: status.errorMessage,
    });
  } catch (error: any) {
    console.error("[Status] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

