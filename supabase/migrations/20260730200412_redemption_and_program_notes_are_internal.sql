-- The staff-notes leak had two more instances than the one that got fixed.
--
-- 20260730194447 closed support_tickets by dropping the table-wide SELECT and
-- granting back only the columns a member may read. The same shape — an
-- own-read policy over a table that also holds text an admin-only definer
-- writes ABOUT that member — is equally true of redemptions and
-- seller_programs. RLS filters rows there too, so "you can see your own row"
-- again meant "you can see what staff wrote while handling it".
--
-- Probed on dev as a non-admin fixture: support_tickets now raises 42501, but
-- `redemptions.admin_notes` and `seller_programs.review_notes` both planned and
-- ran, the latter returning five of the fixture's own rows with the reviewer
-- columns attached.
--
-- Same remedy, and for the same reason it is an allowlist rather than a column
-- revoke: a column-level revoke cannot subtract from a table-level grant.

-- ============================================================== REDEMPTIONS
-- admin_notes is the reviewer's trail; reviewed_by is which staff member
-- decided. /rewards renders neither — a redemption there is its reward, its
-- points and its status — so nothing member-facing loses anything.
revoke select on public.redemptions from anon, authenticated;

grant select (
  id,
  profile_id,
  reward_key,
  points_spent,
  status,
  target_post_id,
  reviewed_at,
  created_at
) on public.redemptions to authenticated;

/**
 * One redemption's notes, for platform admins only. Mirrors
 * admin_ticket_notes(): returns null rather than raising for a non-admin, so a
 * caller that forgets to check renders nothing instead of leaking through an
 * error message.
 */
create or replace function public.admin_redemption_notes(target_redemption uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin()
      then (select r.admin_notes from public.redemptions r where r.id = target_redemption)
    else null
  end;
$$;

revoke execute on function public.admin_redemption_notes(uuid) from anon, public;
grant execute on function public.admin_redemption_notes(uuid) to authenticated;

-- ========================================================== SELLER PROGRAMS
-- review_notes gets no sibling accessor because no surface reads it: the admin
-- queue lists `pending` rows, which by definition have not been reviewed, and
-- the applicant's own settings page carried the field through its type without
-- ever rendering it. The durable record of a decision is verification_events,
-- which review_seller_program() already writes the same note into and which is
-- admin-read-only — so nothing is lost by closing the copy on the row.
--
-- Telling an applicant why they were rejected is a real thing to want, and this
-- is deliberately not it. Reusing the staff note for it means whoever types the
-- note cannot tell who will read it, which is the hazard this whole class of
-- fix is about. That feature wants its own column.
revoke select on public.seller_programs from anon, authenticated;

grant select (
  id,
  profile_id,
  brand_id,
  program_type,
  credential_number,
  issuing_authority,
  public_url,
  status,
  reviewed_at,
  created_at
) on public.seller_programs to authenticated;
