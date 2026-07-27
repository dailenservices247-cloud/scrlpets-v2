-- E2E CLEANUP — REVIEW BEFORE RUNNING. Destructive, and this project's
-- database is production (see A10: dev and prod share `irpayabloogarxwtjmrf`).
--
-- Counts at 2026-07-27 before Phase 4 deploy:
--   listings   74 of 78  are E2E leftovers
--   posts     256 of 269 are E2E leftovers
--   creatures  10        E2E
--   brands     89        E2E
-- These are visible to the public on /, /shop and brand pages right now.
--
-- Every predicate matches an explicit 'E2E ' prefix, so a row with a NULL
-- title/body/name simply does not match — no NULL-elimination surprises.

begin;

-- Dependent rows first so foreign keys do not block the parents.
delete from public.buyer_applications a
 using public.listings l where a.listing_id = l.id and l.title like 'E2E %';
delete from public.listing_inquiries i
 using public.listings l where i.listing_id = l.id and l.title like 'E2E %';
delete from public.comments c
 using public.posts p where c.post_id = p.id and p.body like 'E2E %';
delete from public.post_reactions r
 using public.posts p where r.post_id = p.id and p.body like 'E2E %';
delete from public.saved_posts s
 using public.posts p where s.post_id = p.id and p.body like 'E2E %';

delete from public.listings where title like 'E2E %';
delete from public.posts where body like 'E2E %';
delete from public.animal_records ar
 using public.creatures c where ar.creature_id = c.id and c.name like 'E2E %';
delete from public.animal_eligibility ae
 using public.creatures c where ae.creature_id = c.id and c.name like 'E2E %';
delete from public.creatures where name like 'E2E %';
delete from public.brand_memberships m
 using public.brands b where m.brand_id = b.id and b.name like 'E2E %';
delete from public.brands where name like 'E2E %';

-- Verify before committing.
select 'listings left: '||count(*)::text from public.listings where title like 'E2E %'
union all select 'posts left: '||count(*)::text from public.posts where body like 'E2E %'
union all select 'brands left: '||count(*)::text from public.brands where name like 'E2E %';

commit;
