-- Create ads table for AI-generated advertisements
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_place_id text,
  type text not null check (type in ('image', 'video')),
  category text not null,
  preset_key text not null,
  title text,
  input_image_url text,
  output_url text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists ads_user_id_idx on public.ads(user_id);
create index if not exists ads_status_idx on public.ads(status);
create index if not exists ads_created_at_idx on public.ads(created_at desc);

-- RLS Policies
alter table public.ads enable row level security;

-- Users can only see their own ads
create policy "Users can view their own ads"
  on public.ads
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users can insert their own ads
create policy "Users can insert their own ads"
  on public.ads
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update their own ads
create policy "Users can update their own ads"
  on public.ads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own ads
create policy "Users can delete their own ads"
  on public.ads
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Function to update updated_at timestamp
create or replace function update_ads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger update_ads_updated_at
  before update on public.ads
  for each row
  execute function update_ads_updated_at();

