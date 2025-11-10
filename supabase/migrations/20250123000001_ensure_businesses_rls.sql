-- Ensure businesses table has RLS enabled and proper policies
-- This migration is idempotent - it won't break if RLS is already enabled

-- Enable RLS on businesses table (if not already enabled)
alter table public.businesses enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "users can read own businesses" on public.businesses;
drop policy if exists "users can update own businesses" on public.businesses;

-- Policy: Users can read businesses they own
create policy "users can read own businesses"
on public.businesses
for select
to authenticated
using (owner_id = auth.uid());

-- Policy: Users can update businesses they own
create policy "users can update own businesses"
on public.businesses
for update
to authenticated
using (owner_id = auth.uid());

-- Service role can insert/update (bypasses RLS)
-- This is needed for API routes that create/update businesses

