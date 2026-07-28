-- Brand identity: banner and avatar, settable only by a brand manager.
--
-- BACKFILLED 2026-07-28. This file was EMPTY. The original `db push` recorded
-- it in the migration history without applying any DDL, and the function was
-- then repaired by hand directly against dev — so it existed in exactly one
-- database and in no source file. Standing up a fresh production project is
-- what surfaced it: prod came up with 46 functions to dev's 47.
--
-- Definition below is `pg_get_functiondef` from the live dev database, so the
-- two are now identical by construction rather than by memory.

create or replace function public.set_brand_identity(
  target_brand_id uuid,
  new_banner_url text default null::text,
  new_avatar_url text default null::text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  affected integer;
begin
  if not public.is_brand_manager(target_brand_id) then
    raise exception 'brand_permission_denied';
  end if;
  update public.brands
     set banner_url = coalesce(new_banner_url, banner_url),
         avatar_url = coalesce(new_avatar_url, avatar_url)
   where id = target_brand_id;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$fn$;
