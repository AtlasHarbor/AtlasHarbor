-- Run this migration in the Supabase SQL editor.
-- It is safe to rerun.

-- Convert the old ambiguous `top` value to the clearer below-header placement.
update public.workspace_notes
set placement = 'below_header'
where placement = 'top';

alter table public.workspace_notes
  alter column placement set default 'below_header';

alter table public.workspace_notes
  drop constraint if exists workspace_notes_placement_check;

alter table public.workspace_notes
  add constraint workspace_notes_placement_check
  check (placement in ('above_header', 'below_header', 'bottom'));

-- Keep projections explicitly non-null and JSON-array based.
update public.workspace_notes
set projections = '[]'::jsonb
where projections is null or jsonb_typeof(projections) <> 'array';

alter table public.workspace_notes
  alter column projections set default '[]'::jsonb,
  alter column projections set not null;
