-- Rollback for 20260727132634_trust_core. Documentation only.
-- Restore the pre-gate listing insert policy (no verification requirement).
drop policy if exists "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and (
    posting_as_type = 'person'
    or (posting_as_type = 'brand' and brand_id is not null and exists (
      select 1 from public.brand_memberships m
      where m.brand_id = listings.brand_id and m.profile_id = (select auth.uid())
    ))
  )
);
drop function if exists public.is_animal_listable(uuid);
drop function if exists public.attest_animal_eligibility(uuid);
drop function if exists public.review_seller_program(uuid, text, text);
drop function if exists public.is_verified_seller(uuid);
drop function if exists public.record_identity_result(uuid, text, text);
drop function if exists public.start_identity_verification(text);
drop function if exists public.is_platform_admin();
drop table if exists public.animal_eligibility;
drop table if exists public.seller_programs;
drop table if exists public.buyer_readiness;
drop table if exists public.identity_verifications;
drop table if exists public.verification_events;
drop table if exists public.platform_roles;
