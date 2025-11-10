/**
 * Store punchline in social_insights table.
 * 
 * This module is server-only.
 */

import type { Punchline } from './punchlines';

/**
 * Store a punchline in the database.
 */
export async function storePunchline(
  businessId: string,
  network: 'google' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin',
  punchline: Punchline,
  metrics: Record<string, any>,
  supabase: any
): Promise<void> {
  // Normalize network to lowercase
  const normalizedNetwork = network.toLowerCase();
  
  console.log('[storePunchline] upserting', {
    businessId,
    network: normalizedNetwork,
    punchline: punchline.punchline.substring(0, 50) + '...',
    severity: punchline.severity,
  });
  
  const { error } = await supabase
    .from('social_insights')
    .upsert(
      {
        business_id: businessId,
        network: normalizedNetwork, // Ensure lowercase
        punchline: punchline.punchline,
        severity: punchline.severity,
        metrics: metrics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,network' }
    );

  if (error) {
    console.error(`[storePunchline] Failed to store ${network} punchline`, error);
    throw error;
  }

  console.log(`[storePunchline] ✅ Stored ${network} punchline`, {
    businessId,
    network: normalizedNetwork,
    punchline: punchline.punchline.substring(0, 50) + '...',
    severity: punchline.severity,
  });
}

