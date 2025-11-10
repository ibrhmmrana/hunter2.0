import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/alerts/unread-count
 * Get count of unread alerts for the current user
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

    const { count, error: countError } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (countError) {
      console.error("[alerts/unread-count] Error fetching count:", countError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch unread count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: count || 0,
    });
  } catch (error: any) {
    console.error("[alerts/unread-count] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

