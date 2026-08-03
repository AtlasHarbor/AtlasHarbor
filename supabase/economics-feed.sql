-- Economics publication feed. Safe to rerun.
create extension if not exists pgcrypto;
create table if not exists public.economics_feed_settings (
 singleton boolean primary key default true check(singleton),
 source_name text not null default 'Financial Times',
 source_url text not null default '',
 source_type text not null default 'rss' check(source_type in ('rss','atom','json','manual')),
 cadence_hours integer not null default 12 check(cadence_hours between 1 and 168),
 max_items integer not null default 20 check(max_items between 1 and 50),
 ai_instruction text not null default 'Convert each economic story into a clear decision problem with stakeholders, constraints, tradeoffs, questions, and relevant topics.',
 enabled boolean not null default false,
 last_run_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now()
);
insert into public.economics_feed_settings(singleton) values(true) on conflict(singleton) do nothing;
create table if not exists public.economic_problems (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null,
 problem text not null,
 questions jsonb not null default '[]'::jsonb,
 topics text[] not null default '{}',
 source_title text not null,
 source_name text not null,
 source_url text not null,
 source_published_at timestamptz,
 published_at timestamptz not null default now(),
 status text not null default 'published' check(status in ('draft','published','archived')),
 ai_model text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists economic_problems_feed_idx on public.economic_problems(status,published_at desc);
alter table public.economics_feed_settings enable row level security;
alter table public.economic_problems enable row level security;
grant select on public.economic_problems to anon,authenticated;
drop policy if exists "Public reads economic problems" on public.economic_problems;
create policy "Public reads economic problems" on public.economic_problems for select using(status='published');
revoke all on public.economics_feed_settings from anon,authenticated;
