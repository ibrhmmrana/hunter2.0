import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/watchlist/[id]
 * Stop watching a competitor (deletes the row from watchlist_competitors)
 * This will cascade delete related watchlist_social_profiles
 * Historical alerts are preserved (watchlist_id can be null)
 */
export async function DELETE(
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

    const watchlistId = params.id;

    if (!watchlistId) {
      return NextResponse.json(
        { ok: false, error: "watchlist_id is required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify watchlist entry belongs to user
    const { data: watchlistEntry, error: checkError } = await serviceSupabase
      .from("watchlist_competitors")
      .select("id, user_id")
      .eq("id", watchlistId)
      .maybeSingle();

    if (checkError) {
      console.error("[watchlist/:id] Error checking watchlist:", checkError);
      return NextResponse.json(
        { ok: false, error: "Failed to verify watchlist entry" },
        { status: 500 }
      );
    }

    if (!watchlistEntry || watchlistEntry.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Actually delete the row (removes from table completely)
    // Note: This will cascade delete related watchlist_social_profiles due to foreign key
    // Historical alerts will remain as they reference watchlist_id which can be null
    const { error: deleteError } = await serviceSupabase
      .from("watchlist_competitors")
      .delete()
      .eq("id", watchlistId);

    if (deleteError) {
      console.error("[watchlist/:id] Error deleting watchlist:", deleteError);
      console.error("[watchlist/:id] Delete error details:", JSON.stringify(deleteError, null, 2));
      return NextResponse.json(
        { ok: false, error: "Failed to stop watching", details: deleteError.message },
        { status: 500 }
      );
    }

    console.log("[watchlist/:id] Successfully deleted watchlist entry:", watchlistId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[watchlist/:id] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

