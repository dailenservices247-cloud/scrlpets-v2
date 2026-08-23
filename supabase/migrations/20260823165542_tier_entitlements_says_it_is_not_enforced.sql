-- The rows stay; the misreading does not.
--
-- After the policy drop, nothing anywhere reads tier_entitlements — no RLS
-- policy, no server action, and TierList never rendered it. The rows are inert.
-- But inert data that LOOKS like a contract is how the next person builds a
-- gate from it, which is the same failure as a parity ledger nobody re-reads.
-- So the table says out loud what it is.

comment on table public.tier_entitlements is
  'NOT ENFORCED, and not a customer-facing promise. Nothing reads this table: '
  'the brand_page and sell_merch policies were dropped in '
  '20260823_pro_is_the_fee_cut_and_the_pause, and TierList renders only price, '
  'fee rate and subscription_tiers.description — which is the ONLY promise a '
  'member ever sees. Free reads "Everything on Scrlpets"; Pro reads "A 2.5% fee '
  'instead of 5%". Pro is the fee cut plus a pause on the prepaid terms. '
  'Of the rows here, create_group and publish_guide were never gateable '
  '(admin-only RPCs), boost is withdrawn, featured_placement does not exist, '
  'analytics was reverted as a breeder''s own data, and brand_page/sell_merch '
  'were withdrawn because gating a brand page makes sellers less credible and '
  'the marketplace thinner. DO NOT build a gate from these rows. The mechanism '
  '(has_entitlement) is kept for a genuinely additive paid surface — derived '
  'analytics, market medians — at which point add one row and one policy.';

comment on function public.has_entitlement(uuid, text) is
  'Mechanism only; currently has no callers. Kept for a future additive paid '
  'feature. See the comment on tier_entitlements before gating anything.';
