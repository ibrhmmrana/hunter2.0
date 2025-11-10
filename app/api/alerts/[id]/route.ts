import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/alerts/:id
 * Mark an alert as read
 * Body: { read: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const alertId = params.id;
    const body = await request.json();
    const { read } = body;

    // Verify alert belongs to user
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .select("id, user_id")
      .eq("id", alertId)
      .maybeSingle();

    if (alertError) {
      console.error("[alerts/:id] Error fetching alert:", alertError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch alert" },
        { status: 500 }
      );
    }

    if (!alert || alert.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Update read_at
    const { error: updateError } = await supabase
      .from("alerts")
      .update({
        read_at: read ? new Date().toISOString() : null,
      })
      .eq("id", alertId);

    if (updateError) {
      console.error("[alerts/:id] Error updating alert:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update alert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[alerts/:id] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

