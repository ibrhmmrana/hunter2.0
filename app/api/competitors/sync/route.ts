import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { syncCompetitorsForBusiness } from '@/lib/competitors/syncCompetitorsForBusiness';

export const dynamic = 'force-dynamic';

/**
 * POST /api/competitors/sync
 * 
 * Triggers competitor sync for a business.
 * 
 * Body: { businessPlaceId: string }
 * 
 * Requires authentication. Will claim orphaned businesses to the current user.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { businessPlaceId } = body;

    console.log('[competitors] api request', { 
      businessPlaceId, 
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : []
    });

    if (!businessPlaceId || typeof businessPlaceId !== 'string') {
      console.error('[competitors] api invalid request', { businessPlaceId, body });
      return NextResponse.json(
        { ok: false, error: 'businessPlaceId is required and must be a string' },
        { status: 400 }
      );
    }

    // Use service client for business lookup (bypasses RLS)
    const serviceClient = createServiceRoleClient();

    // Primary lookup: strict, owner-bound
    let { data: business, error: businessError } = await serviceClient
      .from('businesses')
      .select('place_id, owner_id, name, lat, lng')
      .eq('place_id', businessPlaceId)
      .eq('owner_id', user.id)
      .maybeSingle();

    let lookupMethod = 'strict';
    let wasClaimed = false;

    if (businessError) {
      console.error('Error in strict business lookup:', businessError);
      return NextResponse.json(
        { ok: false, error: 'Failed to verify business ownership' },
        { status: 500 }
      );
    }

    // Fallback lookup: find any business with this place_id (orphan or wrong owner)
    if (!business) {
      lookupMethod = 'fallback';
      const { data: orphanBusiness, error: orphanError } = await serviceClient
        .from('businesses')
        .select('place_id, owner_id, name, lat, lng')
        .eq('place_id', businessPlaceId)
        .limit(1)
        .maybeSingle();

      if (orphanError) {
        console.error('Error in fallback business lookup:', orphanError);
        return NextResponse.json(
          { ok: false, error: 'Failed to lookup business' },
          { status: 500 }
        );
      }

      if (orphanBusiness) {
        // Claim the business if owner_id is null or different
        if (!orphanBusiness.owner_id || orphanBusiness.owner_id !== user.id) {
          const { data: claimedBusiness, error: claimError } = await serviceClient
            .from('businesses')
            .update({
              owner_id: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('place_id', businessPlaceId)
            .select('place_id, owner_id, name, lat, lng')
            .single();

          if (claimError) {
            console.error('Error claiming business:', claimError);
            return NextResponse.json(
              { ok: false, error: 'Failed to claim business' },
              { status: 500 }
            );
          }

          business = claimedBusiness;
          wasClaimed = true;
          lookupMethod = 'claimed';
        } else {
          business = orphanBusiness;
        }
      }
    }

    // Log lookup result for debugging
    console.log('Competitor sync lookup:', {
      businessPlaceId,
      lookupMethod,
      wasClaimed,
      found: !!business,
    });

    // If still no business found, return 404
    if (!business) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Business not found in our database. Run the analysis flow first.',
        },
        { status: 404 }
      );
    }

    // Trigger sync (this runs server-side with service role client)
    try {
    await syncCompetitorsForBusiness(businessPlaceId);
    } catch (syncError: any) {
      console.error('Error syncing competitors:', syncError);
      
      // Don't pass raw error messages to client - use friendly message
      const errorMessage = syncError?.message || '';
      const isGoogleError = errorMessage.includes('Google') || errorMessage.includes('Places');
      
      return NextResponse.json(
        {
          ok: false,
          error: isGoogleError 
            ? 'We could not load competitor data right now. Please try again in a moment.'
            : 'We could not load competitor data right now. Please try again in a moment.',
        },
        { status: 500 }
      );
    }

    // After successful sync, fetch the competitors that were just written
    const { data: competitors, error: competitorsError } = await serviceClient
      .from('business_competitors')
      .select('competitor_place_id, name, rating_avg, reviews_total, distance_m, is_stronger, raw, snapshot_ts')
      .eq('business_place_id', businessPlaceId)
      .order('is_stronger', { ascending: false })
      .order('reviews_total', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(6);

    if (competitorsError) {
      console.error('Error fetching competitors after sync:', competitorsError);
      return NextResponse.json(
        {
          ok: false,
          message: 'Sync completed but failed to retrieve results',
        },
        { status: 500 }
      );
    }

    // Log when 0 competitors are truly found (for debugging)
    if (!competitors || competitors.length === 0) {
      console.log(`[Competitor Sync] No competitors found for ${businessPlaceId} after sync - likely no matching businesses in 6km radius`);
    }

    return NextResponse.json({
      ok: true,
      competitors: competitors || [],
      message: competitors && competitors.length > 0 
        ? `Found ${competitors.length} competitors` 
        : 'No competitors found matching criteria',
    });
  } catch (error: any) {
    console.error('[competitors] sync error', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'We could not load competitor data right now. Please try again in a moment.'
      },
      { status: 500 }
    );
  }
}

