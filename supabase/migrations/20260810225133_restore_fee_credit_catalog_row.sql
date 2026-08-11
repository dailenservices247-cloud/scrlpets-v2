-- Restores fee_credit_10 to the state a previous session deliberately chose and
-- documented: ENABLED in the catalog, refused by the payments_enabled flag until
-- there is a fee to discount. The reasoning recorded in rewards-services.spec.ts
-- is sound — "a catalog row that is permanently disabled and a reward that is
-- waiting on a flag are different states, and the error says which."
--
-- Disabling it left every reward in the catalog off, which rendered /rewards as
-- an empty container. That is worse than either design: the page stopped saying
-- anything at all.
--
-- The new capped, order-scoped redeem_fee_credit() stands alongside it. Both
-- being live is a question for Dailen, not something to settle by migration:
-- fee_credit_10 is a FLAT 750-points-for-$10 credit with no relationship to the
-- fee it discounts, so it cannot carry the 50% cap. It is also inert today —
-- payments_enabled is false, so nothing can be redeemed through it either way.
-- Retiring it is a product decision with a UI consequence, and it belongs to
-- whoever owns the rewards page.

update public.reward_catalog set enabled = true where key = 'fee_credit_10';
