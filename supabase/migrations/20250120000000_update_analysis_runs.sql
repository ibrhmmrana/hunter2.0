-- Update analysis_runs table to match new requirements
-- Add 'pending' status and standardize column names

-- Add 'pending' to status check constraint
alter table public.analysis_runs 
  drop constraint if exists analysis_runs_status_check;

alter table public.analysis_runs
  add constraint analysis_runs_status_check 
  check (status in ('pending', 'running', 'complete', 'error'));

-- Rename columns to match new schema (if they don't match)
do $$
begin
  -- Rename last_started_at to started_at if it exists
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'analysis_runs' 
    and column_name = 'last_started_at'
  ) then
    alter table public.analysis_runs rename column last_started_at to started_at;
  end if;

  -- Rename last_completed_at to completed_at if it exists
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'analysis_runs' 
    and column_name = 'last_completed_at'
  ) then
    alter table public.analysis_runs rename column last_completed_at to completed_at;
  end if;

  -- Rename last_error to error_message if it exists
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'analysis_runs' 
    and column_name = 'last_error'
  ) then
    alter table public.analysis_runs rename column last_error to error_message;
  end if;
end $$;

-- Ensure columns exist with correct names
alter table public.analysis_runs
  alter column started_at set default now();

-- Add unique index on (owner_id, business_place_id) for one active run per business
-- Note: This is a partial unique index, so multiple rows can exist for same owner+place
-- but only one can be 'pending' or 'running' at a time
create unique index if not exists analysis_runs_owner_place_unique_idx
on public.analysis_runs (owner_id, business_place_id)
where status in ('pending', 'running');

