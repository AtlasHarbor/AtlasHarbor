-- Run this file in the Supabase SQL editor.
-- Safe to rerun. All user-owned tables use Row Level Security.
create extension if not exists pgcrypto;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openrouter_model text not null default 'openrouter/auto',
  display_name text,
  default_share_scope text not null default 'page' check (default_share_scope in ('page','everything')),
  share_ai_analysis boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings add column if not exists default_share_scope text not null default 'page';
alter table public.user_settings add column if not exists share_ai_analysis boolean not null default true;

create table if not exists public.game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  week integer, cash numeric, market_share numeric, reputation numeric,
  last_event text, updated_at timestamptz not null default now()
);

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('baseball_game','baseball_team','baseball_player','legal_case','logistics_game')),
  resource_id text not null,
  resource_title text not null,
  title text not null default 'Analysis',
  body text not null default '',
  ai_analysis text,
  ai_prompt text,
  projections jsonb not null default '[]'::jsonb,
  placement text not null default 'bottom' check (placement in ('top','bottom')),
  is_published boolean not null default false,
  is_shared boolean not null default false,
  share_scope text not null default 'page' check (share_scope in ('page','everything')),
  share_ai_analysis boolean not null default true,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, resource_type, resource_id)
);
alter table public.workspace_notes add column if not exists title text not null default 'Analysis';
alter table public.workspace_notes add column if not exists ai_prompt text;
alter table public.workspace_notes add column if not exists projections jsonb not null default '[]'::jsonb;
alter table public.workspace_notes add column if not exists placement text not null default 'bottom';
alter table public.workspace_notes add column if not exists is_published boolean not null default false;
create index if not exists workspace_notes_resource_idx on public.workspace_notes(resource_type,resource_id);
create unique index if not exists workspace_notes_share_token_idx on public.workspace_notes(share_token);

alter table public.user_settings enable row level security;
alter table public.game_progress enable row level security;
alter table public.workspace_notes enable row level security;

grant usage on schema public to anon, authenticated;
grant select,insert,update,delete on public.user_settings,public.game_progress,public.workspace_notes to authenticated;
grant select on public.workspace_notes to anon;

drop policy if exists "Users read own settings" on public.user_settings;
drop policy if exists "Users insert own settings" on public.user_settings;
drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users read own settings" on public.user_settings for select using (auth.uid()=user_id);
create policy "Users insert own settings" on public.user_settings for insert with check (auth.uid()=user_id);
create policy "Users update own settings" on public.user_settings for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "Users read own progress" on public.game_progress;
drop policy if exists "Users insert own progress" on public.game_progress;
drop policy if exists "Users update own progress" on public.game_progress;
create policy "Users read own progress" on public.game_progress for select using (auth.uid()=user_id);
create policy "Users insert own progress" on public.game_progress for insert with check (auth.uid()=user_id);
create policy "Users update own progress" on public.game_progress for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "Users read own workspace notes" on public.workspace_notes;
drop policy if exists "Public reads shared workspace notes" on public.workspace_notes;
drop policy if exists "Users insert own workspace notes" on public.workspace_notes;
drop policy if exists "Users update own workspace notes" on public.workspace_notes;
drop policy if exists "Users delete own workspace notes" on public.workspace_notes;
create policy "Users read own workspace notes" on public.workspace_notes for select to authenticated using (auth.uid()=user_id or is_shared=true);
create policy "Public reads shared workspace notes" on public.workspace_notes for select to anon using (is_shared=true and is_published=true);
create policy "Users insert own workspace notes" on public.workspace_notes for insert to authenticated with check (auth.uid()=user_id);
create policy "Users update own workspace notes" on public.workspace_notes for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users delete own workspace notes" on public.workspace_notes for delete to authenticated using (auth.uid()=user_id);
