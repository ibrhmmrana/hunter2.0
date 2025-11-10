/**
 * Store social media snapshot in the database.
 * 
 * This module is server-only.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SocialSnapshotData {
  business_id: string;
  network: 'instagram' | 'tiktok' | 'facebook' | 'linkedin';
  posts_total: number | null;
  posts_last_30d: number | null;
  days_since_last_post: number | null;
  engagement_rate: number | null; // e.g., 0.0234 = 2.34%
  followers: number | null;
  likes: number | null; // For Facebook
  raw_data: any; // Full Apify response
}

/**
 * Store a social media snapshot.
 */
export async function storeSocialSnapshot(
  supabase: SupabaseClient,
  data: SocialSnapshotData
): Promise<void> {
  const now = new Date().toISOString();

  const insertPayload = {
    business_id: data.business_id,
    network: data.network,
    snapshot_ts: now,
    posts_total: data.posts_total,
    posts_last_30d: data.posts_last_30d,
    days_since_last_post: data.days_since_last_post !== null ? Math.floor(data.days_since_last_post) : null,
    engagement_rate: data.engagement_rate,
    followers: data.followers,
    likes: data.likes,
    raw_data: data.raw_data,
  };

  console.log(`[storeSocialSnapshot] Inserting ${data.network} snapshot`, {
    business_id: insertPayload.business_id,
    network: insertPayload.network,
    posts_total: insertPayload.posts_total,
    posts_last_30d: insertPayload.posts_last_30d,
    days_since_last_post: insertPayload.days_since_last_post,
    days_since_last_post_raw: data.days_since_last_post,
    followers: insertPayload.followers,
    has_raw_data: !!insertPayload.raw_data,
  });

  const { data: insertedData, error } = await supabase
    .from('social_snapshots')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error(`[storeSocialSnapshot] ❌ Failed to store ${data.network} snapshot`, {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      business_id: data.business_id,
      network: data.network,
    });
    throw error;
  }

  console.log(`[storeSocialSnapshot] ✅ Stored ${data.network} snapshot`, {
    id: insertedData?.id,
    business_id: data.business_id,
    network: data.network,
    snapshot_ts: now,
    posts_total: data.posts_total,
    posts_last_30d: data.posts_last_30d,
    days_since_last_post: data.days_since_last_post,
    followers: data.followers,
  });
}

/**
 * Get the latest social snapshot for a business and network.
 */
export async function getLatestSocialSnapshot(
  supabase: SupabaseClient,
  businessId: string,
  network: 'instagram' | 'tiktok' | 'facebook' | 'linkedin'
): Promise<SocialSnapshotData | null> {
  const { data, error } = await supabase
    .from('social_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .eq('network', network)
    .order('snapshot_ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[getLatestSocialSnapshot] Failed to fetch ${network} snapshot`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    business_id: data.business_id,
    network: data.network,
    posts_total: data.posts_total,
    posts_last_30d: data.posts_last_30d,
    days_since_last_post: data.days_since_last_post,
    engagement_rate: data.engagement_rate,
    followers: data.followers,
    likes: data.likes,
    raw_data: data.raw_data,
  };
}

