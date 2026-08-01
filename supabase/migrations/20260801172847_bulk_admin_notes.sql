-- Set-returning versions of the staff-note accessors, so an admin queue reads
-- its notes in ONE round trip instead of one per row.
--
-- The single-row functions were correct and stay (they are the right shape for
-- a detail view), but the queues call them inside Promise.all over up to 100
-- rows. Measured on this project: 100 parallel round trips is ~1.66 s against
-- ~0.15 s for one batched read, so this is ~1.5 s of latency at the cap.
--
-- Same authority as the single-row versions — is_platform_admin() is checked
-- inside, and a non-admin gets an empty set rather than an error, so a caller
-- that forgets to check renders nothing instead of leaking through a message.
-- Note the SQL body cannot be `stable` and use `= any(...)` on a null array
-- safely, hence the coalesce.

create or replace function public.admin_ticket_notes_bulk(target_tickets uuid[])
returns table (ticket_id uuid, notes text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.admin_notes
    from public.support_tickets t
   where public.is_platform_admin()
     and t.id = any(coalesce(target_tickets, '{}'::uuid[]));
$$;

revoke execute on function public.admin_ticket_notes_bulk(uuid[]) from anon, public;
grant execute on function public.admin_ticket_notes_bulk(uuid[]) to authenticated;

create or replace function public.admin_redemption_notes_bulk(target_redemptions uuid[])
returns table (redemption_id uuid, notes text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.admin_notes
    from public.redemptions r
   where public.is_platform_admin()
     and r.id = any(coalesce(target_redemptions, '{}'::uuid[]));
$$;

revoke execute on function public.admin_redemption_notes_bulk(uuid[]) from anon, public;
grant execute on function public.admin_redemption_notes_bulk(uuid[]) to authenticated;
