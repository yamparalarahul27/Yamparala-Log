-- Add is_favourite so a resource can be starred and surfaced in the
-- Favourites tab. Mirrors task_done: a plain boolean, not null, default false.
alter table public.resources add column if not exists is_favourite boolean not null default false;

-- Partial index — the Favourites query only ever asks for the true rows, and
-- those stay a small slice of the table.
create index if not exists resources_is_favourite_idx
  on public.resources (saved_at desc)
  where is_favourite;
