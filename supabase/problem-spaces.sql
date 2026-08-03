-- Run in the Supabase SQL editor. Safe to rerun.
create table if not exists public.problem_space_requests (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text not null,
  requester_name text not null,
  requested_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists problem_space_requests_status_created_idx on public.problem_space_requests(status,created_at desc);
alter table public.problem_space_requests enable row level security;
revoke all on public.problem_space_requests from anon,authenticated;
-- Requests and approvals go through the Atlas Harbor server using SUPABASE_SECRET_KEY.
-- Public clients do not receive direct table access.
