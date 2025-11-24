import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { summarizeReviews } from "@/lib/social/summarizeReviews";

export const dynamic = "force-dynamic";

/**
 * POST /api/google/reviews/regenerate-summaries
 * Regenerates AI summaries for the latest Google review snapshot
 * Body: { businessId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[google/reviews/regenerate-summaries] User not authenticated:", authError?.message);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId } = body;

    if (!businessId || typeof businessId !== "string") {
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
      console.error("[google/reviews/regenerate-summaries] Business query error:", businessError);
      return NextResponse.json({ ok: false, error: "Failed to verify business" }, { status: 500 });
    }

    if (!business) {
      return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    if (business.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Fetch the latest snapshot with raw_data
    const { data: snapshot, error: snapshotError } = await serviceSupabase
      .from("google_review_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .single();

    if (snapshotError) {
      console.error("[google/reviews/regenerate-summaries] Error fetching snapshot:", snapshotError);
      return NextResponse.json({ ok: false, error: "No snapshot found" }, { status: 404 });
    }

    if (!snapshot.raw_data) {
      return NextResponse.json({ ok: false, error: "Snapshot has no raw data" }, { status: 400 });
    }

    // Extract reviews from raw_data
    // Reviews might be in different locations in the raw_data structure
    const rawData = snapshot.raw_data;
    let reviews: any[] = [];
    
    // Try multiple paths to find reviews
    if (Array.isArray(rawData.reviews)) {
      reviews = rawData.reviews;
    } else if (rawData.placeData?.reviews && Array.isArray(rawData.placeData.reviews)) {
      reviews = rawData.placeData.reviews;
    } else if (Array.isArray(rawData.items)) {
      // Find the place data item
      const placeData = rawData.items.find((item: any) => item.placeId === businessId) || rawData.items[0];
      if (placeData?.reviews && Array.isArray(placeData.reviews)) {
        reviews = placeData.reviews;
      } else {
        // Filter items that look like reviews
        reviews = rawData.items.filter((item: any) => 
          item.reviewId || 
          (item.stars !== undefined && item.stars !== null) ||
          (item.reviewerId && item.publishedAtDate)
        );
      }
    }

    console.log("[google/reviews/regenerate-summaries] Extracted reviews", {
      reviewsCount: reviews.length,
      rawDataKeys: Object.keys(rawData),
      hasPlaceData: !!rawData.placeData,
      hasItems: Array.isArray(rawData.items),
      itemsCount: Array.isArray(rawData.items) ? rawData.items.length : 0,
    });

    if (reviews.length === 0) {
      return NextResponse.json({ ok: false, error: "No reviews found in snapshot" }, { status: 400 });
    }

    // Get negative reviews (1-2 stars) - up to 40 total
    const negativeReviewsList = reviews
      .filter((r: any) => {
        const stars = r.stars || r.rating || 0;
        return stars >= 1 && stars <= 2;
      })
      .map((r: any) => r.text || r.reviewText || r.textReview || r.description || r.comment || r.review || "")
      .filter((text: string) => text.trim().length > 0)
      .slice(0, 40);

    // Get positive reviews (4-5 stars) - up to 40 total
    const positiveReviewsList = reviews
      .filter((r: any) => {
        const stars = r.stars || r.rating || 0;
        return stars >= 4 && stars <= 5;
      })
      .map((r: any) => r.text || r.reviewText || r.textReview || r.description || r.comment || r.review || "")
      .filter((text: string) => text.trim().length > 0)
      .slice(0, 40);

    let negativeSummary: string | null = null;
    let positiveSummary: string | null = null;

    // Generate summaries
    if (negativeReviewsList.length > 0) {
      try {
        const negativeCount = snapshot.negative_reviews || negativeReviewsList.length;
        negativeSummary = await summarizeReviews(
          negativeReviewsList.map((text: string) => ({ text })),
          "negative",
          negativeCount
        );
      } catch (error: any) {
        console.error("[google/reviews/regenerate-summaries] Error generating negative summary:", error);
      }
    }

    if (positiveReviewsList.length > 0) {
      try {
        const positiveCount = snapshot.positive_reviews || positiveReviewsList.length;
        positiveSummary = await summarizeReviews(
          positiveReviewsList.map((text: string) => ({ text })),
          "positive",
          positiveCount
        );
      } catch (error: any) {
        console.error("[google/reviews/regenerate-summaries] Error generating positive summary:", error);
      }
    }

    // Update the snapshot with summaries
    if (negativeSummary || positiveSummary) {
      // Use business_id and snapshot_ts to identify the row (more reliable than id)
      const { error: updateError } = await serviceSupabase
        .from("google_review_snapshots")
        .update({
          negative_summary: negativeSummary,
          positive_summary: positiveSummary,
        })
        .eq("business_id", businessId)
        .eq("snapshot_ts", snapshot.snapshot_ts);

      if (updateError) {
        console.error("[google/reviews/regenerate-summaries] Error updating summaries:", {
          error: updateError,
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          businessId,
          snapshotTs: snapshot.snapshot_ts,
        });
        
        // Check if the error is about missing columns
        if (updateError.message?.includes("negative_summary") || updateError.message?.includes("schema cache")) {
          return NextResponse.json(
            { 
              ok: false, 
              error: "Database migration required. Please run the migration in Supabase SQL Editor:\n\nALTER TABLE public.google_review_snapshots\n  ADD COLUMN IF NOT EXISTS negative_summary text,\n  ADD COLUMN IF NOT EXISTS positive_summary text;"
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          { ok: false, error: `Failed to update summaries: ${updateError.message}` },
          { status: 500 }
        );
      }

      console.log("[google/reviews/regenerate-summaries] Summaries regenerated successfully", {
        hasNegativeSummary: !!negativeSummary,
        hasPositiveSummary: !!positiveSummary,
      });

      return NextResponse.json({
        ok: true,
        data: {
          negative_summary: negativeSummary,
          positive_summary: positiveSummary,
        },
      });
    } else {
      return NextResponse.json({ ok: false, error: "No summaries could be generated" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[google/reviews/regenerate-summaries] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

