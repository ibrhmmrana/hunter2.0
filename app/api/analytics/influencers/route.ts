import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getInfluencersForBusiness } from '@/lib/influencers/recommend';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/influencers
 * 
 * Get recommended influencers for a business.
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

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }

    // Fetch business data (try strict first, then fallback)
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('place_id, owner_id, city, categories')
      .eq('place_id', placeId)
      .eq('owner_id', user.id)
      .maybeSingle();

    // Fallback: try without owner_id filter (for orphaned businesses)
    if (!business && !businessError) {
      const { data: fallbackBusiness } = await supabase
        .from('businesses')
        .select('place_id, owner_id, city, categories')
        .eq('place_id', placeId)
        .limit(1)
        .maybeSingle();
      
      if (fallbackBusiness) {
        business = fallbackBusiness;
      }
    }

    if (businessError) {
      console.error('Error fetching business:', businessError);
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

    // Get influencers
    const influencers = await getInfluencersForBusiness({
      city: business.city,
      category: primaryCategory,
    });

    return NextResponse.json({
      influencers,
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

