-- Run in Supabase SQL editor. Safe to rerun.
create table if not exists public.restaurant_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id text not null,
  restaurant_name text not null,
  body text not null check (char_length(body) between 3 and 1200),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurant_comments_restaurant_idx on public.restaurant_comments(restaurant_id,created_at desc);
alter table public.restaurant_comments enable row level security;
grant select on public.restaurant_comments to anon,authenticated;
grant insert,update,delete on public.restaurant_comments to authenticated;
drop policy if exists "Public reads restaurant comments" on public.restaurant_comments;
drop policy if exists "Users add restaurant comments" on public.restaurant_comments;
drop policy if exists "Users update own restaurant comments" on public.restaurant_comments;
drop policy if exists "Users delete own restaurant comments" on public.restaurant_comments;
create policy "Public reads restaurant comments" on public.restaurant_comments for select using (true);
create policy "Users add restaurant comments" on public.restaurant_comments for insert to authenticated with check (auth.uid()=user_id);
create policy "Users update own restaurant comments" on public.restaurant_comments for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users delete own restaurant comments" on public.restaurant_comments for delete to authenticated using (auth.uid()=user_id);
