-- Run this file in the Supabase SQL editor.
-- It is safe to rerun. All user-owned tables use Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openrouter_model text not null default 'openai/gpt-5.2',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  week integer,
  cash numeric,
  market_share numeric,
  reputation numeric,
  last_event text,
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_slug text not null,
  title text not null default 'Case note',
  body text not null default '',
  is_shared boolean not null default false,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists legal_notes_user_case_idx on public.legal_notes(user_id, case_slug);
create unique index if not exists legal_notes_share_token_idx on public.legal_notes(share_token);

grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update on public.game_progress to authenticated;
grant select, insert, update, delete on public.legal_notes to authenticated;
grant select on public.legal_notes to anon;

alter table public.user_settings enable row level security;
alter table public.game_progress enable row level security;
alter table public.legal_notes enable row level security;

drop policy if exists "Users read own settings" on public.user_settings;
drop policy if exists "Users insert own settings" on public.user_settings;
drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users read own settings" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own settings" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own settings" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own progress" on public.game_progress;
drop policy if exists "Users insert own progress" on public.game_progress;
drop policy if exists "Users update own progress" on public.game_progress;
create policy "Users read own progress" on public.game_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own progress" on public.game_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own progress" on public.game_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own notes or shared notes" on public.legal_notes;
drop policy if exists "Users insert own notes" on public.legal_notes;
drop policy if exists "Users update own notes" on public.legal_notes;
drop policy if exists "Users delete own notes" on public.legal_notes;
create policy "Users read own notes or shared notes" on public.legal_notes for select to authenticated, anon using ((select auth.uid()) = user_id or is_shared = true);
create policy "Users insert own notes" on public.legal_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own notes" on public.legal_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own notes" on public.legal_notes for delete to authenticated using ((select auth.uid()) = user_id);
