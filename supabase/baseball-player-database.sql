-- Persistent shared Baseball player snapshots and admin refresh jobs.
-- Apply once in the Atlas Harbor Supabase project before enabling bulk refresh.

create table if not exists public.baseball_player_snapshots (
  player_id bigint primary key,
  name text not null default '',
  team_id bigint,
  team_name text,
  parent_org_id bigint,
  sport_id integer,
  level text,
  position text,
  snapshot jsonb not null default '{}'::jsonb,
  refresh_source text not null default 'player-page',
  refresh_job_id text,
  source_updated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create index if not exists baseball_player_snapshots_team_idx on public.baseball_player_snapshots(team_id);
create index if not exists baseball_player_snapshots_sport_idx on public.baseball_player_snapshots(sport_id);
create index if not exists baseball_player_snapshots_refreshed_idx on public.baseball_player_snapshots(refreshed_at desc);

create table if not exists public.baseball_refresh_jobs (
  id text primary key,
  scope text not null,
  sport_ids integer[] not null default '{}',
  status text not null default 'queued',
  total_players integer not null default 0,
  completed_players integer not null default 0,
  failed_players integer not null default 0,
  current_player_id bigint,
  current_player_name text,
  errors jsonb not null default '[]'::jsonb,
  cancel_requested boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists baseball_refresh_jobs_created_idx on public.baseball_refresh_jobs(created_at desc);

alter table public.baseball_player_snapshots enable row level security;
alter table public.baseball_refresh_jobs enable row level security;

-- There are intentionally no anon/authenticated policies. These tables are a
-- server-side cache written and read through Atlas Harbor's service/secret key.
revoke all on public.baseball_player_snapshots from anon, authenticated;
revoke all on public.baseball_refresh_jobs from anon, authenticated;
