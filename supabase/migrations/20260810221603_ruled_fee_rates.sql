-- The ruled rates. `subscription_tiers` still carried 6% free / 3% Pro, which
-- predates the 2026-08-10 money-architecture ruling of 5% free / 2.5% Pro.
--
-- Caught by the step-4 probe rather than by reading: the fee model was correct
-- and was faithfully applying the wrong numbers. Rates live in exactly one place
-- now, so this is the only row that needs to change.
--
-- Pro breaks even at $1,200/month of completed sales (29.99 / 0.025), which is
-- the honest number for the upgrade copy.

update public.subscription_tiers set fee_bps = 500,
  description = 'Everything on Scrlpets, with the standard 5% fee on each completed sale.'
 where key = 'free';

update public.subscription_tiers set fee_bps = 250,
  description = 'A 2.5% fee on each completed sale instead of 5%. Pays for itself at about $1,200 of sales a month.'
 where key = 'pro';
