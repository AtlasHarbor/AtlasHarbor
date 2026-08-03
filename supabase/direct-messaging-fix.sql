-- Fix direct-message membership policies without recursive RLS lookups. Safe to rerun.
create or replace function public.is_direct_thread_member(target_thread uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.direct_thread_members where thread_id=target_thread and user_id=target_user)
$$;
create or replace function public.is_direct_thread_creator(target_thread uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.direct_threads where id=target_thread and created_by=target_user)
$$;
revoke all on function public.is_direct_thread_member(uuid,uuid) from public;
revoke all on function public.is_direct_thread_creator(uuid,uuid) from public;
grant execute on function public.is_direct_thread_member(uuid,uuid),public.is_direct_thread_creator(uuid,uuid) to authenticated;

drop policy if exists "Members read threads" on public.direct_threads;
drop policy if exists "Members read memberships" on public.direct_thread_members;
drop policy if exists "Thread creators add members" on public.direct_thread_members;
drop policy if exists "Members read messages" on public.direct_messages;
drop policy if exists "Members send messages" on public.direct_messages;
create policy "Members read threads" on public.direct_threads for select to authenticated using(public.is_direct_thread_member(id));
create policy "Members read memberships" on public.direct_thread_members for select to authenticated using(public.is_direct_thread_member(thread_id));
create policy "Thread creators add members" on public.direct_thread_members for insert to authenticated with check(public.is_direct_thread_creator(thread_id) or user_id=auth.uid());
create policy "Members read messages" on public.direct_messages for select to authenticated using(public.is_direct_thread_member(thread_id));
create policy "Members send messages" on public.direct_messages for insert to authenticated with check(auth.uid()=sender_id and public.is_direct_thread_member(thread_id));
