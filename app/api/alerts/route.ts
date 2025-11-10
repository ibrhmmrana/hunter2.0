import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/alerts
 * Fetch all alerts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch alerts for the user
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (alertsError) {
      console.error("[alerts] Error fetching alerts:", alertsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch alerts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      alerts: alerts || [],
    });
  } catch (error: any) {
    console.error("[alerts] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

