-- Create table to store Google Business Profile review metrics
-- This table stores calculated metrics from GBP snapshots for easy dashboard access

create table if not exists public.business_review_metrics (
  id uuid primary key default gen_random_uuid(),
  business_place_id text not null,
  snapshot_ts timestamptz not null,
  
  -- Core metrics
  reviews_total integer,
  rating_avg numeric(3, 2), -- e.g., 4.5
  
  -- Calculated metrics
  positive_reviews_count integer, -- reviews with rating > 3
  negative_reviews_count integer, -- reviews with rating <= 3
  
  -- Time-based metrics
  days_since_last_review integer,
  last_review_date timestamptz,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint fk_business_review_metrics_business 
    foreign key (business_place_id) 
    references public.businesses(place_id) 
    on delete cascade,
  
  -- Ensure one row per business per snapshot
  constraint unique_business_snapshot 
    unique (business_place_id, snapshot_ts)
);

-- Index for fast lookups by business
create index if not exists idx_business_review_metrics_place_id 
  on public.business_review_metrics(business_place_id);

-- Index for latest snapshot lookup
create index if not exists idx_business_review_metrics_snapshot_ts 
  on public.business_review_metrics(business_place_id, snapshot_ts desc);

-- Enable RLS
alter table public.business_review_metrics enable row level security;

-- RLS Policy: Users can only see metrics for their own businesses
create policy "Users can view review metrics for their own businesses"
  on public.business_review_metrics
  for select
  using (
    exists (
      select 1
      from public.businesses b
      where b.place_id = business_review_metrics.business_place_id
        and b.owner_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
create or replace function update_business_review_metrics_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_business_review_metrics_updated_at
  before update on public.business_review_metrics
  for each row
  execute function update_business_review_metrics_updated_at();

