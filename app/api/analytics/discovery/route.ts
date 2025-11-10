import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getDiscoveryQueriesForBusiness } from '@/lib/ai/discoveryQueries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/discovery
 * 
 * Generate discovery queries from business data (fallback when business not in DB).
 * 
 * Body: { placeId: string, businessData: { name, category, address } }
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
    const { placeId, businessData } = body;
    
    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }
    
    // If businessData is provided, generate queries directly without DB lookup
    if (businessData) {
      try {
        const queries = await getDiscoveryQueriesForBusiness({
          name: businessData.name || null,
          category: businessData.category || null,
          primary_category: businessData.primary_category || null,
          address: businessData.address || null,
        });
        
        return NextResponse.json({
          queries: queries.slice(0, 5),
        });
      } catch (error: any) {
        console.error('[discovery] Error generating queries from OpenAI (POST):', error);
        return NextResponse.json(
          { error: error.message || 'Failed to generate discovery queries from OpenAI' },
          { status: 500 }
        );
      }
    }
    
    // Otherwise, try to fetch from DB
    return await handleDiscoveryRequest(placeId, user.id, supabase);
  } catch (error: any) {
    console.error('[discovery] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/discovery
 * 
 * Get discovery queries for a business.
 * 
 * Query params: placeId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const placeId = searchParams.get('placeId');
    
    console.log('[discovery] GET request received', { placeId, userId: user.id });

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }

    return await handleDiscoveryRequest(placeId, user.id, supabase);
  } catch (error: any) {
    console.error('[discovery] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDiscoveryRequest(
  placeId: string,
  userId: string,
  supabase: ReturnType<typeof createServerSupabaseClient>
) {
  try {
    // Fetch business data (try strict first, then fallback with service client)
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('place_id, owner_id, name, city, categories, address, primary_category, category')
      .eq('place_id', placeId)
      .eq('owner_id', userId)
      .maybeSingle();

    console.log('[discovery] Initial query result', { 
      found: !!business, 
      error: businessError?.message,
      placeId,
      userId 
    });

    // Fallback: use service client to bypass RLS (for orphaned businesses or RLS issues)
    if (!business && !businessError) {
      console.log('[discovery] Trying service client fallback');
      const serviceClient = createServiceRoleClient();
      const { data: fallbackBusiness, error: fallbackError } = await serviceClient
        .from('businesses')
        .select('place_id, owner_id, name, city, categories, address, primary_category, category')
        .eq('place_id', placeId)
        .limit(1)
        .maybeSingle();
      
      console.log('[discovery] Service client fallback result', { 
        found: !!fallbackBusiness, 
        error: fallbackError?.message 
      });
      
      if (fallbackError) {
        console.error('[discovery] Fallback business fetch error:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to fetch business' },
          { status: 500 }
        );
      }
      
      if (fallbackBusiness) {
        business = fallbackBusiness;
        console.log('[discovery] Found business via service client', { 
          name: business.name,
          ownerId: business.owner_id 
        });
      }
    }

    if (businessError) {
      console.error('[discovery] Error fetching business:', businessError);
      // Try service client fallback even if there was an error
      const serviceClient = createServiceRoleClient();
      const { data: fallbackBusiness, error: fallbackError } = await serviceClient
        .from('businesses')
        .select('place_id, owner_id, name, city, categories, address, primary_category, category')
        .eq('place_id', placeId)
        .limit(1)
        .maybeSingle();
      
      console.log('[discovery] Service client error fallback result', { 
        found: !!fallbackBusiness, 
        error: fallbackError?.message 
      });
      
      if (fallbackError) {
        console.error('[discovery] Service client also failed:', fallbackError);
      return NextResponse.json(
          { error: `Failed to fetch business: ${fallbackError.message}` },
        { status: 500 }
      );
      }
      
      if (fallbackBusiness) {
        business = fallbackBusiness;
        console.log('[discovery] Found business via service client (error path)', { 
          name: business.name 
        });
      } else {
        console.warn('[discovery] Business not found in database', { placeId });
        return NextResponse.json(
          { error: 'Business not found. Please complete the onboarding flow first.' },
          { status: 404 }
        );
      }
    }

    if (!business) {
      console.warn('[discovery] No business found after all attempts', { placeId });
      return NextResponse.json(
        { error: 'Business not found. Please complete the onboarding flow first.' },
        { status: 404 }
      );
    }

    // Generate discovery queries from OpenAI only (no fallback)
    const primaryCategory = business.primary_category || 
      (Array.isArray(business.categories) && business.categories.length > 0
      ? business.categories[0]?.replace(/_/g, ' ')
        : null) ||
      business.category;

    try {
    const queries = await getDiscoveryQueriesForBusiness({
      name: business.name,
        category: business.category || primaryCategory || null,
        primary_category: business.primary_category || primaryCategory || null,
        address: business.address || null,
    });

    return NextResponse.json({
        queries: queries.slice(0, 5), // Limit to 5 for UI
    });
  } catch (error: any) {
      console.error('[discovery] Error generating queries from OpenAI:', error);
    return NextResponse.json(
        { error: error.message || 'Failed to generate discovery queries from OpenAI' },
      { status: 500 }
    );
    }
  } catch (error: any) {
    console.error('[discovery] handleDiscoveryRequest error:', error);
    throw error;
  }
}

