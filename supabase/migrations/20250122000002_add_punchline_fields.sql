-- Update social_insights to support 'google' network and add punchline fields
alter table public.social_insights
drop constraint if exists social_insights_network_check;

alter table public.social_insights
add constraint social_insights_network_check
check (network in ('google', 'instagram', 'tiktok', 'facebook', 'linkedin'));

-- Add punchline and severity fields
alter table public.social_insights
add column if not exists punchline text;

alter table public.social_insights
add column if not exists severity text check (severity in ('low', 'medium', 'high', 'critical'));

-- Add metrics jsonb column for storing the summary/metrics used
alter table public.social_insights
add column if not exists metrics jsonb;

