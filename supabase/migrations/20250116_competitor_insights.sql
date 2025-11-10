-- TABLE
create table if not exists public.competitor_insights (
  business_place_id text not null,
  competitor_place_id text not null,
  insights jsonb not null,              -- { bullets: string[], model: 'gpt-4o-mini', version: 'v1', source:'ai|heuristic' }
  generated_at timestamptz not null default now(),
  prompt_hash text,                     -- optional cache key
  primary key (business_place_id, competitor_place_id)
);

-- RLS
alter table public.competitor_insights enable row level security;

-- POLICY: owners can read their rows (via businesses)
create policy "read own insights"
on public.competitor_insights
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.place_id = competitor_insights.business_place_id
      and b.owner_id = auth.uid()
  )
);

-- Service role will insert/update (no extra policy needed)

-- Helpful index
create index if not exists competitor_insights_generated_at_idx
on public.competitor_insights (generated_at desc);




