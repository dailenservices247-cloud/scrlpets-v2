-- 20260730194215 added two trailing parameters to upsert_guide with CREATE OR
-- REPLACE. Changing the parameter COUNT does not replace a function — it
-- defines a second one. Both now had defaults covering a 6-argument call, so
-- the existing call in src/lib/guides/actions.ts became ambiguous:
--
--   42725: function public.upsert_guide(...6 args...) is not unique
--
-- Guide authoring was broken by the migration meant to extend it. The push
-- reported success; only calling the function the way the app calls it found
-- this. Drop the superseded 6-argument version so one definition remains.

drop function if exists public.upsert_guide(text, text, text, text, text, boolean);
