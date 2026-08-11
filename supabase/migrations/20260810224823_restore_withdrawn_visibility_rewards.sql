-- Reverts an unmandated change. `20260810223834_points_are_fee_funded.sql`
-- re-enabled boost_post and feature_listing on the reasoning that they cost the
-- platform nothing and had been "switched off". They had not been switched off —
-- they were DELIBERATELY WITHDRAWN, and rewards-standing.spec.ts documents that
-- decision explicitly: off the shelf, refused at the database, and absent from
-- /rewards entirely because a withdrawn reward shown greyed out still advertises
-- it.
--
-- The reason for that withdrawal is not recorded here, which is precisely why
-- reversing it was not this migration's call to make. Restored to withdrawn.
--
-- fee_credit_10 is a different case and stays disabled — see the migration that
-- follows this one in intent: it is a FLAT, UNCAPPED credit, and the capped
-- order-scoped redeem_fee_credit() supersedes it. Leaving both live would keep
-- the uncapped path open, which is the hole the cap exists to close.

update public.reward_catalog set enabled = false
 where key in ('boost_post', 'feature_listing');
