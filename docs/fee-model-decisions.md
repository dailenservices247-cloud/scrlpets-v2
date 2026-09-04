# Fee model — decisions and open questions

**Date:** 2026-09-03
**Baseline commit:** `8e397f9`
**Amends:** `AI Hub/PRDs/scrlpets-v2-money-architecture-2026-08-10.md`
**Status:** `payments_enabled` FALSE. Nothing here has ever charged anyone.

Rates as ruled and as they stand in `subscription_tiers`: seller **5%** free /
**2.5%** Pro, buyer **3% capped at $150**, Pro **$29.99/mo · $149/6mo ·
$279/12mo**.

## What a transaction actually nets

Measured, not estimated. Stripe is 2.9% + 30c on the full charged amount, and
the charged amount is `amount_cents + transport_cents + buyer_fee_cents`
(`order_due_cents`). The buyer fee is calculated on `l.price_cents` — the animal
only, not transport.

| Transaction | Seller | Buyer | Gross | Stripe | Net |
| --- | ---: | ---: | ---: | ---: | ---: |
| $2,000 animal, free seller | $100 | $60 | $160 | ~$60 | **~$100** |
| $2,000 animal, Pro seller | $50 | $60 | $110 | ~$60 | **~$50** |
| $500 adoption (at the cap) | $25 | $15 | $40 | ~$15 | **~$25** |
| $150 boarding | $7.50 | $4.50 | $12 | ~$4.80 | **~$7** |
| $80 grooming | $4 | $2.40 | $6.40 | ~$2.70 | **~$3.70** |
| $30 nail trim | $1.50 | $0.90 | $2.40 | ~$1.20 | **~$1.20** |
| Transport leg | $0 | $0 | $0 | ~2.9% of it | **negative** |

**Animals are the business; services are engagement.** One puppy sale nets what
roughly 27 nail trims do. Bookings earn their place by making the app worth
opening weekly, not by carrying revenue.

## FINDING: transport is not zero-margin, it is negative

`book_transport_with_the_order` rules that *"the platform's cut is on the ANIMAL,
never on the transporter's fee"*. That ruling is sound and is not in question.

What it does not address: the transporter receives `transport_cents` **in full**,
while Stripe charges the platform 2.9% of a total that **includes** that
transport. So the platform pays to carry the transporter's money.

```
$2,000 animal, no transport   → net ~$99.96
$2,000 animal + $300 transport → net ~$91.26
                                  -------
                        difference   $8.70  = 2.9% of $300
```

Nobody decided this. "Don't take two cuts of one transaction" is a decision.
Silently absorbing the processing cost of someone else's payout is a side effect.

### RULED: recover the cost, not a margin

Recovering a cost is not taking a cut, and that is the distinction the original
rule does not draw. The transporter's leg becomes net of payment processing
(~3%): $291 on a $300 job. Explainable in one sentence — *payment processing
comes out of the payment.*

Rejected: a real 10–15% margin. Defensible on value delivered (booking,
guaranteed payment, approval program, buyer verification, custody protocol), but
it makes transport more expensive, and transport is what makes remote animal
sales possible at all. That is the high-margin business; do not tax its enabler.

Rejected: leaving it. $8.70 is noise at launch and real at a hundred transports
a month, and the fix does not get easier later.

**BANKED. Named unblock: the first month with meaningful transport volume.**
The decision is made; the implementation waits until the number matters.

## The buyer fee is structural, not a framing problem

The price is agreed **off-platform** — a breeder quotes $2,000, the buyer agrees,
and only then does the app add $60. Compare Airbnb, where the price is *set* on
the platform and the fee is inside the number from the first screen.

So the buyer experiences the fee as **a surcharge for using the app**, at the
exact moment they are deciding whether to trust an app with $2,000 and a live
animal. That is not wording.

### RULED: show the all-in price on the listing

`$2,060 — includes buyer protection`, on the listing, not at checkout. A display
change. It converts a checkout surprise into a listing-time fact, and checkout
then introduces no number the buyer has not already accepted.

### HELD, not rejected: move all fees to the seller side

The buyer would pay exactly the listed price, forever; the seller absorbs ~8%.
Cleaner for buyers, heavier on the supply side being courted.

**Not decidable today** — with zero completed transactions there is no
abandonment data, and this would be guessing dressed as strategy. Revisit if
checkout abandonment appears after real volume.

## Standing positions on the rest

| Item | Position |
| --- | --- |
| `subscriptions_enabled` FALSE | **Leave.** Pro is unsellable until sellers have volume. Correct sequencing, not an oversight |
| Pro breaks even at $1,200/mo of sales | **Do not push Pro at launch.** The number is honest and it will convert when it is true |
| Stripe's fee is never returned on refunds | **Accept.** ~2.9% out with zero revenue on every refunded order. That is the cost of the buyer protection being sold, not an accounting error |
| Fee credits erode up to 50% of the seller fee | **Leave inert.** `redeem_fee_credit` still has no caller. Model the revenue hit before wiring it |

## The model, stated plainly

Two levers only: **transaction fees and Pro.** Nothing else earns. No listing
fees, no boosts, no featured placement — and brand pages, groups and guides are
deliberately free under the 2026-08-23 ruling that gating them is negative-sum
for a marketplace.

Thin, and coherent: **the platform earns when its users earn.**

**Resist listing fees and pay-to-rank specifically.** Both charge for access or
position rather than for a completed sale, both are the shape of the legacy app's
fake-badge economics, and both corrode the trust the product exists to sell.
