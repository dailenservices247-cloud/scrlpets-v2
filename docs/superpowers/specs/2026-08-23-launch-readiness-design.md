# Launch Readiness — Design

**Date:** 2026-08-23
**Baseline commit:** `85fd41a`
**Status:** approved 2026-08-23
**Launch target:** functionally complete with money dark. `payments_enabled` and
`subscriptions_enabled` stay FALSE throughout. Flipping them is a separate,
reviewed event that this work does not perform.

## Problem

scrlpets-v2 has a complete money engine and no way to drive it. The database
defines the full order lifecycle — dispatch, handover, delivery, dispute,
settlement, refund, payout — and enforces every rule. The application calls
almost none of it.

A buyer can check out. After that the order freezes: `/orders/[id]` renders a
status label and a chat thread, and nothing else. The seller cannot mark an
animal dispatched. The buyer cannot accept delivery, read their handover code,
or open a dispute. An admin can resolve disputes that nobody is able to open.
`set_order_addresses` has no caller, so the transporter address-reveal built in
`20260812092140` reveals nothing.

Separately, four jobs that must run unattended have no scheduler at all. There is
no `vercel.json` and no `vercel.ts` in the repo.

This is not a design gap. Every rule is already written and probed. The gap is
that the surfaces which invoke those rules were never built.

## Verified inventory

Evidence gathered from the codebase at `85fd41a`, not from the handoff.

### Order actions defined with no UI caller

| Action | Defined | Called from |
|---|---|---|
| `markDispatched` | `src/lib/orders/actions.ts:78` | nothing |
| `confirmHandover` | `src/lib/orders/actions.ts:96` | nothing |
| `acceptDelivery` | `src/lib/orders/actions.ts:114` | nothing |
| `disputeOrder` | `src/lib/orders/actions.ts:124` | nothing |
| `advanceOrder` | `src/lib/orders/actions.ts:53` | nothing |
| `getHandoverCode` | `src/lib/orders/actions.ts:71` | nothing |
| `settleOrder` | `src/lib/orders/actions.ts:154` | admin dispute queue only |

`ApplicationList.tsx:8` imports a `confirmHandover` from `@/lib/reviews/actions`.
That is the adoption-review function, a different symbol. The order function is
genuinely uncalled.

### Database functions with no caller anywhere in `src`

`record_shipment`, `confirm_pickup`, `confirm_shipment_delivered`,
`confirm_animal_returned`, `set_order_addresses`, `order_addresses`,
`overdue_shipments`, `release_expired_inspections`, `pause_subscription`,
`resume_subscription`, `reactivate_account`, `redeem_fee_credit`.

### Runners with no scheduler

`runPendingPayouts` (`src/lib/payments/payouts.ts:26`) and `runPendingRefunds`
(`:99`) are referenced only by their own unit tests. No cron config exists.

### Known defects

- `src/lib/feed/query.ts:166` — `.in("author_id", [...followed, viewerId])` over
  an uncapped follow list. PostgREST encodes this into the URL; the request
  breaks near 430 follows.
- `brands` has no DELETE policy and no archive column, so a brand can never be
  removed. Fixture brand counts only grow.

### Deliberately excluded, and why

The five ungated entitlements are **not** a gap. The header of
`supabase/migrations/20260813114001_entitlements_are_enforced.sql` already ruled
on this: of seven entitlement keys, only `brand_page` and `sell_merch` describe
capabilities a member actually has. `create_group` and `publish_guide` route
through admin-only RPCs — gating them would be theatre, and widening those RPCs
so a gate has something to guard would be privilege escalation dressed as a
paywall. `boost` is withdrawn. `featured_placement` does not exist. That ruling
stands and this work does not revisit it.

`analytics` is the one remaining key with somewhere to go: it guards a read
surface, so it belongs in the UI rather than in a policy.

## Architecture

Seven workstreams. Each is independently implementable, independently testable,
and lands as its own commit sequence. W1 and W2 are the launch blockers; the rest
close named gaps.

Two rules hold across all of them:

1. **Permission stays in the database.** Every one of these RPCs already
   enforces its own authority. UI decides what to *show*, never what is
   *allowed*. A hidden button and a refused call must agree, and when they
   disagree the database is right.
2. **Amounts and state derive from the database.** No surface computes a total,
   a fee, or a next status. It reads one and renders it.

---

### W1 — Order lifecycle UI

**The launch blocker.** Turns `/orders/[id]` from a chat thread into the place an
order is actually driven.

**Component:** `src/components/orders/OrderActions.tsx`, rendered above
`OrderThread` on `/orders/[id]`.

It receives the order row and the viewer id, derives the viewer's role
(buyer / seller) from ids already on the order, and renders only the actions that
role holds at the order's current status **and fulfilment mode**. Every action is
an existing server action or a thin new one wrapping an existing RPC.

**Fulfilment is three different paths, not one.** `orders.fulfilment` is
`in_person`, `transported` or `shipped` (`orders_fulfilment_check`), and each
reaches `inspection` by a different route. A single flat action list would be
wrong for two of the three.

| Path | Step | Actor | Guard | Result |
|---|---|---|---|---|
| `in_person` | confirm handover | seller | `dispatched` + buyer's code | → `inspection` |
| `transported` | confirm pickup | **seller** | `funds_held` + anchor scan | → `dispatched` |
| `transported` | confirm delivery | transporter | `dispatched` + `picked_up_at` + code | → `inspection` |
| `shipped` | record shipment | seller | `funds_held` + tracking | → `dispatched` |
| `shipped` | carrier delivered | *service role* | `dispatched` | → `inspection` |

Mode-independent, on every path:

| Actor | Guard | Action |
|---|---|---|
| seller | `funds_held` | mark dispatched (`markDispatched`) |
| seller | order open | set **pickup** address (`set_order_addresses`) |
| seller | `animal_returned_at` null | confirm animal returned (`confirm_animal_returned`) |
| buyer | order open | set **delivery** address (`set_order_addresses`) |
| buyer | is buyer | show handover code (`my_handover_code`) |
| buyer | `inspection` | accept delivery (`acceptDelivery`) → `released` |
| **buyer or seller** | `deposit_held` · `funds_held` · `dispatched` · `inspection` | open dispute (`disputeOrder`) |

Four corrections against the first draft of this spec, each verified in the
migrations rather than assumed:

- `dispute_order` accepts **either party**, not the buyer alone, and across four
  statuses rather than only `inspection`.
- `confirm_animal_returned` is the **seller's** action — they confirm the animal
  is back — not the buyer's.
- `confirm_pickup` is the **seller's** action, not the driver's. The split is
  deliberate and documented in `jobs/actions.ts:9-16`: the seller proves the
  right animal got in the van, the buyer's code proves it reached the right
  person, and neither party can fake the chain alone.
- `confirm_shipment_delivered` is revoked from `authenticated` entirely. It is a
  carrier assertion executed by the service role, so it belongs in W2, not in
  any UI.

New server actions in `src/lib/orders/actions.ts`, each a direct wrapper in the
existing style: `setOrderAddresses`, `recordShipment`, `confirmPickup`,
`confirmAnimalReturned`. `confirmHandover`, `markDispatched`, `acceptDelivery`,
`disputeOrder`, `advanceOrder` and `getHandoverCode` already exist and need only
a caller.

**Address capture.** `set_order_addresses` accepts pickup from the seller and
delivery from the buyer, and refuses on a closed order. Delivery address is
collected at checkout when transport is booked — `CheckoutFlow` already gathers
pickup and delivery *regions*, so the address field extends that step rather than
introducing a new one. Pickup address is collected from the seller on the order
page after the order exists.

**Driver surface is already complete.** `JobList.tsx` exposes `confirmDelivery`,
which is the driver's only action by design. W1 does not touch it.

**Errors.** Every action returns the existing `OrderResult` shape. A refusal
renders the database's own reason, translated, next to the control — never a
generic failure. A refusal is information: it means the UI's idea of the order's
state is stale, and the page revalidates on it.

---

### W2 — Unattended runners

**One route, one schedule, four jobs.**

`src/app/api/cron/tick/route.ts`, guarded by `CRON_SECRET` compared in constant
time, following the pattern established by `src/app/api/webhooks/stripe/route.ts`.
It runs, in order:

1. `release_expired_inspections` — inspection windows that have elapsed
2. `runPendingRefunds` — money owed back to buyers
3. `runPendingPayouts` — money owed out to sellers and drivers
4. `overdue_shipments` — surfaces late transport

Refunds run before payouts deliberately: they move money in opposite directions
and a refund that is owed should not queue behind a payout batch.

Each step is isolated. A throw in one is caught, recorded in the response body,
and does not prevent the others from running — a failed refund must not stop a
payout that is already due.

**Schedule config:** `vercel.ts` with `@vercel/config`, per the current
recommendation over `vercel.json`. One entry, one path.

**Deliberately one route rather than four.** Four cron entries need a paid Vercel
plan; one works on any plan, needs one secret, and gives one place to look when
something has not run. `// ponytail: single tick, split per-job when payments go
live and frequency actually differs.`

**Flag safety.** Every runner is already inert while `payments_enabled` is false
— the RPCs it calls raise `payments_disabled`. The cron route is therefore safe
to ship dark, and shipping it dark is the point: it gets exercised on a real
schedule long before it can move a cent. A test pins that the route is a no-op
under the flag.

**The `shipped` path has a dead end, and this is where it gets closed.**
`confirm_shipment_delivered` is revoked from `anon`, `authenticated` and
`public`, so only the service role can call it — it models a carrier's
assertion. There is no carrier integration and none is in scope. Without a
caller, a `shipped` order reaching `dispatched` can never reach `inspection`,
which means the buyer can never accept and the seller can never be paid.

Minimum viable close: expose it as a service-role action on the **admin** order
surface, alongside the existing dispute queue, so a human can record delivery
once tracking shows it. `overdue_shipments` — run by the same cron tick — is what
surfaces which orders are waiting on that. `// ponytail: human-confirmed
delivery; replace with a carrier webhook when a carrier integration exists.`

---

### W3 — Subscription lifecycle

Callers for the four orphaned subscription RPCs, on `/settings/subscription`
(currently 59 lines, read-only).

- `pause_subscription` — with the plan's pause allowance and cooldown surfaced,
  since the RPC refuses on `plan_does_not_allow_pausing`,
  `no_pauses_remaining`, `pause_allowance_exceeded` and `too_soon_to_pause`, and
  a user should see which one applies before trying
- `resume_subscription`
- `reactivate_account`
- `redeem_fee_credit`

`pause_subscription` also refuses with `order_in_flight` while an order is in
`awaiting_payment`, `deposit_held`, `funds_held`, `dispatched`, `inspection` or
`disputed`. That refusal is explained in the UI rather than discovered by
pressing the button.

Plus the `analytics` entitlement gate on its read surface.

---

### W4 — Two defects

**Follow-list overflow.** `src/lib/feed/query.ts:166` builds an unbounded `in`
list. Fix at the query, not the caller: cap the list and fall back to a join or
an RPC once the follow graph exceeds what a URL can carry. The existing
`MIN_FOLLOWING_FOR_FILTER` bootstrap behaviour is preserved.

**Brands cannot be removed.** Add an archive column and a DELETE policy
consistent with the soft-delete posture used for posts and listings. Brand slugs
are immutable and brand identity is public, so archive is the right primitive and
hard delete is not.

---

### W5 — i18n switcher

`src/i18n/request.ts:4` hardcodes `const locale = "en"`. `messages/es.json` is
dictionary-complete and unreachable.

Locale resolves from profile preference, falling back to a cookie, falling back
to `"en"`. A switcher lands in settings. One e2e pass runs in ES to prove the
dictionary actually covers the shipped surfaces — a complete dictionary and a
complete *translation* are not the same claim, and only the run distinguishes
them.

---

### W6 — Auth hardening

No new npm dependency. Plain `fetch` where a call is needed, matching
`src/lib/payments/stripe.ts:1-12`.

**CAPTCHA — Cloudflare Turnstile.** Supabase Auth verifies the token server-side
once the provider is configured; the client passes `captchaToken` on signup,
login and password reset. Behind an env check, so an unconfigured environment
degrades to today's behaviour rather than locking everyone out.

**MFA — Supabase-native TOTP.** `mfa.enroll` / `mfa.challenge` / `mfa.verify`,
with an enrolment and management surface in settings. Recovery codes included:
TOTP without recovery is a lockout generator.

**SMTP — Resend as Supabase custom SMTP.** Dashboard and DNS configuration, not
code.

**External dependencies — Dailen's, non-blocking:**
1. Cloudflare Turnstile site key + secret key
2. Resend account + verified sending domain, then Supabase → Auth → SMTP

The code path ships and stays inert until those exist.

---

### W7 — Parity ledger re-audit

`AI Hub/PRDs/scrlpets-v2-legacy-parity-ledger-2026-07-04.md` has
`last_reviewed_commit: c2db08c`, roughly 40 commits behind `main`. Several of its
open P0s (listing capability gate, seller identity verification) appear closed by
work shipped since.

Walk every row against shipped code. Re-dispose each as Keep / Rebuild safely /
Bank / Reject / Add per the legacy-intent gate. Bump `last_reviewed_commit` to
whatever this work ships. Also correct the row that led to the wrong conclusion
this session: `/adopt`, `/services` and `/shop` are deliberate permanent
redirects into `/market`, not unbuilt surfaces.

## Testing

Per `AGENTS.md`, and per the lesson that produced the probe discipline: **absence
of failure is not evidence of success.**

- **TDD with a visible commit trail.** One commit for the failing test with RED
  captured, one for the minimal fix with GREEN captured. Checkpoints count only
  when reachable from `HEAD` on the active branch, for this task.
- **Every new SQL path gets a probe, and every probe gets one assertion inverted
  first** to prove it goes red before its green is trusted.
- **Re-run the entire probe suite after any constraint change**, not just the
  probe that covers the change. Five probes have silently rotted before.
- **e2e counts are checked, not just the pass line.** A run that reports "137
  passed" while 35 tests never executed has failed.
- `./ship-verify.sh` — all six gates — before this is called done.

## Order of work

**W1 → W2 → W4 → W3 → W5 → W6 → W7.**

W1 first because it is the largest and every other surface reads clearer once the
order lifecycle is drivable. W2 second because an order that can now reach
`released` needs something to actually pay it out, even dark. W4 third because
both defects are small and both are live today. W3, W5, W6 are independent and
could reorder freely. W7 last because it audits what the preceding six shipped.

## Out of scope

- Flipping `payments_enabled` or `subscriptions_enabled`
- Live Stripe key, live webhook destination, confirming production key mode
- The banked money-path review gate
- A3 legal — sequenced last by standing rule, never a blocker
- `E2E_ADMIN_EMAIL` and the admin e2e queue
- Air cargo, weather embargo, rest stops — ruled out of v1
- Re-litigating the five ungated entitlement keys
- Supabase account consolidation — deferred with a named unblock
