-- Add image_url column to store OG image or preview image for resources
alter table public.resources add column if not exists image_url text;
