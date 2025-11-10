import { createServiceRoleClient } from "@/lib/supabase/service";
import { analyzeGoogleReviews } from "@/lib/social/analyzeGoogleReviews";
import { analyzeInstagramForPunchline } from "@/lib/social/analyzeInstagramForPunchline";
import { analyzeFacebookForPunchline } from "@/lib/social/analyzeFacebookForPunchline";
import { analyzeTikTokForPunchline } from "@/lib/social/analyzeTikTokForPunchline";

/**
 * Format time ago in a human-readable format
 */
function formatTimeAgo(timestamp: number | string | null): string {
  if (!timestamp) return "recently";
  
  const now = Date.now();
  const then = typeof timestamp === 'number' 
    ? (timestamp < 946684800000 ? timestamp * 1000 : timestamp)
    : new Date(timestamp).getTime();
  
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'}`;
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'}`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'}`;
  return `${diffYears} year${diffYears === 1 ? '' : 's'}`;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export interface RunWatchlistMonitorOptions {
  onlyWatchlistId?: string;
  initialBaseline?: boolean;
}

export interface MonitorResults {
  processed: number;
  alertsCreated: number;
  errors: string[];
}

/**
 * Run watchlist monitoring for active entries
 * 
 * @param options - Configuration options
 * @param options.onlyWatchlistId - If provided, only monitor this specific watchlist entry
 * @param options.initialBaseline - If true, only set baseline fields (no alerts created)
 */
export async function runWatchlistMonitor(
  options: RunWatchlistMonitorOptions = {}
): Promise<MonitorResults> {
  const { onlyWatchlistId, initialBaseline = false } = options;
  console.log("[runWatchlistMonitor] start", { onlyWatchlistId, initialBaseline });
  
  const supabase = createServiceRoleClient();
  
  const results: MonitorResults = {
    processed: 0,
    alertsCreated: 0,
    errors: [],
  };

  try {
    // Build query for watchlist entries
    let query = supabase
      .from("watchlist_competitors")
      .select("id, user_id, competitor_place_id, competitor_name")
      .eq("active", true);

    // Filter to specific watchlist entry if provided
    if (onlyWatchlistId) {
      query = query.eq("id", onlyWatchlistId);
    }

    const { data: watchlistEntries, error: watchlistError } = await query;

    if (watchlistError) {
      console.error("[runWatchlistMonitor] Error fetching watchlist:", watchlistError);
      results.errors.push("Failed to fetch watchlist entries");
      return results;
    }

    if (!watchlistEntries || watchlistEntries.length === 0) {
      console.log("[runWatchlistMonitor] No active watchlist entries to monitor");
      return results;
    }

    // Process each watchlist entry
    for (const entry of watchlistEntries) {
      try {
        results.processed++;

        // Get social profiles for this watchlist entry
        const { data: socialProfiles, error: profilesError } = await supabase
          .from("watchlist_social_profiles")
          .select("*")
          .eq("watchlist_id", entry.id);

        if (profilesError) {
          console.error(`[runWatchlistMonitor] Error fetching profiles for ${entry.id}:`, profilesError);
          results.errors.push(`Failed to fetch profiles for ${entry.competitor_name}`);
          continue;
        }

        if (!socialProfiles || socialProfiles.length === 0) {
          continue; // No profiles to monitor
        }

        // Process each social profile
        for (const profile of socialProfiles) {
          try {
            console.log("[runWatchlistMonitor] processing profile", {
              profileId: profile.id,
              network: profile.network,
              handle_or_url: profile.handle_or_url,
              watchlist_id: entry.id,
              competitor_name: entry.competitor_name,
              currentLastSeenId: profile.last_seen_external_id,
              currentLastCheckedAt: profile.last_checked_at,
            });

            // Verify network is a string and matches expected values
            if (!profile.network || typeof profile.network !== 'string') {
              console.warn("[runWatchlistMonitor] Invalid network value:", profile.network);
              continue;
            }

            if (profile.network === "google") {
              console.log("[runWatchlistMonitor] Processing Google profile", {
                profileId: profile.id,
                watchlist_id: entry.id,
                competitor_name: entry.competitor_name,
                competitor_place_id: entry.competitor_place_id,
                handle_or_url: profile.handle_or_url,
                initialBaseline,
              });
              await monitorGoogleReviews(
                supabase,
                entry,
                profile,
                results,
                initialBaseline
              );
            } else if (profile.network === "instagram") {
              await monitorInstagramPosts(
                supabase,
                entry,
                profile,
                results,
                initialBaseline
              );
            } else if (profile.network === "facebook") {
              await monitorFacebookPosts(
                supabase,
                entry,
                profile,
                results,
                initialBaseline
              );
            } else if (profile.network === "tiktok") {
              await monitorTikTokPosts(
                supabase,
                entry,
                profile,
                results,
                initialBaseline
              );
            } else {
              console.warn(`[runWatchlistMonitor] Unknown network: ${profile.network}`);
            }
          } catch (error: any) {
            console.error(
              `[runWatchlistMonitor] Error processing ${profile.network} for ${entry.competitor_name}:`,
              error
            );
            results.errors.push(
              `Error processing ${profile.network} for ${entry.competitor_name}: ${error.message}`
            );
          }
        }
      } catch (error: any) {
        console.error(
          `[runWatchlistMonitor] Error processing watchlist entry ${entry.id}:`,
          error
        );
        results.errors.push(`Error processing ${entry.competitor_name}: ${error.message}`);
      }
    }

    return results;
  } catch (error: any) {
    console.error("[runWatchlistMonitor] Unexpected error:", error);
    results.errors.push(`Unexpected error: ${error.message}`);
    return results;
  }
}

/**
 * Monitor Google reviews for new or negative reviews
 */
async function monitorGoogleReviews(
  supabase: any,
  entry: any,
  profile: any,
  results: MonitorResults,
  initialBaseline: boolean
) {
  try {
    const lastSeenId = profile.last_seen_external_id;
    const now = new Date().toISOString();

    console.log("[runWatchlistMonitor][google] Starting Google reviews monitoring", {
      profileId: profile.id,
      competitor_place_id: entry.competitor_place_id,
      competitor_name: entry.competitor_name,
      initialBaseline,
      currentLastSeenId: lastSeenId,
      watchlist_id: entry.id,
    });

    // Fetch latest reviews using existing analyzeGoogleReviews function
    // This will also store a snapshot with raw review data
    console.log("[runWatchlistMonitor][google] Calling analyzeGoogleReviews", {
      placeId: entry.competitor_place_id,
      timestamp: new Date().toISOString(),
    });
    
    let reviewSummary = null;
    try {
      reviewSummary = await analyzeGoogleReviews(
        entry.competitor_place_id,
        entry.competitor_place_id
      );
      
      console.log("[runWatchlistMonitor][google] analyzeGoogleReviews completed", {
        placeId: entry.competitor_place_id,
        hasSummary: !!reviewSummary,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[runWatchlistMonitor][google] analyzeGoogleReviews failed:", error);
      // Still update last_checked_at to avoid looping forever
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return; // Don't create alerts on failed scans
    }

    // Get the latest snapshot to access raw review data
    // Wait a moment for the snapshot to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: snapshot, error: snapshotError } = await supabase
      .from("google_review_snapshots")
      .select("raw_data")
      .eq("business_id", entry.competitor_place_id)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      console.error("[runWatchlistMonitor][google] Error fetching snapshot:", {
        error: snapshotError,
        competitor_place_id: entry.competitor_place_id,
        profileId: profile.id,
      });
    }

    // Try multiple paths to find reviews in the snapshot
    let reviews: any[] = [];
    if (snapshot?.raw_data) {
      // First try: raw_data.reviews (direct array)
      if (Array.isArray(snapshot.raw_data.reviews)) {
        reviews = snapshot.raw_data.reviews;
      }
      // Second try: raw_data.placeData.reviews
      else if (snapshot.raw_data.placeData?.reviews && Array.isArray(snapshot.raw_data.placeData.reviews)) {
        reviews = snapshot.raw_data.placeData.reviews;
      }
      // Third try: raw_data.items[0].reviews (if items array exists)
      else if (Array.isArray(snapshot.raw_data.items) && snapshot.raw_data.items.length > 0) {
        const placeData = snapshot.raw_data.items.find((item: any) => item.placeId === entry.competitor_place_id) || snapshot.raw_data.items[0];
        if (placeData?.reviews && Array.isArray(placeData.reviews)) {
          reviews = placeData.reviews;
        }
      }
    }
    
    console.log("[runWatchlistMonitor][google] Fetched reviews", {
      reviewSummary: !!reviewSummary,
      snapshotFound: !!snapshot,
      hasRawData: !!snapshot?.raw_data,
      rawDataKeys: snapshot?.raw_data ? Object.keys(snapshot.raw_data) : [],
      reviewsCount: reviews.length,
      reviewsSource: reviews.length > 0 ? "found" : "none",
      competitor_place_id: entry.competitor_place_id,
      profileId: profile.id,
    });

    // If no review summary and no reviews, still update last_checked_at for baseline
    if (!reviewSummary && reviews.length === 0) {
      const { error: updateError } = await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      
      if (updateError) {
        console.error("[runWatchlistMonitor][google] Failed to update last_checked_at (no reviews):", updateError);
      } else {
        console.log("[runWatchlistMonitor][google] last_checked_at updated (no reviews)", {
          profileId: profile.id,
        });
      }
      return; // Don't create alerts when no reviews found
    }

    // Find the most recent review
    let latestReviewId: string | null = null;
    let mostRecentReview: any = null;
    if (reviews.length > 0) {
      // Sort reviews by published date (most recent first)
      const sortedReviews = [...reviews].sort((a: any, b: any) => {
        const dateA = a.publishedAtDate 
          ? new Date(a.publishedAtDate).getTime() 
          : (a.publishAt ? new Date(a.publishAt).getTime() : 0);
        const dateB = b.publishedAtDate 
          ? new Date(b.publishedAtDate).getTime() 
          : (b.publishAt ? new Date(b.publishAt).getTime() : 0);
        return dateB - dateA;
      });

      mostRecentReview = sortedReviews[0];
      // Try multiple possible ID fields
      latestReviewId = mostRecentReview.reviewId 
        || mostRecentReview.reviewerId 
        || mostRecentReview.id
        || mostRecentReview.review_id
        || (mostRecentReview.authorAttribution?.uri ? mostRecentReview.authorAttribution.uri.split('/').pop() : null)
        || null;
      
      console.log("[runWatchlistMonitor][google] Extracted latest review ID", {
        latestReviewId,
        reviewKeys: mostRecentReview ? Object.keys(mostRecentReview) : [],
        hasReviewId: !!mostRecentReview?.reviewId,
        hasReviewerId: !!mostRecentReview?.reviewerId,
        hasId: !!mostRecentReview?.id,
        hasAuthorAttribution: !!mostRecentReview?.authorAttribution,
      });
    }

    if (initialBaseline) {
      // Baseline: Set last_seen_external_id to the latest review ID if reviews exist
      // Always set last_checked_at to mark that we've scanned
      const baselineId = latestReviewId || null; // Use null if no reviews, not a timestamp
      
      console.log("[runWatchlistMonitor][google] Updating baseline", {
        profileId: profile.id,
        baselineId,
        hasReviews: reviews.length > 0,
        latestReviewId,
      });
      
      const updatePayload: any = {
        last_checked_at: now,
      };
      
      // Only set last_seen_external_id if we have a review ID
      if (baselineId) {
        updatePayload.last_seen_external_id = baselineId;
      }
      
      const { error: updateError, data: updateData } = await supabase
        .from("watchlist_social_profiles")
        .update(updatePayload)
        .eq("id", profile.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("[runWatchlistMonitor][google] Failed to update baseline:", {
          profileId: profile.id,
          network: profile.network,
          error: updateError,
          errorMessage: updateError.message,
          errorCode: updateError.code,
          errorDetails: updateError.details,
        });
        // Still update last_checked_at to avoid looping forever
        await supabase
          .from("watchlist_social_profiles")
          .update({ last_checked_at: now })
          .eq("id", profile.id);
        return; // Don't create alerts on failed scans
      }
      
      if (!updateData) {
        console.error("[runWatchlistMonitor][google] Update returned no rows", {
          profileId: profile.id,
          network: profile.network,
        });
        return;
      }
      
      console.log("[runWatchlistMonitor][google] baseline updated successfully", {
        profileId: profile.id,
        network: "google",
        last_seen_external_id: updateData.last_seen_external_id,
        last_checked_at: updateData.last_checked_at,
        competitor_name: entry.competitor_name,
      });
      
      // Create initial baseline alert if we have a latest review
      console.log("[runWatchlistMonitor][google] Checking if we should create baseline alert", {
        watchlist_id: entry.id,
        hasLatestReviewId: !!latestReviewId,
        reviewsCount: reviews.length,
        latestReviewId,
      });
      
      // Create baseline alert if we have reviews (even without a review ID, we can still create an alert)
      if (reviews.length > 0 && mostRecentReview) {
        const rating = mostRecentReview.stars || mostRecentReview.rating || mostRecentReview.starRating || 0;
        const reviewText = mostRecentReview.text || mostRecentReview.reviewText || mostRecentReview.comment || "";
        const truncatedText = reviewText.length > 100 
          ? reviewText.substring(0, 100) + "..." 
          : reviewText;
        
        // Use review ID if available, otherwise generate a fallback ID based on timestamp
        const alertExternalId = latestReviewId || `review-${mostRecentReview.publishedAtDate || mostRecentReview.publishAt || Date.now()}`;
        
        // Check if baseline alert already exists
        const { data: existingAlerts, error: existingAlertsError } = await supabase
          .from("alerts")
          .select("id, meta")
          .eq("user_id", entry.user_id)
          .eq("watchlist_id", entry.id)
          .eq("type", "competitor_new_review");
        
        if (existingAlertsError) {
          console.error("[runWatchlistMonitor][google] Error checking for existing alerts:", existingAlertsError);
        }
        
        const existingAlert = existingAlerts?.find((a: any) => 
          a.meta?.initialBaseline === true && a.meta?.network === "google"
        );
        
        console.log("[runWatchlistMonitor][google] Checking for existing baseline alert", {
          watchlist_id: entry.id,
          user_id: entry.user_id,
          existingAlertsCount: existingAlerts?.length || 0,
          foundExistingAlert: !!existingAlert,
          existingAlertId: existingAlert?.id,
        });
        
        if (!existingAlert) {
          const reviewDate = mostRecentReview.publishedAtDate 
            ? new Date(mostRecentReview.publishedAtDate).getTime()
            : (mostRecentReview.publishAt ? new Date(mostRecentReview.publishAt).getTime() : Date.now());
          const timeAgo = formatTimeAgo(reviewDate);
          
          const alertPayload = {
            user_id: entry.user_id,
            watchlist_id: entry.id,
            type: "competitor_new_review",
            title: `${entry.competitor_name} posted on Google`,
            message: `${timeAgo} ago | ${rating}★ rating`,
            meta: {
              network: "google",
              competitor_name: entry.competitor_name,
              external_id: alertExternalId,
              rating,
              timeAgo,
              review_text: reviewText,
              review_url: `https://www.google.com/maps/place/?q=place_id:${entry.competitor_place_id}`,
              initialBaseline: true,
            },
          };
          
          console.log("[runWatchlistMonitor][google] Creating baseline alert", {
            watchlist_id: entry.id,
            competitor_name: entry.competitor_name,
            rating,
            timeAgo,
            alertExternalId,
            payload: alertPayload,
          });
          
          const { error: alertError, data: alertData } = await supabase.from("alerts").insert(alertPayload).select();
          
          if (alertError) {
            console.error("[runWatchlistMonitor][google] Failed to create baseline alert:", {
              error: alertError,
              errorMessage: alertError.message,
              errorCode: alertError.code,
              errorDetails: alertError.details,
              watchlist_id: entry.id,
              user_id: entry.user_id,
              payload: alertPayload,
            });
            results.errors.push(`Failed to create Google baseline alert: ${alertError.message}`);
          } else {
            console.log("[runWatchlistMonitor][google] ✅ Initial baseline alert created successfully", {
              watchlist_id: entry.id,
              competitor_name: entry.competitor_name,
              alert_id: alertData?.[0]?.id,
              alert_title: alertData?.[0]?.title,
            });
            results.alertsCreated++;
          }
        } else {
          console.log("[runWatchlistMonitor][google] Baseline alert already exists, skipping", {
            watchlist_id: entry.id,
            existing_alert_id: existingAlert.id,
          });
        }
      } else {
        console.log("[runWatchlistMonitor][google] No reviews found, skipping baseline alert creation", {
          watchlist_id: entry.id,
          latestReviewId,
          reviewsCount: reviews.length,
          hasMostRecentReview: !!mostRecentReview,
        });
      }
      
      return;
    }

    // Regular monitoring: Check for new reviews
    if (!latestReviewId) {
      // No reviews found, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Check if we've already seen this review
    if (lastSeenId && latestReviewId === lastSeenId) {
      // No new reviews - latest review is the same as baseline
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Find new reviews (reviews with IDs different from lastSeenId)
    // We need to find reviews that are newer than the baseline
    const newReviews: any[] = [];
    
    if (lastSeenId && latestReviewId && latestReviewId !== lastSeenId) {
      // We have a baseline and there's a new latest review
      // Find the baseline review to get its date
      const baselineReview = reviews.find((r: any) => {
        const reviewId = r.reviewId || r.reviewerId;
        return reviewId === lastSeenId;
      });
      
      const baselineDate = baselineReview 
        ? (baselineReview.publishedAtDate 
            ? new Date(baselineReview.publishedAtDate).getTime()
            : (baselineReview.publishAt ? new Date(baselineReview.publishAt).getTime() : null))
        : null;

      // Find all reviews newer than the baseline
      for (const review of reviews) {
        const reviewId = review.reviewId || review.reviewerId;
        if (!reviewId) continue;
        
        // Skip the baseline review itself
        if (reviewId === lastSeenId) continue;
        
        // If we have a baseline date, compare by date
        if (baselineDate) {
          const reviewDate = review.publishedAtDate 
            ? new Date(review.publishedAtDate).getTime()
            : (review.publishAt ? new Date(review.publishAt).getTime() : null);
          
          if (reviewDate && reviewDate > baselineDate) {
            newReviews.push(review);
          }
        } else {
          // No baseline date available - if ID is different, treat as new
          // This is less precise but better than missing reviews
          newReviews.push(review);
        }
      }
    } else if (!lastSeenId) {
      // No baseline yet - this shouldn't happen in regular monitoring
      // but if it does, we'll skip creating alerts (baseline should be set first)
      console.warn(`[runWatchlistMonitor] No baseline set for Google reviews: ${entry.competitor_name}`);
      // Still update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Check for new negative reviews (≤3 stars)
    const newNegativeReviews = newReviews.filter((review: any) => {
      const stars = review.stars || review.rating;
      return stars !== undefined && stars <= 3;
    });

    // Create alerts for new negative reviews
    for (const review of newNegativeReviews) {
      const reviewId = review.reviewId || review.reviewerId;
      const reviewText = review.text || review.reviewText || "";
      const rating = review.stars || review.rating || 0;
      const reviewDate = review.publishedAtDate 
        ? new Date(review.publishedAtDate).getTime()
        : (review.publishAt ? new Date(review.publishAt).getTime() : Date.now());
      const timeAgo = formatTimeAgo(reviewDate);

      await supabase.from("alerts").insert({
        user_id: entry.user_id,
        watchlist_id: entry.id,
        type: "competitor_negative_review",
        title: `${entry.competitor_name} posted on Google`,
        message: `${timeAgo} ago | ${rating}★ rating`,
        meta: {
          network: "google",
          competitor_name: entry.competitor_name,
          rating,
          review_text: reviewText,
          review_id: reviewId,
          timeAgo,
          review_url: `https://www.google.com/maps/place/?q=place_id:${entry.competitor_place_id}`,
        },
      });

      results.alertsCreated++;
    }

    // Update last_seen_external_id to the latest review ID (even if no new reviews found)
    // This ensures we track the current state for future scans
    if (latestReviewId) {
      await supabase
        .from("watchlist_social_profiles")
        .update({ 
          last_seen_external_id: latestReviewId,
          last_checked_at: now,
        })
        .eq("id", profile.id);
    } else {
      // No reviews found, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
    }
  } catch (error: any) {
    console.error("[runWatchlistMonitor] Error monitoring Google reviews:", error);
    throw error;
  }
}

/**
 * Monitor Instagram posts for new or trending content
 */
async function monitorInstagramPosts(
  supabase: any,
  entry: any,
  profile: any,
  results: MonitorResults,
  initialBaseline: boolean
) {
  try {
    // Extract handle from URL
    const handleMatch = profile.handle_or_url.match(/instagram\.com\/([^/?]+)/);
    if (!handleMatch) {
      return;
    }

    const handle = handleMatch[1].replace("@", "");

    // Analyze Instagram (this will fetch latest posts)
    let analysis = null;
    try {
      analysis = await analyzeInstagramForPunchline(
        handle,
        entry.competitor_name,
        null
      );
      
      console.log("[runWatchlistMonitor][instagram] Analysis completed", {
        watchlist_id: entry.id,
        hasAnalysis: !!analysis,
        hasProfile: !!analysis?.profile,
        hasLatestPosts: !!(analysis?.profile?.latestPosts),
        latestPostsCount: analysis?.profile?.latestPosts?.length || 0,
        hasLatestReels: !!(analysis?.profile?.latestReels),
        latestReelsCount: analysis?.profile?.latestReels?.length || 0,
      });
    } catch (error: any) {
      console.error("[runWatchlistMonitor][instagram] Analysis failed:", error);
      // Still update last_checked_at to avoid looping forever
      const now = new Date().toISOString();
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return; // Don't create alerts on failed scans
    }

    const lastSeenId = profile.last_seen_external_id;
    const now = new Date().toISOString();

    if (initialBaseline) {
      // Baseline: Set last_seen_external_id to the latest post ID (if available)
      // Instagram analysis returns { metrics, punchline, profile }
      // Posts are in profile.latestPosts, profile.latestReels, profile.latestIgtvVideos
      const allPosts: any[] = [];
      if (analysis?.profile?.latestPosts) {
        allPosts.push(...analysis.profile.latestPosts);
      }
      if (analysis?.profile?.latestReels) {
        allPosts.push(...analysis.profile.latestReels);
      }
      if (analysis?.profile?.latestIgtvVideos) {
        allPosts.push(...analysis.profile.latestIgtvVideos);
      }
      
      // Sort by timestamp (most recent first)
      allPosts.sort((a: any, b: any) => {
        const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tsB - tsA;
      });
      
      const latestPost = allPosts[0];
      const baselineId = latestPost?.shortCode || latestPost?.id || latestPost?.postId || null;
      
      const updatePayload: any = {
        last_checked_at: now,
      };
      
      if (baselineId) {
        updatePayload.last_seen_external_id = baselineId;
      }
      
      const { error: updateError, data: updateData } = await supabase
        .from("watchlist_social_profiles")
        .update(updatePayload)
        .eq("id", profile.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`[runWatchlistMonitor] Error updating baseline for Instagram:`, updateError);
        // Still update last_checked_at to avoid looping forever
        await supabase
          .from("watchlist_social_profiles")
          .update({ last_checked_at: now })
          .eq("id", profile.id);
        return; // Don't create alerts on failed scans
      }
      
      if (!updateData) {
        console.error("[runWatchlistMonitor] Instagram baseline update returned no rows", {
          profileId: profile.id,
        });
        return;
      }
      
      console.log("[runWatchlistMonitor] baseline updated", {
        profileId: profile.id,
        network: "instagram",
        last_seen_external_id: updateData.last_seen_external_id,
        last_checked_at: updateData.last_checked_at,
        competitor_name: entry.competitor_name,
      });
      
      // Create initial baseline alert if we have a latest post
      console.log("[runWatchlistMonitor][instagram] Checking if we should create baseline alert", {
        watchlist_id: entry.id,
        hasLatestPost: !!latestPost,
        hasAnalysis: !!analysis,
        allPostsCount: allPosts.length,
        latestPostId: baselineId,
      });
      
      if (latestPost && allPosts.length > 0) {
        const daysSincePost = latestPost.timestamp 
          ? Math.floor((Date.now() - new Date(latestPost.timestamp).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const likes = latestPost.likesCount || latestPost.likes || 0;
        const comments = latestPost.commentsCount || latestPost.comments || 0;
        
        // Check if baseline alert already exists
        const { data: existingAlerts } = await supabase
          .from("alerts")
          .select("id, meta")
          .eq("user_id", entry.user_id)
          .eq("watchlist_id", entry.id)
          .eq("type", "competitor_new_post");
        
        const existingAlert = existingAlerts?.find((a: any) => 
          a.meta?.initialBaseline === true && a.meta?.network === "instagram"
        );
        
        if (!existingAlert) {
          const postTimestamp = latestPost.timestamp 
            ? (typeof latestPost.timestamp === 'number' 
                ? (latestPost.timestamp < 946684800000 ? latestPost.timestamp * 1000 : latestPost.timestamp)
                : new Date(latestPost.timestamp).getTime())
            : Date.now();
          const timeAgo = formatTimeAgo(postTimestamp);
          const isVideo = latestPost.type === 'video' || latestPost.isVideo || latestPost.isReel || false;
          const contentType = isVideo ? "video" : "photo";
          const formattedLikes = formatNumber(likes);
          
          const { error: alertError, data: alertData } = await supabase.from("alerts").insert({
            user_id: entry.user_id,
            watchlist_id: entry.id,
            type: "competitor_new_post",
            title: `${entry.competitor_name} posted on Instagram`,
            message: `${timeAgo} ago | ${formattedLikes} likes`,
            meta: {
              network: "instagram",
              competitor_name: entry.competitor_name,
              external_id: baselineId,
              likes,
              comments,
              timeAgo,
              url: latestPost.url || `https://www.instagram.com/p/${latestPost.shortCode || ''}`,
              initialBaseline: true,
            },
          }).select();
          
          if (alertError) {
            console.error("[runWatchlistMonitor] Failed to create baseline alert for Instagram:", alertError);
          } else {
            console.log("[runWatchlistMonitor] Initial baseline alert created for Instagram", {
              watchlist_id: entry.id,
              competitor_name: entry.competitor_name,
              alert_id: alertData?.[0]?.id,
            });
          }
        } else {
          console.log("[runWatchlistMonitor] Instagram baseline alert already exists, skipping", {
            watchlist_id: entry.id,
            existing_alert_id: existingAlert.id,
          });
        }
      } else {
        console.log("[runWatchlistMonitor] No posts found for Instagram, skipping baseline alert creation", {
          watchlist_id: entry.id,
          hasLatestPost: !!latestPost,
          hasAnalysis: !!analysis,
          hasProfile: !!analysis?.profile,
          allPostsCount: allPosts.length,
        });
      }
      
      return;
    }

    // Get all posts from profile
    const allPosts: any[] = [];
    if (analysis?.profile?.latestPosts) {
      allPosts.push(...analysis.profile.latestPosts);
    }
    if (analysis?.profile?.latestReels) {
      allPosts.push(...analysis.profile.latestReels);
    }
    if (analysis?.profile?.latestIgtvVideos) {
      allPosts.push(...analysis.profile.latestIgtvVideos);
    }
    
    if (!analysis || allPosts.length === 0) {
      // No posts found, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Sort by timestamp (most recent first)
    allPosts.sort((a: any, b: any) => {
      const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tsB - tsA;
    });

    const latestPost = allPosts[0];

    // Regular monitoring: Check if this is a new post
    const latestPostId = latestPost.shortCode || latestPost.id || latestPost.postId;
    if (lastSeenId && latestPostId === lastSeenId) {
      // No new posts, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Create alert for new post
    const postTimestamp = latestPost.timestamp 
      ? (typeof latestPost.timestamp === 'number' 
          ? (latestPost.timestamp < 946684800000 ? latestPost.timestamp * 1000 : latestPost.timestamp)
          : new Date(latestPost.timestamp).getTime())
      : Date.now();
    const timeAgo = formatTimeAgo(postTimestamp);
    const likes = latestPost.likesCount || latestPost.likes || 0;
    const formattedLikes = formatNumber(likes);
    
    await supabase.from("alerts").insert({
      user_id: entry.user_id,
      watchlist_id: entry.id,
      type: "competitor_new_post",
      title: `${entry.competitor_name} posted on Instagram`,
      message: `${timeAgo} ago | ${formattedLikes} likes`,
      meta: {
        network: "instagram",
        competitor_name: entry.competitor_name,
        post_id: latestPostId,
        likes,
        comments: latestPost.commentsCount || latestPost.comments || 0,
        timeAgo,
        url: latestPost.url || `https://www.instagram.com/p/${latestPost.shortCode || ''}`,
      },
    });

    results.alertsCreated++;

    // Check for trending post (engagement > 2x average)
    if (allPosts.length >= 3) {
      const avgEngagement =
        allPosts.slice(1, 4).reduce((sum, p) => sum + (p.likesCount || p.likes || 0), 0) / 3;
      const latestEngagement = latestPost.likesCount || latestPost.likes || 0;

      if (latestEngagement > avgEngagement * 2) {
        const postTimestamp = latestPost.timestamp 
          ? (typeof latestPost.timestamp === 'number' 
              ? (latestPost.timestamp < 946684800000 ? latestPost.timestamp * 1000 : latestPost.timestamp)
              : new Date(latestPost.timestamp).getTime())
          : Date.now();
        const timeAgo = formatTimeAgo(postTimestamp);
        const formattedLikes = formatNumber(latestEngagement);
        
        await supabase.from("alerts").insert({
          user_id: entry.user_id,
          watchlist_id: entry.id,
          type: "competitor_trending_post",
          title: `${entry.competitor_name} posted on Instagram`,
          message: `${timeAgo} ago | ${formattedLikes} likes`,
          meta: {
            network: "instagram",
            competitor_name: entry.competitor_name,
            post_id: latestPostId,
            likes: latestPost.likesCount || latestPost.likes || 0,
            comments: latestPost.commentsCount || latestPost.comments || 0,
            timeAgo,
            url: latestPost.url || `https://www.instagram.com/p/${latestPost.shortCode || ''}`,
          },
        });

        results.alertsCreated++;
      }
    }

    // Update last_seen_external_id and last_checked_at
    await supabase
      .from("watchlist_social_profiles")
      .update({ 
        last_seen_external_id: latestPostId,
        last_checked_at: now,
      })
      .eq("id", profile.id);
  } catch (error: any) {
    console.error("[runWatchlistMonitor] Error monitoring Instagram:", error);
    throw error;
  }
}

/**
 * Monitor Facebook posts (similar to Instagram)
 */
async function monitorFacebookPosts(
  supabase: any,
  entry: any,
  profile: any,
  results: MonitorResults,
  initialBaseline: boolean
) {
  try {
    // Extract Facebook page URL or handle
    const facebookInput = profile.handle_or_url;
    if (!facebookInput) {
      return;
    }

    const now = new Date().toISOString();
    const lastSeenId = profile.last_seen_external_id;

    // Analyze Facebook (this will fetch latest posts)
    const analysis = await analyzeFacebookForPunchline(
      facebookInput,
      entry.competitor_place_id,
      entry.competitor_name,
      null
    );

    if (initialBaseline) {
      // Baseline: Set last_seen_external_id to the latest post ID (if available)
      const latestPost = analysis?.postsData?.posts?.[0];
      const baselineId = latestPost?.postId || latestPost?.id || null;
      
      const updatePayload: any = {
        last_checked_at: now,
      };
      
      if (baselineId) {
        updatePayload.last_seen_external_id = baselineId;
      }
      
      const { error: updateError, data: updateData } = await supabase
        .from("watchlist_social_profiles")
        .update(updatePayload)
        .eq("id", profile.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`[runWatchlistMonitor] Error updating baseline for Facebook:`, updateError);
        // Still update last_checked_at to avoid looping forever
        await supabase
          .from("watchlist_social_profiles")
          .update({ last_checked_at: now })
          .eq("id", profile.id);
        return; // Don't create alerts on failed scans
      }
      
      if (!updateData) {
        console.error("[runWatchlistMonitor] Facebook baseline update returned no rows", {
          profileId: profile.id,
        });
        return;
      }
      
      console.log("[runWatchlistMonitor] baseline updated", {
        profileId: profile.id,
        network: "facebook",
        last_seen_external_id: updateData.last_seen_external_id,
        last_checked_at: updateData.last_checked_at,
        competitor_name: entry.competitor_name,
      });
      
      // Create initial baseline alert if we have a latest post
      console.log("[runWatchlistMonitor][facebook] Checking if we should create baseline alert", {
        watchlist_id: entry.id,
        hasLatestPost: !!latestPost,
        hasAnalysis: !!analysis,
        hasPostsData: !!analysis?.postsData,
        postsCount: analysis?.postsData?.posts?.length || 0,
        latestPostId: latestPost?.postId || latestPost?.id,
      });
      
      if (latestPost && analysis?.postsData?.posts && analysis.postsData.posts.length > 0) {
        const postTimestamp = latestPost.timestamp || latestPost.time;
        const daysSincePost = postTimestamp
          ? Math.floor((Date.now() - (typeof postTimestamp === 'number' ? (postTimestamp < 946684800000 ? postTimestamp * 1000 : postTimestamp) : new Date(postTimestamp).getTime())) / (1000 * 60 * 60 * 24))
          : null;
        const likes = latestPost.likes || 0;
        const comments = latestPost.comments || 0;
        const shares = latestPost.shares || 0;
        const totalEngagement = likes + comments + shares;
        
        // Check if baseline alert already exists
        const { data: existingAlerts } = await supabase
          .from("alerts")
          .select("id, meta")
          .eq("user_id", entry.user_id)
          .eq("watchlist_id", entry.id)
          .eq("type", "competitor_new_post");
        
        const existingAlert = existingAlerts?.find((a: any) => 
          a.meta?.initialBaseline === true && a.meta?.network === "facebook"
        );
        
        if (!existingAlert) {
          const postTimestamp = latestPost.timestamp || latestPost.time;
          const timestamp = postTimestamp
            ? (typeof postTimestamp === 'number' 
                ? (postTimestamp < 946684800000 ? postTimestamp * 1000 : postTimestamp)
                : new Date(postTimestamp).getTime())
            : Date.now();
          const timeAgo = formatTimeAgo(timestamp);
          const isVideo = latestPost.isVideo || latestPost.type === 'video' || false;
          const contentType = isVideo ? "video" : "photo";
          const formattedLikes = formatNumber(likes);
          
          const { error: alertError, data: alertData } = await supabase.from("alerts").insert({
            user_id: entry.user_id,
            watchlist_id: entry.id,
            type: "competitor_new_post",
            title: `${entry.competitor_name} posted on Facebook`,
            message: `${timeAgo} ago | ${formattedLikes} likes`,
            meta: {
              network: "facebook",
              competitor_name: entry.competitor_name,
              external_id: baselineId,
              likes,
              comments,
              shares,
              timeAgo,
              url: latestPost.url || latestPost.permalink,
              initialBaseline: true,
            },
          }).select();
          
          if (alertError) {
            console.error("[runWatchlistMonitor] Failed to create baseline alert for Facebook:", alertError);
          } else {
            console.log("[runWatchlistMonitor] Initial baseline alert created for Facebook", {
              watchlist_id: entry.id,
              competitor_name: entry.competitor_name,
              alert_id: alertData?.[0]?.id,
            });
          }
        } else {
          console.log("[runWatchlistMonitor] Facebook baseline alert already exists, skipping", {
            watchlist_id: entry.id,
            existing_alert_id: existingAlert.id,
          });
        }
      } else {
        console.log("[runWatchlistMonitor] No posts found for Facebook, skipping baseline alert creation", {
          watchlist_id: entry.id,
          hasLatestPost: !!latestPost,
          hasAnalysis: !!analysis,
          postsCount: analysis?.postsData?.posts?.length || 0,
        });
      }
      
      return;
    }

    if (!analysis || !analysis.postsData || !analysis.postsData.posts || analysis.postsData.posts.length === 0) {
      // No posts found, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    const posts = analysis.postsData.posts;
    if (posts.length === 0) {
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    const latestPost = posts[0];
    const latestPostId = latestPost.postId || latestPost.id;

    // Check if this is a new post
    if (lastSeenId && latestPostId === lastSeenId) {
      // No new posts, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Create alert for new post
    const postTimestamp = latestPost.timestamp || latestPost.time;
    const timestamp = postTimestamp
      ? (typeof postTimestamp === 'number' 
          ? (postTimestamp < 946684800000 ? postTimestamp * 1000 : postTimestamp)
          : new Date(postTimestamp).getTime())
      : Date.now();
    const timeAgo = formatTimeAgo(timestamp);
    const likes = latestPost.likes || latestPost.likeCount || 0;
    const formattedLikes = formatNumber(likes);
    
    await supabase.from("alerts").insert({
      user_id: entry.user_id,
      watchlist_id: entry.id,
      type: "competitor_new_post",
      title: `${entry.competitor_name} posted on Facebook`,
      message: `${timeAgo} ago | ${formattedLikes} likes`,
      meta: {
        network: "facebook",
        competitor_name: entry.competitor_name,
        post_id: latestPostId,
        likes,
        timeAgo,
        url: latestPost.url || latestPost.permalink,
      },
    });

    results.alertsCreated++;

    // Update last_seen_external_id and last_checked_at
    if (latestPostId) {
      await supabase
        .from("watchlist_social_profiles")
        .update({ 
          last_seen_external_id: latestPostId,
          last_checked_at: now,
        })
        .eq("id", profile.id);
    }
  } catch (error: any) {
    console.error("[runWatchlistMonitor] Error monitoring Facebook:", error);
    throw error;
  }
}

/**
 * Monitor TikTok posts (similar to Instagram)
 */
async function monitorTikTokPosts(
  supabase: any,
  entry: any,
  profile: any,
  results: MonitorResults,
  initialBaseline: boolean
) {
  try {
    // Extract handle from URL
    const handleMatch = profile.handle_or_url.match(/tiktok\.com\/@([^/?]+)/);
    if (!handleMatch) {
      return;
    }

    const handle = handleMatch[1].replace("@", "");
    const now = new Date().toISOString();
    const lastSeenId = profile.last_seen_external_id;

    // Analyze TikTok (this will fetch latest videos)
    const analysis = await analyzeTikTokForPunchline(
      handle,
      entry.competitor_name,
      null
    );

    if (initialBaseline) {
      // Baseline: Set last_seen_external_id to the latest video ID (if available)
      const latestVideo = analysis?.rawData?.videos?.[0];
      const baselineId = latestVideo?.id || latestVideo?.videoId || null;
      
      const updatePayload: any = {
        last_checked_at: now,
      };
      
      if (baselineId) {
        updatePayload.last_seen_external_id = baselineId;
      }
      
      const { error: updateError, data: updateData } = await supabase
        .from("watchlist_social_profiles")
        .update(updatePayload)
        .eq("id", profile.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`[runWatchlistMonitor] Error updating baseline for TikTok:`, updateError);
        // Still update last_checked_at to avoid looping forever
        await supabase
          .from("watchlist_social_profiles")
          .update({ last_checked_at: now })
          .eq("id", profile.id);
        return; // Don't create alerts on failed scans
      }
      
      if (!updateData) {
        console.error("[runWatchlistMonitor] TikTok baseline update returned no rows", {
          profileId: profile.id,
        });
        return;
      }
      
      console.log("[runWatchlistMonitor] baseline updated", {
        profileId: profile.id,
        network: "tiktok",
        last_seen_external_id: updateData.last_seen_external_id,
        last_checked_at: updateData.last_checked_at,
        competitor_name: entry.competitor_name,
      });
      
      // Create initial baseline alert if we have a latest video
      console.log("[runWatchlistMonitor][tiktok] Checking if we should create baseline alert", {
        watchlist_id: entry.id,
        hasLatestVideo: !!latestVideo,
        hasAnalysis: !!analysis,
        hasRawData: !!analysis?.rawData,
        videosCount: analysis?.rawData?.videos?.length || 0,
        latestVideoId: latestVideo?.id || latestVideo?.videoId,
      });
      
      if (latestVideo && analysis?.rawData?.videos && analysis.rawData.videos.length > 0) {
        const videoTimestamp = latestVideo.createTime || latestVideo.createTimeISO;
        const daysSinceVideo = videoTimestamp
          ? Math.floor((Date.now() - (typeof videoTimestamp === 'number' ? (videoTimestamp < 946684800000 ? videoTimestamp * 1000 : videoTimestamp) : new Date(videoTimestamp).getTime())) / (1000 * 60 * 60 * 24))
          : null;
        const views = latestVideo.playCount || latestVideo.viewCount || latestVideo.play || 0;
        const likes = latestVideo.diggCount || latestVideo.likeCount || latestVideo.digg || latestVideo.heartCount || 0;
        
        // Check if baseline alert already exists
        const { data: existingAlerts } = await supabase
          .from("alerts")
          .select("id, meta")
          .eq("user_id", entry.user_id)
          .eq("watchlist_id", entry.id)
          .eq("type", "competitor_new_post");
        
        const existingAlert = existingAlerts?.find((a: any) => 
          a.meta?.initialBaseline === true && a.meta?.network === "tiktok"
        );
        
        if (!existingAlert) {
          const videoTimestamp = latestVideo.createTime || latestVideo.createTimeISO;
          const timestamp = videoTimestamp
            ? (typeof videoTimestamp === 'number' 
                ? (videoTimestamp < 946684800000 ? videoTimestamp * 1000 : videoTimestamp)
                : new Date(videoTimestamp).getTime())
            : Date.now();
          const timeAgo = formatTimeAgo(timestamp);
          const formattedLikes = formatNumber(likes);
          
          const { error: alertError, data: alertData } = await supabase.from("alerts").insert({
            user_id: entry.user_id,
            watchlist_id: entry.id,
            type: "competitor_new_post",
            title: `${entry.competitor_name} posted on TikTok`,
            message: `${timeAgo} ago | ${formattedLikes} likes`,
            meta: {
              network: "tiktok",
              competitor_name: entry.competitor_name,
              external_id: baselineId,
              views,
              likes,
              timeAgo,
              url: latestVideo.url || latestVideo.webVideoUrl,
              initialBaseline: true,
            },
          }).select();
          
          if (alertError) {
            console.error("[runWatchlistMonitor] Failed to create baseline alert for TikTok:", alertError);
          } else {
            console.log("[runWatchlistMonitor] Initial baseline alert created for TikTok", {
              watchlist_id: entry.id,
              competitor_name: entry.competitor_name,
              alert_id: alertData?.[0]?.id,
            });
          }
        } else {
          console.log("[runWatchlistMonitor] TikTok baseline alert already exists, skipping", {
            watchlist_id: entry.id,
            existing_alert_id: existingAlert.id,
          });
        }
      } else {
        console.log("[runWatchlistMonitor] No videos found for TikTok, skipping baseline alert creation", {
          watchlist_id: entry.id,
          hasLatestVideo: !!latestVideo,
          hasAnalysis: !!analysis,
          videosCount: analysis?.rawData?.videos?.length || 0,
        });
      }
      
      return;
    }

    if (!analysis || !analysis.rawData || !analysis.rawData.videos || analysis.rawData.videos.length === 0) {
      // No videos found, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    const videos = analysis.rawData.videos;
    if (videos.length === 0) {
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    const latestVideo = videos[0];
    const latestVideoId = latestVideo.id || latestVideo.videoId;

    // Check if this is a new video
    if (lastSeenId && latestVideoId === lastSeenId) {
      // No new videos, just update last_checked_at
      await supabase
        .from("watchlist_social_profiles")
        .update({ last_checked_at: now })
        .eq("id", profile.id);
      return;
    }

    // Create alert for new post
    const videoTimestamp = latestVideo.createTime || latestVideo.createTimeISO;
    const timestamp = videoTimestamp
      ? (typeof videoTimestamp === 'number' 
          ? (videoTimestamp < 946684800000 ? videoTimestamp * 1000 : videoTimestamp)
          : new Date(videoTimestamp).getTime())
      : Date.now();
    const timeAgo = formatTimeAgo(timestamp);
    const likes = latestVideo.likes || latestVideo.likeCount || 0;
    const formattedLikes = formatNumber(likes);
    
    await supabase.from("alerts").insert({
      user_id: entry.user_id,
      watchlist_id: entry.id,
      type: "competitor_new_post",
      title: `${entry.competitor_name} posted on TikTok`,
      message: `${timeAgo} ago | ${formattedLikes} likes`,
      meta: {
        network: "tiktok",
        competitor_name: entry.competitor_name,
        post_id: latestVideoId,
        likes,
        timeAgo,
        url: latestVideo.url || latestVideo.webVideoUrl,
      },
    });

    results.alertsCreated++;

    // Update last_seen_external_id and last_checked_at
    if (latestVideoId) {
      await supabase
        .from("watchlist_social_profiles")
        .update({ 
          last_seen_external_id: latestVideoId,
          last_checked_at: now,
        })
        .eq("id", profile.id);
    }
  } catch (error: any) {
    console.error("[runWatchlistMonitor] Error monitoring TikTok:", error);
    throw error;
  }
}

