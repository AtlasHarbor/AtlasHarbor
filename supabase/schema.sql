-- Run this file in the Supabase SQL editor.
-- All user-owned tables use Row Level Security.

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

alter table public.user_settings enable row level security;
alter table public.game_progress enable row level security;
alter table public.legal_notes enable row level security;

create policy "Users read own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users update own settings" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own progress" on public.game_progress for select using (auth.uid() = user_id);
create policy "Users insert own progress" on public.game_progress for insert with check (auth.uid() = user_id);
create policy "Users update own progress" on public.game_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own notes or shared notes" on public.legal_notes for select using (auth.uid() = user_id or is_shared = true);
create policy "Users insert own notes" on public.legal_notes for insert with check (auth.uid() = user_id);
create policy "Users update own notes" on public.legal_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own notes" on public.legal_notes for delete using (auth.uid() = user_id);
