-- Add analysis jsonb column to social_insights for storing AI-generated insights
alter table public.social_insights
add column if not exists analysis jsonb;

-- Add index for querying analysis data
create index if not exists social_insights_analysis_idx
on public.social_insights using gin (analysis);

