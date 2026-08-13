-- The paywall stops being decorative — for the two entitlements that describe a
-- capability a member actually has.
--
-- tier_entitlements and has_entitlement() have existed since the subscription
-- work and NOTHING called either. Brand pages and merch were sold as Pro
-- features and gated by nothing.
--
-- FLAG-CONDITIONAL, and that is correctness rather than caution.
-- `subscriptions_enabled` is FALSE, so nobody holds Pro. Enforcing today would
-- not turn a paywall on; it would remove capabilities from every existing
-- member. The gate is written now and arms itself when subscriptions do, exactly
-- like the payout gate on animal listings.
--
-- AT THE DATABASE, not in a server action: a check in application code is a
-- check the next caller can forget.
--
-- WHAT I GOT WRONG, recorded so it is not repeated. The entitlement list was
-- written from the paywall table without checking who can perform each action.
-- Of the seven, only TWO are member capabilities:
--
--   brand_page          real — members create brands (owner_id = auth.uid())
--   sell_merch          real — a listing with no animal attached
--
--   create_group        NOT gateable. upsert_group requires is_platform_admin();
--                       members cannot create groups at all. Gating it would be
--                       theatre, and rewriting the function to allow it would be
--                       a privilege escalation dressed as a paywall.
--   publish_guide       NOT gateable, same reason — upsert_guide is admin-only,
--                       which matches guides being authored and approved rather
--                       than published by members.
--   boost               nothing to gate: the visibility rewards are WITHDRAWN.
--   featured_placement  the feature does not exist yet.
--   analytics           a read surface with no write to guard; belongs in the UI.
--
-- Those five rows stay in tier_entitlements: they are what the plans PROMISE,
-- and the promise is not wrong — the capabilities simply do not exist yet. What
-- would be wrong is inventing a capability so a gate has something to guard.

-- ============================================================== brand pages
drop policy if exists "brand pages are a paid feature" on public.brands;
create policy "brand pages are a paid feature" on public.brands
as restrictive for insert to authenticated
with check (
  not public.is_flag_enabled('subscriptions_enabled')
  or public.has_entitlement((select auth.uid()), 'brand_page')
);

-- =================================================================== merch
/**
 * A listing with no animal attached is merchandise, and selling it is the Pro
 * feature. An ANIMAL listing is deliberately untouched: that is the platform's
 * whole purpose and it earns a fee on every sale, so gating it behind a
 * subscription would be charging twice for the thing the free tier exists to
 * allow.
 */
drop policy if exists "selling merchandise is a paid feature" on public.listings;
create policy "selling merchandise is a paid feature" on public.listings
as restrictive for insert to authenticated
with check (
  creature_id is not null
  or not public.is_flag_enabled('subscriptions_enabled')
  or public.has_entitlement((select auth.uid()), 'sell_merch')
);
