-- Add enriched metadata columns for better search and future AI features

alter table public.resources add column if not exists description text;
alter table public.resources add column if not exists site_name text;
alter table public.resources add column if not exists content_type text;
alter table public.resources add column if not exists tags text[] default '{}';
alter table public.resources add column if not exists author text;
alter table public.resources add column if not exists published_at timestamptz;
alter table public.resources add column if not exists language text;
alter table public.resources add column if not exists reading_time_minutes smallint;

-- Index for content_type filtering
create index if not exists resources_content_type_idx
  on public.resources (content_type) where content_type is not null;

-- GIN index on tags for array containment queries
create index if not exists resources_tags_idx
  on public.resources using gin (tags) where tags != '{}';
