import { NextRequest, NextResponse } from "next/server";
import { runWatchlistMonitor } from "@/lib/watchlist/runWatchlistMonitor";

export const dynamic = "force-dynamic";

/**
 * POST /api/watchlist/monitor
 * Daily monitoring job for watchlisted competitors
 * Protected by CRON_SECRET environment variable
 * 
 * This job:
 * 1. Iterates all active watchlist entries
 * 2. Checks Google reviews for new/negative reviews
 * 3. Checks social media posts for new/trending content
 * 4. Creates alerts for significant events
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error("[watchlist/monitor] CRON_SECRET not configured");
      return NextResponse.json(
        { ok: false, error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Run monitoring for all active entries (not baseline)
    const results = await runWatchlistMonitor({ initialBaseline: false });

    return NextResponse.json({
      ok: true,
      message: "Monitoring job completed",
      results,
    });
  } catch (error: any) {
    console.error("[watchlist/monitor] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

