# Service Bookings — Design

**Date:** 2026-09-02
**Baseline commit:** `0a04d52`
**Status:** approved 2026-09-02
**Money posture:** `payments_enabled` stays FALSE. This design describes a path
that cannot move a cent until that flag flips, which is a separate reviewed event.

## Problem

A member can list a grooming, boarding or training service today, and a customer
can message them about it. That is the whole feature — `startServiceInquiry`
opens a conversation and hands off. Nothing is booked, no time is agreed, and no
money moves.

Transport is the exception, and it works: a transporter is an approved member
with a Stripe Connect account, their payout leg is created at pickup, and they
are paid from held funds at release. The migration states why it is shaped that
way:

> transport is booked INSIDE checkout. It is the only shape where "the
> transporter is always paid" is structurally true rather than a promise,
> because the platform is holding the money at the moment the obligation arises.

Transport gets that safety by riding an animal purchase that is already holding
money. A standalone grooming appointment has no order behind it, so the same
safety has to be built rather than inherited.

## The distinction this design does NOT cover

Dailen named two kinds of service, and they are different products:

- **Member services** — a Scrlpets member lists a service. Money flows through
  the platform. **This design.**
- **Partner companies** — an external company is plugged in, the customer pays
  the company, and Scrlpets takes a percentage. **Not this design.**

Partner companies are deliberately separate: different legal surface
(disclosure, tax, who owes whom), different data, and no member identity to hang
approval on. Nothing for it exists in the schema today.

**It is also the affiliate primitive, pointed the other way** — a party who did
not make the sale earning a cut of it. Designing it carefully yields most of the
affiliate program as configuration. It gets its own spec.

## Decision: a booking IS an order

Not a parallel system. `orders` does not filter on `listing_kind`, so a service
listing takes an order exactly as an animal does — same table, same state
machine, same fee model, same refund path, same admin dispute queue.

The alternative — a `bookings` table with its own lifecycle — would mean a second
money path, a second dispute story, and a second place for every guard already
written to be got wrong. The order machine is the thing that has been probed 25
ways; a booking should inherit that rather than re-earn it.

What is genuinely new is narrow: **services have no *when*.** A booking needs a
scheduled window, and that is the only new column set.

## Money flow — unchanged

```
funds_held → (provider marks complete) → inspection → released
```

Buyer pays at booking. The platform holds it. The provider marks the job
complete, which opens the inspection window the listing already carries
(`listings.inspection_hours`, 24–336, default 24). The customer disputes inside
that window, or `runScheduledJobs` auto-releases when it elapses — the same cron
path that already releases animal orders, because a window elapsing is a fact
about time.

Fees are the ruled ones: seller 5% (2.5% on Pro), buyer 3% capped at $150.

**No new money code.** This is the existing order machine with a service on the
other end.

## "Done", and the two guards

Grooming has no delivery moment and no handover code. Completion is therefore
**the provider's claim, not proof** — and the inspection window is what makes
that safe, exactly as it does when an animal arrives.

Two failure modes transport does not have, because transport confirms both
pickup and delivery:

### The provider ghosts

The appointment passes, nobody marks anything, and the customer's money is held
indefinitely. **A booking not completed within a grace period after its scheduled
end auto-cancels and refunds in full.** `runScheduledJobs` already runs this
shape for overdue shipments.

**Grace period: 24 hours after the scheduled end.** This number is a guess and is
recorded as one. Too short and a provider running late loses the payment; too
long and a customer is out of pocket for days. Real bookings correct it.

### The customer ghosts

They booked, paid, and did not show. The provider held the slot. **The provider
may mark complete anyway**, and the inspection window is where the customer
objects. The platform does not adjudicate attendance up front; it gives the
customer a window and an admin a queue.

## Explicitly out of scope

- **Availability calendars.** A provider publishing bookable slots is a
  scheduling system and a larger build than everything above. First version: the
  customer proposes a time, the provider accepts or declines.
- **Recurring bookings.**
- **Deposits / partial payment.** The columns exist. Adding a second money shape
  before the first has run once is guessing.
- **Partner companies.** Own spec, as above.

## Testing

The repo's existing discipline: RED before GREEN as separate commits, negative
controls on anything whose green could be vacuous, `./ship-verify.sh` before any
merge.

Specific risks worth naming:

- **The auto-cancel and the auto-release are both time-triggered and opposite.**
  A bug that fires the wrong one refunds a provider who did the work, or pays one
  who never showed. Each needs a probe that proves the *other* does not fire.
- **A booking is an order, so every existing order guard now applies to a shape
  it was not written for.** The probes that pin the money machine must be re-run
  against a service order, not assumed to carry over.
- **`payments_enabled` is FALSE throughout.** Every definer will refuse, and that
  refusal is the assertion — it proves the button reached the database rather
  than being swallowed in the client.

## Success criteria

- A customer can propose a time for a listed service and the provider can accept.
- Accepting creates an order that behaves like every other order.
- A completed booking releases to the provider after the inspection window.
- A booking the provider never completes refunds the customer automatically.
- `payments_enabled` and `subscriptions_enabled` still FALSE.
