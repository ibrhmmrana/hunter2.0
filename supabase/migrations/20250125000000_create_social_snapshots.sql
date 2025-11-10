-- Create table to store social media snapshots (similar to snapshots_gbp)
-- This stores full Apify data for historical tracking and dashboard display

create table if not exists public.social_snapshots (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(place_id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'facebook', 'linkedin')),
  snapshot_ts timestamptz not null default now(),
  
  -- Core metrics (extracted for easy querying)
  posts_total integer, -- Total posts/videos
  posts_last_30d integer, -- Posts in last 30 days
  days_since_last_post integer, -- Days since most recent post
  engagement_rate numeric(5, 4), -- Engagement rate (e.g., 0.0234 = 2.34%)
  followers integer, -- Follower count
  likes integer, -- Likes (for Facebook)
  
  -- Full raw data from Apify (stored as JSONB)
  raw_data jsonb not null,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure one snapshot per business/network per timestamp
  unique(business_id, network, snapshot_ts)
);

-- Index for fast lookups by business and network
create index if not exists social_snapshots_business_network_idx
  on public.social_snapshots(business_id, network);

-- Index for latest snapshot lookup
create index if not exists social_snapshots_latest_idx
  on public.social_snapshots(business_id, network, snapshot_ts desc);

-- RLS
alter table public.social_snapshots enable row level security;

create policy "read own social snapshots"
  on public.social_snapshots
  for select
  to authenticated
  using (
    business_id in (
      select place_id from public.businesses where owner_id = auth.uid()
    )
  );

-- Service role can insert/update (bypasses RLS)

-- Function to update updated_at timestamp
create or replace function update_social_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_social_snapshots_updated_at
  before update on public.social_snapshots
  for each row
  execute function update_social_snapshots_updated_at();

