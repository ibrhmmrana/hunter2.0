import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getDiscoveryQueriesForBusiness } from '@/lib/ai/discoveryQueries';
import { getPlaceDetails } from '@/lib/google/places';
import { placePhotoUrl } from '@/lib/google/photos';
import { explainWhyOutranking } from '@/lib/ai/compareCompetitors';
import { fetchRow1 } from '@/lib/analytics/row1';

export const dynamic = 'force-dynamic';

const CACHE_DAYS = 7;

/**
 * POST /api/competitors/explain
 * 
 * Generate or fetch competitor insights with AI/heuristic reasons.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { businessPlaceId } = body;

    if (!businessPlaceId || typeof businessPlaceId !== 'string') {
      return NextResponse.json(
        { error: 'businessPlaceId is required' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Verify ownership
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('place_id, owner_id, name, city, categories, lat, lng, address')
      .eq('place_id', businessPlaceId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!business && !businessError) {
      const { data: fallbackBusiness } = await serviceClient
        .from('businesses')
        .select('place_id, owner_id, name, city, categories, lat, lng, address')
        .eq('place_id', businessPlaceId)
        .limit(1)
        .maybeSingle();

      if (fallbackBusiness) {
        business = fallbackBusiness;
      }
    }

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Fetch latest snapshot for user business
    const { row: kpiRow } = await fetchRow1(supabase, businessPlaceId);

    // Fetch top competitors
    const { data: competitors } = await serviceClient
      .from('business_competitors')
      .select('competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw')
      .eq('business_place_id', businessPlaceId)
      .order('is_stronger', { ascending: false })
      .order('distance_m', { ascending: true })
      .order('reviews_total', { ascending: false })
      .limit(6);

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({
        competitors: [],
        phrases: [],
      });
    }

    // Get discovery phrases
    const primaryCategory = Array.isArray(business.categories) && business.categories.length > 0
      ? business.categories[0]?.replace(/_/g, ' ')
      : null;

    const phrases = await getDiscoveryQueriesForBusiness({
      name: business.name,
      category: primaryCategory,
      address: business.address || null,
    });

    // Check for cached insights
    const { data: cachedInsights } = await serviceClient
      .from('competitor_insights')
      .select('competitor_place_id, insights, generated_at')
      .eq('business_place_id', businessPlaceId)
      .in('competitor_place_id', competitors.map(c => c.competitor_place_id));

    const insightsMap = new Map<string, any>();
    const now = new Date();
    const cacheCutoff = new Date(now.getTime() - CACHE_DAYS * 24 * 60 * 60 * 1000);

    if (cachedInsights) {
      for (const insight of cachedInsights) {
        const generatedAt = new Date(insight.generated_at);
        if (generatedAt > cacheCutoff) {
          insightsMap.set(insight.competitor_place_id, insight.insights);
        }
      }
    }

    // Process competitors
    const result = await Promise.all(
      competitors.map(async (comp) => {
        let bullets: string[] = [];
        let reasons_short: string[] = [];
        let source: 'ai' | 'heuristic' = 'heuristic';

        // Check for stored reasons_short in raw field first (from sync)
        if (comp.raw && Array.isArray(comp.raw.reasons_short)) {
          reasons_short = comp.raw.reasons_short;
          source = 'heuristic';
        }

        // Check cache for AI insights
        const cached = insightsMap.get(comp.competitor_place_id);
        if (cached && cached.bullets && Array.isArray(cached.bullets)) {
          bullets = cached.bullets;
          // Only use cached reasons_short if we don't have stored ones
          if (reasons_short.length === 0) {
          reasons_short = cached.reasons_short || [];
          }
          source = cached.source || 'heuristic';
        } else if (reasons_short.length === 0) {
          // Only generate AI insights if we don't have stored reasons
          // Fetch place details for fresh data
          const details = await getPlaceDetails(comp.competitor_place_id);

          // Build user summary
          const userSummary = {
            name: business.name,
            rating_avg: kpiRow?.rating_avg || null,
            reviews_total: kpiRow?.reviews_total || null,
            has_gbp: kpiRow?.has_gbp ?? true,
            photos_count: undefined, // TODO: get from snapshot if available
            listing_completeness: undefined,
            owner_posts_recency_days: undefined,
          };

          // Build competitor summary
          const compSummary = {
            name: comp.name,
            rating_avg: details?.rating || comp.rating_avg || null,
            reviews_total: details?.user_ratings_total || comp.reviews_total || null,
            distance_m: comp.distance_m,
            photo_reference: details?.photo_reference || comp.raw?.photo_reference,
            open_now: details?.current_opening_hours?.open_now || details?.opening_hours?.open_now,
          };

          // Generate insights
          const comparison = await explainWhyOutranking(
            userSummary,
            compSummary,
            phrases,
            kpiRow?.reviews_last_30 || null
          );
          bullets = comparison.bullets;
          // Use AI reasons_short only if we don't have stored ones
          if (reasons_short.length === 0) {
          reasons_short = comparison.reasons_short;
          }
          source = comparison.source;

          // Cache the insights
          await serviceClient
            .from('competitor_insights')
            .upsert({
              business_place_id: businessPlaceId,
              competitor_place_id: comp.competitor_place_id,
              insights: {
                bullets,
                reasons_short: reasons_short.length > 0 ? reasons_short : comparison.reasons_short,
                model: source === 'ai' ? 'gpt-4o-mini' : 'heuristic',
                version: 'v1',
                source,
              },
              generated_at: new Date().toISOString(),
            });
        }

        // Build photo URL
        let photoUrl = '';
        const photoRef = comp.raw?.photo_reference;
        if (photoRef) {
          photoUrl = placePhotoUrl(photoRef, { maxWidth: 800 });
        }

        return {
          competitor_place_id: comp.competitor_place_id,
          name: comp.name,
          distance_m: comp.distance_m,
          rating_avg: comp.rating_avg,
          reviews_total: comp.reviews_total,
          photo_url: photoUrl,
          bullets,
          reasons_short,
          source,
        };
      })
    );

    return NextResponse.json({
      competitors: result,
      phrases: phrases.slice(0, 4),
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

