-- Update profiles table to match canonical schema
-- This migration updates the existing profiles table structure

-- First, drop the old trigger and function if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Drop old policies
drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;

-- Rename columns if they exist and add new ones
-- Note: We'll use ALTER TABLE to modify the structure

-- If the table exists with old schema, we need to migrate
-- For safety, we'll check and alter accordingly

-- Add new columns if they don't exist
do $$
begin
  -- Add user_id if it doesn't exist (rename from id if needed)
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'id') then
    -- Rename id to user_id
    alter table public.profiles rename column id to user_id;
  elsif not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'user_id') then
    -- Add user_id if neither exists
    alter table public.profiles add column user_id uuid;
  end if;

  -- Add onboarding_completed_at if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'onboarding_completed_at') then
    -- Migrate from boolean onboarding_completed if it exists
    if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'onboarding_completed') then
      alter table public.profiles add column onboarding_completed_at timestamptz;
      -- Set onboarding_completed_at for rows where onboarding_completed = true
      update public.profiles set onboarding_completed_at = now() where onboarding_completed = true;
      -- Drop the old boolean column
      alter table public.profiles drop column onboarding_completed;
    else
      alter table public.profiles add column onboarding_completed_at timestamptz;
    end if;
  end if;

  -- Add plan_selected_at if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'plan_selected_at') then
    alter table public.profiles add column plan_selected_at timestamptz;
  end if;

  -- Add plan if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'plan') then
    alter table public.profiles add column plan text default 'free';
  end if;

  -- Rename default_business_id to default_business_place_id if needed
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'default_business_id') then
    alter table public.profiles rename column default_business_id to default_business_place_id;
  elsif not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'default_business_place_id') then
    alter table public.profiles add column default_business_place_id text references public.businesses(place_id) on delete set null;
  end if;

  -- Remove email and full_name if they exist (not in canonical schema)
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'email') then
    alter table public.profiles drop column email;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'full_name') then
    alter table public.profiles drop column full_name;
  end if;
end $$;

-- Ensure user_id is the primary key and has proper constraints
-- Drop existing primary key if it exists on a different column
do $$
begin
  -- Drop old primary key if it exists on 'id'
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'profiles_pkey' and table_name = 'profiles') then
    alter table public.profiles drop constraint profiles_pkey;
  end if;
end $$;

-- Set user_id as not null and add constraints
alter table public.profiles 
  alter column user_id set not null;

-- Add primary key constraint if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'profiles_user_id_pkey' and table_name = 'profiles') then
    alter table public.profiles add constraint profiles_user_id_pkey primary key (user_id);
  end if;
end $$;

-- Add foreign key constraint if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'profiles_user_id_fkey' and table_name = 'profiles') then
    alter table public.profiles add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Add unique constraint if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'profiles_user_id_unique' and table_name = 'profiles') then
    alter table public.profiles add constraint profiles_user_id_unique unique (user_id);
  end if;
end $$;

-- Ensure created_at and updated_at have defaults
alter table public.profiles 
  alter column created_at set default now(),
  alter column updated_at set default now();

-- Ensure plan has default
alter table public.profiles 
  alter column plan set default 'free';

-- Create updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

-- Recreate indexes
drop index if exists public.profiles_email_idx;
drop index if exists public.profiles_default_business_id_idx;
create index if not exists profiles_default_business_place_id_idx on public.profiles (default_business_place_id);

-- Re-enable RLS
alter table public.profiles enable row level security;

-- Recreate RLS policies
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (user_id = auth.uid());

create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- Recreate trigger function for auto-creating profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, plan)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

