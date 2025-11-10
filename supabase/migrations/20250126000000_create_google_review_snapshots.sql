-- Create table to store Google review snapshots
-- This stores review data from Apify for historical tracking and dashboard display

create table if not exists public.google_review_snapshots (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(place_id) on delete cascade,
  snapshot_ts timestamptz not null default now(),
  
  -- Core metrics (extracted for easy querying)
  negative_reviews integer not null default 0, -- 1-2 star reviews
  positive_reviews integer not null default 0, -- 4-5 star reviews
  days_since_last_review integer, -- Days since most recent review
  total_reviews integer not null default 0, -- Total review count
  reviews_distribution jsonb, -- { oneStar, twoStar, threeStar, fourStar, fiveStar }
  
  -- Full raw data from Apify (stored as JSONB)
  raw_data jsonb not null,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure one snapshot per business per timestamp
  unique(business_id, snapshot_ts)
);

-- Index for fast lookups by business
create index if not exists google_review_snapshots_business_idx
  on public.google_review_snapshots(business_id);

-- Index for latest snapshot lookup
create index if not exists google_review_snapshots_latest_idx
  on public.google_review_snapshots(business_id, snapshot_ts desc);

-- RLS
alter table public.google_review_snapshots enable row level security;

create policy "read own google review snapshots"
  on public.google_review_snapshots
  for select
  to authenticated
  using (
    business_id in (
      select place_id from public.businesses where owner_id = auth.uid()
    )
  );

-- Service role can insert/update (bypasses RLS)

-- Function to update updated_at timestamp
create or replace function update_google_review_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_google_review_snapshots_updated_at
  before update on public.google_review_snapshots
  for each row
  execute function update_google_review_snapshots_updated_at();

