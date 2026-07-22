-- Split context from tasks: `notes` previously doubled as the pending-task
-- text (Tasks tab showed any resource with a non-empty note). New column
-- `task` holds the to-do; `notes` becomes pure context ("why I saved this").
alter table resources add column if not exists task text;

-- Existing pending tasks (non-empty notes, not done) move to the new column.
update resources
set task = notes, notes = ''
where coalesce(notes, '') <> '' and task_done = false;
