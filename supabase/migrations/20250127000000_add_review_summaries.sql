-- Add review summary columns to google_review_snapshots
alter table public.google_review_snapshots
  add column if not exists negative_summary text,
  add column if not exists positive_summary text;

-- Add comment
comment on column public.google_review_snapshots.negative_summary is 'AI-generated summary of negative reviews (1-2 stars)';
comment on column public.google_review_snapshots.positive_summary is 'AI-generated summary of positive reviews (4-5 stars)';

