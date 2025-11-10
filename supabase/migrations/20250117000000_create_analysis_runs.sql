-- TABLE: analysis_runs
-- Lightweight orchestration table for tracking analysis runs
create table if not exists public.analysis_runs (
  id bigint generated always as identity primary key,
  business_place_id text not null,
  owner_id uuid not null,
  status text not null default 'running' check (status in ('running', 'complete', 'error')),
  last_started_at timestamptz not null default now(),
  last_completed_at timestamptz null,
  last_error text null,
  run_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint for idempotency
create unique index if not exists analysis_runs_business_run_key_idx
on public.analysis_runs (business_place_id, run_key)
where run_key is not null;

-- Index for quick lookups
create index if not exists analysis_runs_business_place_id_idx
on public.analysis_runs (business_place_id, last_started_at desc);

-- RLS
alter table public.analysis_runs enable row level security;

-- POLICY: owners can select their own rows
create policy "read own analysis runs"
on public.analysis_runs
for select
to authenticated
using (
  owner_id = auth.uid()
);

-- Service role can insert/update (no policy needed, service role bypasses RLS)




