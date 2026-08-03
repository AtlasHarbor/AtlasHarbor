-- Run in the Supabase SQL editor. Safe to rerun.
alter table public.workspace_notes
  add column if not exists published_at timestamptz;

update public.workspace_notes
set published_at = coalesce(published_at, updated_at)
where is_published = true and published_at is null;

create index if not exists workspace_notes_published_feed_idx
  on public.workspace_notes(is_published, is_shared, published_at desc);
