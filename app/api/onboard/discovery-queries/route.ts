import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getDiscoveryQueriesForBusiness } from '@/lib/ai/discoveryQueries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboard/discovery-queries
 * 
 * Preload discovery queries for a business.
 * Idempotent: can be called multiple times safely.
 * 
 * Body: { businessPlaceId: string }
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
        { error: 'businessPlaceId is required and must be a string' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Fetch business data
    const { data: business, error: businessError } = await serviceClient
      .from('businesses')
      .select('place_id, name, categories, address')
      .eq('place_id', businessPlaceId)
      .maybeSingle();

    if (businessError) {
      console.error('[discovery-queries] Error fetching business:', businessError);
      return NextResponse.json(
        { error: 'Failed to fetch business' },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get primary category
    const primaryCategory = Array.isArray(business.categories) && business.categories.length > 0
      ? business.categories[0]?.replace(/_/g, ' ')
      : null;

    // Generate discovery queries
    const queries = await getDiscoveryQueriesForBusiness({
      name: business.name,
      category: primaryCategory,
      address: business.address || null,
    });

    // For now, just return the queries
    // In the future, we could cache them in a table for faster retrieval
    return NextResponse.json({
      ok: true,
      queries: queries.slice(0, 6),
    });
  } catch (error: any) {
    console.error('[discovery-queries] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

