-- E2E CLEANUP. Destructive, and this project's database is production
-- (see A10: dev and prod share `irpayabloogarxwtjmrf`).
--
-- Approved and run by Dailen on 2026-07-27. Counts before the run:
--   listings   74 of 78  E2E leftovers
--   posts     256 of 269 E2E leftovers
--   creatures  10        E2E
--   brands     89        E2E
-- All were publicly visible on /, /shop and brand pages.
--
-- Every predicate matches an explicit 'E2E ' prefix, so a row with a NULL
-- title/body/name simply does not match — no NULL-elimination surprises.
--
-- Only the four parent sets are deleted. Every dependent FK is CASCADE or SET
-- NULL, verified against pg_constraint before running:
--   CASCADE  : comments, comment_reactions, post_reactions, saved_posts,
--              animal_records, animal_eligibility, brand_memberships,
--              brand_content_events, brand_membership_events, litters,
--              services, seller_programs
--   SET NULL : listing_inquiries, buyer_applications, orders, and the
--              brand_id/creature_id columns on posts and listings
--
-- SET NULL on listings.creature_id would silently turn a surviving animal
-- listing into a shop product, so this was checked first: zero non-E2E rows
-- referenced any E2E creature or brand, and zero orders referenced an E2E
-- listing.

begin;

delete from public.listings where title like 'E2E %';
delete from public.posts where body like 'E2E %';
delete from public.creatures where name like 'E2E %';
delete from public.brands where name like 'E2E %';

commit;
