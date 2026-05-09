-- Add image_width and image_height so cards can reserve their final
-- height before the thumbnail loads (no layout shift).
-- Both nullable; renderer falls back to a 1.91:1 aspect when either is null.
alter table public.resources
  add column if not exists image_width int,
  add column if not exists image_height int;
