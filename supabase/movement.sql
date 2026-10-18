-- Project Doesn't Work. Isolated, server-owned public-discussion data.
-- Apply before enabling the /api/movement routes. No public browser table grants.
create extension if not exists pgcrypto;
create table if not exists public.movement_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 8 and 140),
  description text not null check (char_length(description) between 30 and 3000),
  display_name text not null default 'Community member',
  contact_email text,
  location_label text,
  verse_ref text not null,
  verse_url text not null,
  how_help_others text not null,
  repeatable_step text not null,
  requested_amount numeric(12,2) not null default 0 check (requested_amount between 0 and 1000000),
  beneficiaries_target integer not null default 3 check (beneficiaries_target between 1 and 1000000),
  status text not null default 'discussion' check (status in ('discussion','vetting','approved','declined','active','completed')),
  prayer_count integer not null default 0 check (prayer_count >= 0),
  video_verified boolean not null default false,
  amount_spent numeric(12,2) not null default 0,
  beneficiaries_verified integer not null default 0,
  outcome_summary text,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists movement_requests_created_idx on public.movement_requests (created_at desc);
create table if not exists public.movement_ideas (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.movement_requests(id) on delete cascade,
  display_name text not null default 'Community member',
  body text not null check (char_length(body) between 12 and 1500),
  kind text not null check (kind in ('no-money','community-action','possible-funding')),
  created_at timestamptz not null default now()
);
create index if not exists movement_ideas_req_idx on public.movement_ideas(request_id,created_at);
create table if not exists public.movement_prayers (
  request_id uuid not null references public.movement_requests(id) on delete cascade,
  visitor_digest text not null,
  created_at timestamptz not null default now(),
  primary key (request_id,visitor_digest)
);
create or replace function public.movement_increment_prayer_count() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  update public.movement_requests set prayer_count=prayer_count+1 where id=new.request_id;
  return new;
end;
$$;
drop trigger if exists movement_prayer_counter on public.movement_prayers;
create trigger movement_prayer_counter after insert on public.movement_prayers
for each row execute function public.movement_increment_prayer_count();
alter table public.movement_requests enable row level security;
alter table public.movement_ideas enable row level security;
alter table public.movement_prayers enable row level security;
revoke all on public.movement_requests,public.movement_ideas,public.movement_prayers from anon,authenticated;
grant select,insert,update,delete on public.movement_requests,public.movement_ideas,public.movement_prayers to service_role;
revoke all on function public.movement_increment_prayer_count() from public,anon,authenticated;
grant execute on function public.movement_increment_prayer_count() to service_role;
-- Service-only reads/writes, with public output allowlisted by the Atlas API.

-- Community preference: one anonymous-browser vote per need (not a binding grant ballot).
alter table public.movement_requests add column if not exists no_money_yes integer not null default 0;
alter table public.movement_requests add column if not exists no_money_no integer not null default 0;
alter table public.movement_requests add column if not exists no_money_unsure integer not null default 0;
create table if not exists public.movement_votes (
 request_id uuid not null references public.movement_requests(id) on delete cascade,
 visitor_digest text not null,
 answer text not null check(answer in ('yes','no','unsure')),
 created_at timestamptz not null default now(),
 primary key(request_id,visitor_digest)
);
create or replace function public.movement_increment_vote_count() returns trigger
language plpgsql security invoker set search_path=public as $
begin
 update public.movement_requests set
  no_money_yes=no_money_yes+case when new.answer='yes' then 1 else 0 end,
  no_money_no=no_money_no+case when new.answer='no' then 1 else 0 end,
  no_money_unsure=no_money_unsure+case when new.answer='unsure' then 1 else 0 end
 where id=new.request_id;
 return new;
end; $;
drop trigger if exists movement_vote_counter on public.movement_votes;
create trigger movement_vote_counter after insert on public.movement_votes
for each row execute function public.movement_increment_vote_count();
alter table public.movement_votes enable row level security;
revoke all on public.movement_votes from anon,authenticated;
grant select,insert,update,delete on public.movement_votes to service_role;
revoke all on function public.movement_increment_vote_count() from public,anon,authenticated;
grant execute on function public.movement_increment_vote_count() to service_role;

-- Review audit events: immutable history generated by a database trigger.
create table if not exists public.movement_review_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.movement_requests(id) on delete cascade,
 previous_status text,
 new_status text,
 video_verified boolean,
 amount_spent numeric(12,2),
 beneficiaries_verified integer,
 outcome_summary text,
 decision_note text,
 created_at timestamptz not null default now()
);
create or replace function public.movement_record_review() returns trigger
language plpgsql security invoker set search_path=public as $
begin
 if old.status is distinct from new.status
    or old.video_verified is distinct from new.video_verified
    or old.amount_spent is distinct from new.amount_spent
    or old.beneficiaries_verified is distinct from new.beneficiaries_verified
    or old.outcome_summary is distinct from new.outcome_summary
    or old.decision_note is distinct from new.decision_note then
   insert into public.movement_review_events
     (request_id,previous_status,new_status,video_verified,amount_spent,beneficiaries_verified,outcome_summary,decision_note)
   values(new.id,old.status,new.status,new.video_verified,new.amount_spent,new.beneficiaries_verified,new.outcome_summary,new.decision_note);
 end if;
 return new;
end; $;
drop trigger if exists movement_review_audit on public.movement_requests;
create trigger movement_review_audit after update on public.movement_requests
for each row execute function public.movement_record_review();
alter table public.movement_review_events enable row level security;
revoke all on public.movement_review_events from anon,authenticated;
grant select,insert,update,delete on public.movement_review_events to service_role;
revoke all on function public.movement_record_review() from public,anon,authenticated;
grant execute on function public.movement_record_review() to service_role;

notify pgrst,'reload schema';
