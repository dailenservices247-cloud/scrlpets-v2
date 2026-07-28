-- Two more pieces of drift, found by diffing 830 objects between the original
-- database and the fresh one.

-- 1. brands.banner_url was missing. The empty brand_identity migration cost
--    more than the function: the column went with it. set_brand_identity
--    updates banner_url, so brand banners were broken on any fresh database.
alter table public.brands add column if not exists banner_url text;

-- 2. `anon` could execute thirteen privileged functions. Those grants had been
--    revoked by hand on the original database during an earlier hardening pass
--    and the revokes were never written down, so a fresh project came up
--    permissive. Most of these check auth.uid() internally, but handle_new_user
--    was called out and revoked specifically, and defence in depth is the whole
--    point of revoking in the first place.
--
--    set_brand_identity additionally had EXECUTE for PUBLIC, because the
--    backfill recreated it and PUBLIC gets EXECUTE on new functions by default.
revoke execute on function public.set_brand_identity(uuid, text, text) from public;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'add_brand_member','brand_membership_role','change_brand_member_role',
         'enforce_content_identity_immutable','handle_new_user','is_brand_manager',
         'is_brand_member','remove_brand_member','set_brand_identity',
         'soft_delete_managed_listing','soft_delete_own_listing',
         'start_listing_inquiry','touch_updated_at'
       )
  loop
    execute format('revoke execute on function %s from anon', fn.sig);
  end loop;
end $$;
