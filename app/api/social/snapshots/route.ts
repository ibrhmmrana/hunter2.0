import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/social/snapshots
 * Returns the latest social media snapshots for a business
 * Query params: businessId, network (optional)
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[social/snapshots] GET request received");
    
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[social/snapshots] Auth error:", authError);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      console.log("[social/snapshots] No user found");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get("businessId");
    const network = searchParams.get("network");

    console.log("[social/snapshots] Request params", { businessId, network, userId: user.id });

    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    // Verify business ownership
    const { data: business, error: businessError } = await serviceSupabase
      .from("businesses")
      .select("place_id, owner_id")
      .eq("place_id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[social/snapshots] Business query error:", businessError);
      return NextResponse.json({ ok: false, error: "Failed to verify business" }, { status: 500 });
    }

    if (!business) {
      console.log("[social/snapshots] Business not found", { businessId });
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      console.log("[social/snapshots] Unauthorized access attempt", {
        businessId,
        businessOwnerId: business.owner_id,
        userId: user.id,
      });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    console.log("[social/snapshots] Business ownership verified", { businessId });

    // Build query
    let query = serviceSupabase
      .from("social_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("snapshot_ts", { ascending: false });

    if (network) {
      const normalizedNetwork = network.toLowerCase();
      console.log("[social/snapshots] Filtering by network", { network, normalizedNetwork });
      query = query.eq("network", normalizedNetwork);
    }

    const { data: snapshots, error: queryError } = await query.limit(network ? 1 : 10);

    if (queryError) {
      console.error("[social/snapshots] Query error:", {
        error: queryError.message,
        code: queryError.code,
        details: queryError.details,
        hint: queryError.hint,
        businessId,
        network,
      });
      return NextResponse.json({ 
        ok: false, 
        error: "Failed to fetch snapshots",
        details: queryError.message,
      }, { status: 500 });
    }

    const result = network ? (snapshots && snapshots.length > 0 ? snapshots[0] : null) : snapshots;
    
    console.log("[social/snapshots] Query result", {
      businessId,
      network,
      found: !!result,
      snapshotCount: Array.isArray(snapshots) ? snapshots.length : (snapshots ? 1 : 0),
      hasData: !!result,
      resultKeys: result ? Object.keys(result) : null,
      daysSinceLastPost: result ? (result as any).days_since_last_post : null,
      postsLast30d: result ? (result as any).posts_last_30d : null,
      followers: result ? (result as any).followers : null,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[social/snapshots] Unexpected error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

