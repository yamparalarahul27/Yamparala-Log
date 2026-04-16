-- Add normalized_url column for duplicate detection
alter table public.resources add column if not exists normalized_url text;

-- Index for fast duplicate lookups
create index if not exists resources_normalized_url_idx on public.resources (normalized_url);
