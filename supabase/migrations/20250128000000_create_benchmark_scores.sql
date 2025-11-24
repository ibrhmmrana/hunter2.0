-- Create table to store social media benchmark scores
-- This prevents recalculation on every page load

create table if not exists public.benchmark_scores (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(place_id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'facebook')),
  
  -- Scores
  current_score numeric(5, 2), -- Current performance score (0-100)
  benchmark_score numeric(5, 2), -- Industry standard score (0-100)
  
  -- Reasoning/explanation
  current_reasoning text,
  benchmark_reasoning text,
  
  -- Metadata
  snapshot_ts timestamptz, -- Reference to the snapshot used for calculation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- One score record per business/network
  unique(business_id, network)
);

-- Index for fast lookups
create index if not exists benchmark_scores_business_network_idx
  on public.benchmark_scores(business_id, network);

-- RLS
alter table public.benchmark_scores enable row level security;

create policy "read own benchmark scores"
  on public.benchmark_scores
  for select
  to authenticated
  using (
    business_id in (
      select place_id from public.businesses where owner_id = auth.uid()
    )
  );

-- Service role can insert/update (bypasses RLS)

-- Function to update updated_at timestamp
create or replace function update_benchmark_scores_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_benchmark_scores_updated_at
  before update on public.benchmark_scores
  for each row
  execute function update_benchmark_scores_updated_at();

