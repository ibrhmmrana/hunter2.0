-- TABLE: social_profiles
-- Stores social media profile connections for businesses
create table if not exists public.social_profiles (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(place_id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'facebook', 'linkedin')),
  handle text not null,
  profile_url text,
  raw_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, network)
);

-- Index for lookups
create index if not exists social_profiles_business_id_idx
on public.social_profiles (business_id);

-- RLS
alter table public.social_profiles enable row level security;

create policy "read own social profiles"
on public.social_profiles
for select
to authenticated
using (
  business_id in (
    select place_id from public.businesses where owner_id = auth.uid()
  )
);

-- Service role can insert/update (bypasses RLS)

-- TABLE: social_insights
-- Stores analyzed insights from social media profiles
create table if not exists public.social_insights (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(place_id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'facebook', 'linkedin')),
  
  -- Posting consistency
  posts_last_30d integer,
  days_since_last_post integer,
  has_gone_dark boolean,
  
  -- Profile clarity
  bio_has_what_you_do boolean,
  bio_has_where_you_are boolean,
  bio_has_how_to_contact boolean,
  has_valid_link_in_bio boolean,
  has_contact_button boolean,
  
  -- Content metrics
  offer_post_ratio numeric,
  engagement_rate numeric,
  engagement_flag text check (engagement_flag in ('low', 'ok', 'healthy')),
  cta_post_ratio numeric,
  cta_flag text check (cta_flag in ('low', 'ok', 'good')),
  responsiveness_flag text,
  
  -- Summary
  headline text,
  bullets jsonb, -- array of strings
  
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, network)
);

-- Index for lookups
create index if not exists social_insights_business_id_idx
on public.social_insights (business_id, network);

-- RLS
alter table public.social_insights enable row level security;

create policy "read own social insights"
on public.social_insights
for select
to authenticated
using (
  business_id in (
    select place_id from public.businesses where owner_id = auth.uid()
  )
);

-- Service role can insert/update (bypasses RLS)

