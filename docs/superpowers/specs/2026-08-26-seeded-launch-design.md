# Seeded Soft Launch — Design

**Date:** 2026-08-26
**Baseline commit:** `b7e21c7`
**Status:** approved 2026-08-26
**Launch shape:** seeded soft launch. Real breeders populate the app BEFORE the
domain flips. `payments_enabled` and `subscriptions_enabled` stay FALSE
throughout; flipping them is a separate reviewed event this work does not perform.

## Problem

scrlpets-v2 is feature-complete and empty.

Production carries 1 profile, 0 creatures, 0 posts, 0 listings, 0 services,
0 brands, 0 litters, 0 orders. Four seeded groups and three guides are the only
content that exists. Every feed, search, discovery and market surface renders its
empty state, because empty is the truth.

Meanwhile `scrlpets.com` still serves the legacy Lovable app to every visitor,
so the finished product has no audience and the empty product has no traffic.

**The legacy-parity work this was assumed to need is already done.** The
walkthrough covers 66 of legacy's 72 pages across **89 rulable items** — V1's 15
plus 74 in V2–V9 (the 74 figure quoted in earlier session notes is V2–V9 ONLY and
does not include V1):

| | V1 | V2–V9 | Total |
|---|---:|---:|---:|
| Built | 9 | 28 | **37** |
| Ruled kills | 2 | 29 | **31** |
| Banked behind a named unblock | 3 | 7 | **10** |
| Partial, named delta only | 0 | 6 | **6** |
| Undecided | 1 (V1-07) | 0 | **1** |
| Unchanged / no ruling needed | 0 | 4 | **4** |
| | **15** | **74** | **89** |

Settings shipped. The admin portal ships nine queues — dispute, guides,
moderation log, program review, redemptions, reports, shipments, support,
suspension. There is no backlog of legacy features waiting to be ported.

What is missing is everything between "the software works" and "a breeder joins,
fills it in, and stays."

## Non-goals

- **Re-examining the 31 ruled kills.** The 29 in V2–V9 were verified absent and ruled 2026-08-25; V1's two were provisionally ruled 2026-07-29.
  Reopening one requires Dailen naming it specifically.
- **Flipping either money flag.** Separate reviewed event.
- **Building the 10 banked items.** Each has a named unblock that has not fired.
- **New features.** Every item below closes a gap between the app and its first
  real user. Nothing here is a new capability.

## Approach

Onboarding-first, then instrumentation, then seeding — because the seeding IS
the dogfooding. Walking the path personally, on the flow the cohort will use,
surfaces every rough edge before an outside breeder meets it. The alternative
orderings either measure a flow about to be replaced, or hand-walk breeders
through flows already known to be thin while learning nothing reusable.

## Scope

### 1. Breeder onboarding depth

`/onboarding` is one screen: a species-interest picker, then `onboarded_at` is
stamped and the user lands in an empty app with nothing to do.

V1-14's recommendation specified more and only half shipped: *"one-screen
species-interest picker + optional 'I breed animals' branch into brand creation
(ties the species-identity moment)."* The branch does not exist.

**Build:** after the species pick, an optional branch for people who breed —
into brand creation, then a first animal. Skippable at every step; skipping must
never punish. The species pick already drives `speciesIdentity()`, so the brand's
`groupName` and `roleBadge` come out correct without asking twice.

**Constraint:** this is the path Dailen walks to seed, and the path the first
cohort walks. It is the only surface here where a rough edge costs a real
breeder.

### 2. Measurement

`opt_out_capturing_by_default: true`, 8 distinct events, and **zero funnel
events** — no signup, no onboarding-complete, no search, no listing view, no
follow. A seeded soft launch is an experiment about whether breeders populate and
stay; run as-is it produces no evidence either way.

**Build:** funnel events across signup → onboarding → first animal → first
listing → first follow, plus the consent surface that lets a visitor opt in at
all. Event names and properties get fixed once, up front — renaming events after
data exists is how analytics becomes untrustworthy.

**Honesty constraint:** opt-out-by-default stays. The fix is that opting in is
possible and the funnel is instrumented, not that consent is weakened.

### 3. Accessibility coverage

`a11y.spec.ts` covers 12 of 67 routes. The pattern is established and correct;
it simply has not been extended.

**Build:** extend to every route a signed-out visitor or a new breeder reaches on
the seeded path first, then the rest. Fix what it finds. Routes touched by scope
items 1 and 2 get covered as part of those items rather than as a separate pass.

### 4. Cold start

Dailen creates genuine content first — animals, brands, litters, listings —
through the onboarding path from item 1, then invites breeders one at a time.
Cohort size is Dailen's call and is deliberately not fixed here; the gating
condition is qualitative, not numeric: **the domain flips when a first-time
visitor lands on a populated feed rather than an empty state.**

**This item cannot complete without Dailen's nine.** The domain flip is his, and
the seeding depends on email (Resend) for anything involving another person.

**Not in scope: fake seed data.** Fabricated listings on a marketplace that sells
trust is the same defect class as legacy's hardcoded "Verified Breeder" badge,
which this project already rejected.

### 5. V1-07 — stud services

The one genuinely undecided walkthrough item. Two questions the doc names: is a
stud listing a *service* or a gated *animal listing*, and how does co-ownership
attribution work. **Decided when a real breeder asks for it**, not before — a
seeded cohort is exactly the population that will surface the answer.

## Sequencing against Dailen's nine

**Executes now, blocked on nothing:** items 1, 2, 3.

**Blocked on Dailen:** item 4 (domain, Resend), and downstream of the money flag:
`redeem_fee_credit` and admin MFA enforcement — both banked with
`payments_enabled` as their named unblock.

**Decided later by evidence:** item 5.

## Testing

Every item follows the repo's existing discipline: RED before GREEN as separate
commits, negative controls on anything whose green could be vacuous, and
`./ship-verify.sh` before any merge.

Specific risks worth naming:
- **Onboarding is multi-step and skippable.** The failure mode is a skip path
  that strands someone. Every step's skip must be asserted, not assumed.
- **Analytics events fire client-side behind a consent gate.** A test that
  passes with consent off proves nothing — the same inert-gate defect already
  recorded on 2026-08-23. The condition gets extracted and tested as a pure
  function.
- **a11y findings are real bugs.** Extending coverage will surface failures.
  Those get fixed, not waived.

## Success criteria

- A breeder signs up and reaches a populated profile **without Dailen walking
  them through it**. During seeding he will be present; the criterion is that his
  presence is not load-bearing.
- The funnel from signup to first listing is visible in analytics.
- Every route on that path passes a11y.
- Production holds real content created through the product.
- `payments_enabled` and `subscriptions_enabled` still FALSE.
