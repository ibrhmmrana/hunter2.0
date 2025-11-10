-- Create watchlist_competitors table
create table if not exists public.watchlist_competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_place_id text not null,
  competitor_place_id text not null,
  competitor_name text not null,
  competitor_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  
  -- Unique constraint: one active watchlist entry per user per competitor
  constraint unique_active_watchlist 
    unique (user_id, competitor_place_id) 
    where (active = true)
);

-- Create index for fast lookups
create index if not exists idx_watchlist_competitors_user_id 
  on public.watchlist_competitors(user_id, active) 
  where active = true;

create index if not exists idx_watchlist_competitors_business_place_id 
  on public.watchlist_competitors(business_place_id);

-- Create watchlist_social_profiles table
create table if not exists public.watchlist_social_profiles (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlist_competitors(id) on delete cascade,
  network text not null check (network in ('google', 'instagram', 'tiktok', 'facebook')),
  handle_or_url text not null,
  source text not null check (source in ('gbp', 'manual')),
  last_seen_external_id text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Unique constraint: one social profile per network per watchlist entry
  constraint unique_watchlist_social 
    unique (watchlist_id, network)
);

-- Create index for fast lookups
create index if not exists idx_watchlist_social_profiles_watchlist_id 
  on public.watchlist_social_profiles(watchlist_id);

create index if not exists idx_watchlist_social_profiles_network 
  on public.watchlist_social_profiles(network, last_checked_at);

-- Create alerts table
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id uuid references public.watchlist_competitors(id) on delete set null,
  type text not null check (type in (
    'competitor_new_review',
    'competitor_negative_review',
    'competitor_new_post',
    'competitor_trending_post'
  )),
  title text not null,
  message text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Create indexes for fast lookups
create index if not exists idx_alerts_user_id_created_at 
  on public.alerts(user_id, created_at desc);

create index if not exists idx_alerts_user_id_read_at 
  on public.alerts(user_id, read_at) 
  where read_at is null;

create index if not exists idx_alerts_watchlist_id 
  on public.alerts(watchlist_id) 
  where watchlist_id is not null;

-- Enable RLS
alter table public.watchlist_competitors enable row level security;
alter table public.watchlist_social_profiles enable row level security;
alter table public.alerts enable row level security;

-- RLS Policies for watchlist_competitors
create policy "Users can view their own watchlist competitors"
  on public.watchlist_competitors
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own watchlist competitors"
  on public.watchlist_competitors
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own watchlist competitors"
  on public.watchlist_competitors
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own watchlist competitors"
  on public.watchlist_competitors
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for watchlist_social_profiles
create policy "Users can view social profiles for their watchlist"
  on public.watchlist_social_profiles
  for select
  using (
    exists (
      select 1 from public.watchlist_competitors wc
      where wc.id = watchlist_social_profiles.watchlist_id
        and wc.user_id = auth.uid()
    )
  );

create policy "Users can insert social profiles for their watchlist"
  on public.watchlist_social_profiles
  for insert
  with check (
    exists (
      select 1 from public.watchlist_competitors wc
      where wc.id = watchlist_social_profiles.watchlist_id
        and wc.user_id = auth.uid()
    )
  );

create policy "Users can update social profiles for their watchlist"
  on public.watchlist_social_profiles
  for update
  using (
    exists (
      select 1 from public.watchlist_competitors wc
      where wc.id = watchlist_social_profiles.watchlist_id
        and wc.user_id = auth.uid()
    )
  );

create policy "Users can delete social profiles for their watchlist"
  on public.watchlist_social_profiles
  for delete
  using (
    exists (
      select 1 from public.watchlist_competitors wc
      where wc.id = watchlist_social_profiles.watchlist_id
        and wc.user_id = auth.uid()
    )
  );

-- RLS Policies for alerts
create policy "Users can view their own alerts"
  on public.alerts
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own alerts"
  on public.alerts
  for update
  using (auth.uid() = user_id);

-- Service role can insert/update (for background jobs)
-- No insert policy needed - service role bypasses RLS

-- Function to update updated_at timestamp
create or replace function update_watchlist_competitors_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_watchlist_competitors_updated_at
  before update on public.watchlist_competitors
  for each row
  execute function update_watchlist_competitors_updated_at();

create or replace function update_watchlist_social_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_watchlist_social_profiles_updated_at
  before update on public.watchlist_social_profiles
  for each row
  execute function update_watchlist_social_profiles_updated_at();

