-- Trigger functions should not be directly callable by application roles.
--
-- Postgres fires a trigger function as part of the statement that fires it;
-- the calling role needs no EXECUTE grant for that to work. A grant only
-- enables calling it DIRECTLY, which nothing legitimate does. handle_new_user
-- in particular inserts a profile row for an arbitrary id.
--
-- The original database had these revoked by hand. Written down here so every
-- environment gets them.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.enforce_content_identity_immutable() from anon, authenticated;
