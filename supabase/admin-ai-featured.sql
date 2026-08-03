-- Admin control plane, global AI moderation, featured ranking, and view tracking.
-- Safe to rerun in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.admin_system (
  singleton boolean primary key default true check (singleton),
  master_user_id uuid references auth.users(id) on delete restrict,
  password_hash text,
  password_salt text,
  initialized_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.admin_system(singleton) values(true) on conflict do nothing;

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','master_admin')),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_ai_settings (
  singleton boolean primary key default true check (singleton),
  primary_endpoint text not null default 'https://openrouter.ai/api/v1',
  primary_model text not null default 'openrouter/auto',
  primary_key_ciphertext text,
  backup_endpoint text,
  backup_model text,
  backup_key_ciphertext text,
  instruction_set text not null default 'Score public submissions for originality, evidence, clarity, usefulness, and evidence of meaningful human-AI collaboration. Penalize spam, copied boilerplate, unsupported certainty, and low-effort repetition.',
  cadence_minutes integer not null default 10 check (cadence_minutes between 5 and 1440),
  monthly_budget_usd numeric not null default 25 check (monthly_budget_usd >= 0),
  spent_this_month_usd numeric not null default 0 check (spent_this_month_usd >= 0),
  spend_month text,
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_error text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.global_ai_settings(singleton) values(true) on conflict do nothing;

create table if not exists public.content_quality_scores (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id text not null,
  title text,
  problem_space text not null,
  quality_score numeric not null check (quality_score between 0 and 100),
  novelty_score numeric not null check (novelty_score between 0 and 100),
  evidence_score numeric not null check (evidence_score between 0 and 100),
  clarity_score numeric not null check (clarity_score between 0 and 100),
  collaboration_score numeric not null check (collaboration_score between 0 and 100),
  spam_probability numeric not null check (spam_probability between 0 and 1),
  rationale text not null,
  model text,
  is_featured boolean not null default false,
  reviewed_at timestamptz not null default now(),
  unique(resource_type,resource_id)
);
create index if not exists quality_featured_idx on public.content_quality_scores(is_featured,quality_score desc,reviewed_at desc);
create index if not exists quality_space_idx on public.content_quality_scores(problem_space,quality_score desc);

create table if not exists public.content_view_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  resource_type text not null,
  resource_id text not null,
  problem_space text not null,
  topics text[] not null default '{}',
  viewed_at timestamptz not null default now()
);
create index if not exists content_views_user_idx on public.content_view_events(user_id,viewed_at desc);
create index if not exists content_views_anon_idx on public.content_view_events(anonymous_id,viewed_at desc);

alter table public.admin_system enable row level security;
alter table public.admin_roles enable row level security;
alter table public.global_ai_settings enable row level security;
alter table public.content_quality_scores enable row level security;
alter table public.content_view_events enable row level security;

grant select on public.content_quality_scores to anon,authenticated;
grant insert on public.content_view_events to anon,authenticated;

create policy "Public reads featured quality scores" on public.content_quality_scores for select using (is_featured=true);
create policy "Anyone records views" on public.content_view_events for insert with check (auth.uid() is null or user_id is null or auth.uid()=user_id);
