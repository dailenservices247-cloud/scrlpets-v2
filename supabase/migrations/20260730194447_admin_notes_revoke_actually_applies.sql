-- 20260730193226 did not actually close the admin_notes leak.
--
-- It ran `revoke select (admin_notes) ... from anon, authenticated`, which is a
-- no-op while those roles hold SELECT on the WHOLE table: a column-level revoke
-- cannot subtract from a table-level grant. Postgres accepts the statement and
-- changes nothing, so the migration "succeeded" and the column stayed readable.
-- Re-probing as the ticket author is what caught it — the query referencing
-- admin_notes still planned and ran instead of raising 42501.
--
-- The working shape is the inverse: drop the table-wide grant, then grant back
-- exactly the columns clients may read. Anything added to this table in future
-- is therefore invisible to clients until someone grants it deliberately, which
-- is the safer default for a table that holds staff notes about members.

revoke select on public.support_tickets from anon, authenticated;

grant select (
  id,
  profile_id,
  email,
  name,
  subject,
  message,
  category,
  status,
  resolved_at,
  created_at
) on public.support_tickets to anon, authenticated;
