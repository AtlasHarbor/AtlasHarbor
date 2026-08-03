-- Dropshipping & Advertising problem space.
-- Safe to rerun in the Supabase SQL editor.
create extension if not exists pgcrypto;

alter table public.workspace_notes add column if not exists comments_enabled boolean not null default false;

create table if not exists public.dropship_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_alias text not null check (char_length(author_alias) between 2 and 80),
  title text not null check (char_length(title) between 3 and 140),
  product_name text not null check (char_length(product_name) between 2 and 160),
  product_url text,
  product_notes text not null default '',
  keywords text[] not null default '{}',
  platform text not null,
  geography text not null,
  audience_interests text[] not null default '{}',
  bid_strategy text not null default '',
  budget numeric,
  strategy_body text not null,
  ai_analysis text,
  results text,
  comments_enabled boolean not null default false,
  funding_open boolean not null default false,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dropship_strategies_feed_idx on public.dropship_strategies(status,created_at desc);
create index if not exists dropship_strategies_keywords_idx on public.dropship_strategies using gin(keywords);

create table if not exists public.strategy_comments (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.dropship_strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_alias text not null check (char_length(author_alias) between 2 and 80),
  body text not null check (char_length(body) between 2 and 3000),
  is_ai_comment boolean not null default false,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_comments_strategy_idx on public.strategy_comments(strategy_id,created_at);

create table if not exists public.strategy_funding_interest (
  strategy_id uuid not null references public.dropship_strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null default '',
  created_at timestamptz not null default now(),
  primary key(strategy_id,user_id)
);

create table if not exists public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.dropship_strategies(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.direct_thread_members (
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(thread_id,user_id)
);
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_thread_idx on public.direct_messages(thread_id,created_at);

alter table public.dropship_strategies enable row level security;
alter table public.strategy_comments enable row level security;
alter table public.strategy_funding_interest enable row level security;
alter table public.direct_threads enable row level security;
alter table public.direct_thread_members enable row level security;
alter table public.direct_messages enable row level security;

grant select on public.dropship_strategies,public.strategy_comments to anon,authenticated;
grant insert,update,delete on public.dropship_strategies,public.strategy_comments to authenticated;
grant select,insert,update,delete on public.strategy_funding_interest,public.direct_threads,public.direct_thread_members,public.direct_messages to authenticated;

drop policy if exists "Public reads published dropship strategies" on public.dropship_strategies;
drop policy if exists "Users manage own dropship strategies" on public.dropship_strategies;
create policy "Public reads published dropship strategies" on public.dropship_strategies for select using (status='published' or auth.uid()=user_id);
create policy "Users insert own dropship strategies" on public.dropship_strategies for insert to authenticated with check (auth.uid()=user_id);
create policy "Users update own dropship strategies" on public.dropship_strategies for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users delete own dropship strategies" on public.dropship_strategies for delete to authenticated using (auth.uid()=user_id);

drop policy if exists "Public reads enabled strategy comments" on public.strategy_comments;
drop policy if exists "Users add enabled strategy comments" on public.strategy_comments;
create policy "Public reads enabled strategy comments" on public.strategy_comments for select using (exists(select 1 from public.dropship_strategies s where s.id=strategy_id and s.comments_enabled=true));
create policy "Users add enabled strategy comments" on public.strategy_comments for insert to authenticated with check (auth.uid()=user_id and exists(select 1 from public.dropship_strategies s where s.id=strategy_id and s.comments_enabled=true));
create policy "Users update own strategy comments" on public.strategy_comments for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users delete own strategy comments" on public.strategy_comments for delete to authenticated using (auth.uid()=user_id);

drop policy if exists "Users manage own funding interest" on public.strategy_funding_interest;
create policy "Users manage own funding interest" on public.strategy_funding_interest for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id and exists(select 1 from public.dropship_strategies s where s.id=strategy_id and s.funding_open=true));
create policy "Owners read funding interest" on public.strategy_funding_interest for select to authenticated using (exists(select 1 from public.dropship_strategies s where s.id=strategy_id and s.user_id=auth.uid()));

create policy "Members read threads" on public.direct_threads for select to authenticated using (exists(select 1 from public.direct_thread_members m where m.thread_id=id and m.user_id=auth.uid()));
create policy "Users create threads" on public.direct_threads for insert to authenticated with check (auth.uid()=created_by);
create policy "Members read memberships" on public.direct_thread_members for select to authenticated using (exists(select 1 from public.direct_thread_members mine where mine.thread_id=thread_id and mine.user_id=auth.uid()));
create policy "Thread creators add members" on public.direct_thread_members for insert to authenticated with check (exists(select 1 from public.direct_threads t where t.id=thread_id and t.created_by=auth.uid()) or user_id=auth.uid());
create policy "Members read messages" on public.direct_messages for select to authenticated using (exists(select 1 from public.direct_thread_members m where m.thread_id=thread_id and m.user_id=auth.uid()));
create policy "Members send messages" on public.direct_messages for insert to authenticated with check (auth.uid()=sender_id and exists(select 1 from public.direct_thread_members m where m.thread_id=thread_id and m.user_id=auth.uid()));
