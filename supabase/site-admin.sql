-- Single-table administrator configuration for Atlas Harbor.
-- Safe to rerun in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.site_admin (
  singleton boolean primary key default true check (singleton),
  master_user_id uuid references auth.users(id) on delete restrict,
  password_hash text,
  password_salt text,
  roles jsonb not null default '{}'::jsonb,
  ai_settings jsonb not null default jsonb_build_object(
    'primary_endpoint','https://openrouter.ai/api/v1',
    'primary_model','openrouter/auto',
    'backup_endpoint',null,
    'backup_model',null,
    'instruction_set','Score public submissions for originality, evidence, clarity, usefulness, and meaningful human-AI collaboration. Penalize spam, copied boilerplate, unsupported certainty, and low-effort repetition.',
    'cadence_minutes',10,
    'monthly_budget_usd',25,
    'spent_this_month_usd',0,
    'enabled',false
  ),
  initialized_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.site_admin(singleton) values(true) on conflict do nothing;

alter table public.site_admin enable row level security;
revoke all on public.site_admin from anon, authenticated;

select pg_notify('pgrst', 'reload schema');
