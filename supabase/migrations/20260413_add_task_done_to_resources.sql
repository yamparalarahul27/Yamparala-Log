-- Add task_done column to mark resources with comments as completed tasks
alter table public.resources add column if not exists task_done boolean not null default false;
