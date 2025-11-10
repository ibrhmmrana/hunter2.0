-- TABLE: profiles
-- User profiles linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  onboarding_completed boolean not null default false,
  default_business_id text references public.businesses(place_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for lookups
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_default_business_id_idx on public.profiles (default_business_id);

-- RLS
alter table public.profiles enable row level security;

-- Users can read and update their own profile
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

-- Service role can insert/update (bypasses RLS)
-- This is needed for ensureProfileForUser helper

-- Function to automatically create profile on user signup
-- This is a trigger that runs when a new user is created in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function when a new user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

