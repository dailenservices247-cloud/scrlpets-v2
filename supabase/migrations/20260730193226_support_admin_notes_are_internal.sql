-- support_tickets.admin_notes was readable by the person the notes are about.
--
-- The SELECT policy is `profile_id = auth.uid() OR is_platform_admin()`, which
-- is right for the ticket but wrong for this one column: RLS filters ROWS, not
-- columns, so "you can see your own ticket" also meant "you can see what staff
-- wrote about you while handling it". Probed on dev as the ticket's author:
-- the internal note came back in full.
--
-- Column privileges are the only thing that filters columns, so the grant is
-- withdrawn from both client roles. That includes admins — Supabase runs every
-- signed-in request as `authenticated` and admin-ness is application data, not
-- a database role — so admin reads move to a SECURITY DEFINER function that
-- checks is_platform_admin() itself.

revoke select (admin_notes) on public.support_tickets from anon, authenticated;

/**
 * The notes for one ticket, for platform admins only. Returns null rather than
 * raising for a non-admin, so a caller that forgets to check simply renders
 * nothing instead of leaking through an error message.
 */
create or replace function public.admin_ticket_notes(target_ticket uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin()
      then (select t.admin_notes from public.support_tickets t where t.id = target_ticket)
    else null
  end;
$$;
