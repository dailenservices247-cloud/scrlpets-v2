-- admin_ticket_notes was the odd one out.
--
-- Every other staff-notes definer in this set — admin_redemption_notes from
-- 20260730200412, and the trust-core definers before it — explicitly revokes
-- EXECUTE from anon and public and grants it back to authenticated only.
-- admin_ticket_notes (20260730193226) was written without that, so it inherited
-- the default EXECUTE-to-PUBLIC.
--
-- This is NOT a leak: the function body gates on is_platform_admin() and
-- returns null to everyone else, which is why it was correctly left alone
-- rather than folded into an unrelated security fix. It is normalised here so
-- the pattern is uniform and the next person copying one of these picks up the
-- restrictive shape by default.

revoke execute on function public.admin_ticket_notes(uuid) from anon, public;
grant execute on function public.admin_ticket_notes(uuid) to authenticated;
