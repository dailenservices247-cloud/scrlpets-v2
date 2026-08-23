# W3 — Subscription Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give callers to the subscription pause/resume pair and to `reactivate_account`, so a member can pause a plan they paid for and an admin can undo a suspension.

**Architecture:** Three thin server actions wrapping existing definers, two panels, one flag-conditional UI gate. No migrations. The refusal reasons are surfaced *before* the button rather than discovered by pressing it, because `pause_subscription` alone has seven distinct ways to say no.

**Tech Stack:** Next.js server actions, Supabase RPC, next-intl, vitest.

---

## What reading the definers changed about this plan

The design put all four orphaned RPCs on `/settings/subscription`. Three of the four
do not belong there.

| RPC | Actually is | Home |
|---|---|---|
| `pause_subscription(months)` | member, own plan | `/settings/subscription` ✅ |
| `resume_subscription()` | member, own plan | `/settings/subscription` ✅ |
| `reactivate_account(profile, reason)` | **`is_platform_admin()` only** — a moderation action | `/admin`, beside `SuspensionPanel` |
| `redeem_fee_credit(order, points)` | **order-scoped**, `draft`/`awaiting_payment`, `payments_enabled`-guarded | checkout — **BANKED**, see below |

### `reactivate_account` is the sharpest item here

`SuspensionPanel` can suspend an account and lists suspended ones. Nothing can
un-suspend. `reactivate_account` has existed with no caller, so **an admin suspension is
currently a one-way door** — the only exit is a hand-written SQL statement against
production. That is the highest-value fix in W3 and it is not a subscription feature at
all.

### `redeem_fee_credit` is BANKED, with a named unblock

It mutates `buyer_fee_cents` / `seller_fee_cents` on a live order. Adding a fee-mutating
call to the checkout path is precisely what the **banked go-live money-path review gate**
covers (recorded 2026-08-12, accepted by Dailen). Building it before that review is the
thing the gate exists to prevent.

**Named unblock:** the money-path review pass, or Dailen confirming §3–§6 of
`scrlpets-v2-money-architecture-2026-08-10.md`. Until then it stays uncalled — which is
recorded here rather than quietly ticked off, because "no RPC without a caller" is the
whole point of this workstream and this is a deliberate exception to it.

### The `analytics` entitlement gate has a consequence worth naming

`BreederStatsPanel` renders counts of the operator's own records — animals, attested
animals, records, listings, sold, open applications. It is honest, and it is **free for
every brand operator today**.

Gating it behind `analytics` does not add a Pro feature; it **removes a working one from
everyone who is not Pro**, the moment `subscriptions_enabled` flips. That is the same
trap `20260813114001` avoided by writing its gates flag-conditional.

So: flag-conditional, exactly like the DB gates. Nothing changes while the flag is false.
**But when the flag flips, brand operators lose their stats.** That is a pricing decision,
not an implementation detail. If the intent was "Pro gets *more* analytics" rather than
"free gets none", this gate is the wrong shape and the `analytics` row should be removed
from the Pro promise instead.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/subscriptions/actions.ts` — **modify** | `pauseSubscription(months)`, `resumeSubscription()`. |
| `src/lib/subscriptions/queries.ts` — **modify** | Widen `getMySubscription` with pause state; add the tier's pause allowance. |
| `src/components/subscriptions/PausePanel.tsx` — **create** | Pause/resume, with the allowance and every blocking reason stated up front. |
| `src/app/settings/subscription/page.tsx` — **modify** | Render it when a subscription exists. |
| `src/lib/admin/actions.ts` — **modify** | `reactivateAccount(profileId, reason)`. |
| `src/components/admin/SuspensionPanel.tsx` — **modify** | A reactivate control per suspended row. |
| `src/app/brand-os/page.tsx` — **modify** | Flag-conditional `analytics` gate around `BreederStatsPanel`. |
| `messages/en.json`, `messages/es.json` — **modify** | New keys in `subscriptions` and `admin`. |
| `tests/unit/subscription-pause.test.ts` — **create** | Refusal mapping and the guard order. |

---

## Task 1: Pause and resume

**Files:**
- Modify: `src/lib/subscriptions/actions.ts`, `src/lib/subscriptions/queries.ts`
- Test: `tests/unit/subscription-pause.test.ts`

- [ ] **Step 1: Read the definer's refusals — all seven**

```bash
grep -rh -A40 "create or replace function public.pause_subscription" supabase/migrations | head -45
```

`pause_subscription` refuses with: `auth_required`, `months_must_be_positive`,
`no_active_subscription`, `already_paused`, `plan_does_not_allow_pausing`,
`no_pauses_remaining`, `pause_allowance_exceeded`, `too_soon_to_pause` (subscription
younger than 30 days), and `order_in_flight` (an order in `awaiting_payment`,
`deposit_held`, `funds_held`, `dispatched`, `inspection` or `disputed`).

`resume_subscription` refuses with `auth_required`, `no_active_subscription`,
`not_paused`.

Every one of those needs its own message. A generic failure on a paid plan's pause
button is the kind of thing that generates a support ticket.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/subscription-pause.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pause has SEVEN distinct ways to refuse, and they mean very different things
 * to someone who is paying. "Your plan does not allow pausing" and "you have an
 * order in flight" lead to opposite next actions, so flattening both into a
 * generic failure is the difference between a self-serve answer and a ticket.
 */
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("pauseSubscription", () => {
  it("passes the month count through to the definer", async () => {
    rpc.mockResolvedValue({ error: null });
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    expect(await pauseSubscription(2)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("pause_subscription", { months: 2 });
  });

  it("returns each refusal reason distinctly, not flattened", async () => {
    const reasons = [
      "no_active_subscription",
      "already_paused",
      "plan_does_not_allow_pausing",
      "no_pauses_remaining",
      "pause_allowance_exceeded",
      "too_soon_to_pause",
      "order_in_flight",
    ];
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    for (const reason of reasons) {
      rpc.mockResolvedValue({ error: { message: reason } });
      const result = await pauseSubscription(1);
      expect(result).toEqual({ ok: false, error: reason });
    }
  });

  it("refuses a non-positive month count without calling the database", async () => {
    // The definer refuses too. Checking here as well means the user gets an
    // answer without a round trip, not that the database check is optional.
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    expect(await pauseSubscription(0)).toEqual({ ok: false, error: "months_must_be_positive" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("resumeSubscription", () => {
  it("calls the definer with no arguments", async () => {
    rpc.mockResolvedValue({ error: null });
    const { resumeSubscription } = await import("@/lib/subscriptions/actions");
    expect(await resumeSubscription()).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("resume_subscription");
  });

  it("reports not_paused distinctly", async () => {
    rpc.mockResolvedValue({ error: { message: "not_paused" } });
    const { resumeSubscription } = await import("@/lib/subscriptions/actions");
    expect(await resumeSubscription()).toEqual({ ok: false, error: "not_paused" });
  });
});
```

- [ ] **Step 3: Run, confirm RED, commit the RED checkpoint**

```bash
npx vitest run tests/unit/subscription-pause.test.ts
```

- [ ] **Step 4: Read the existing action shape before matching it**

```bash
sed -n 1,40p src/lib/subscriptions/actions.ts
```

`SubscriptionResult` already exists in that file. Reuse it; do not define a second
result type.

- [ ] **Step 5: Write the actions**

Append to `src/lib/subscriptions/actions.ts`, matching `subscribeToTier`'s shape:

```ts
/**
 * Pause a plan without losing it.
 *
 * The definer refuses seven different ways and each one means something
 * different to someone paying — "your plan does not allow pausing" and "you
 * have an order in flight" lead to opposite next actions. The raw reason is
 * returned rather than flattened, and the panel maps it to a sentence.
 *
 * The month check is duplicated here only so the answer arrives without a round
 * trip. The database check is the one that counts.
 */
export async function pauseSubscription(months: number): Promise<SubscriptionResult> {
  if (!Number.isInteger(months) || months < 1) {
    return { ok: false, error: "months_must_be_positive" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_subscription", { months });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/subscription");
  return { ok: true };
}

/** Resume a paused plan. Refuses `not_paused`, which the panel says plainly. */
export async function resumeSubscription(): Promise<SubscriptionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resume_subscription");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/subscription");
  return { ok: true };
}
```

If `SubscriptionResult`'s error field is typed as a union of literals rather than
`string`, widen it or map to it — read the type before assuming.

- [ ] **Step 6: Widen the subscription query**

`getMySubscription` selects `id,tier_key,status,current_period_end`. The panel cannot
tell the user what is possible without the pause state, so add
`paused_at,pauses_used,paused_months_used,created_at` to the select and to the
`Subscription` type, and add `pauseCountAllowed` / `pauseMonthsAllowed` to
`SubscriptionTier` from `subscription_tiers`.

Those columns exist: `pause_count_allowed`, `pause_months_allowed` on tiers;
`paused_at`, `pauses_used`, `paused_months_used` on subscriptions.

- [ ] **Step 7: Verify GREEN, run the inversion, commit**

Inversion: delete the `months < 1` guard in `pauseSubscription`. The
"refuses a non-positive month count without calling the database" test must fail.

---

## Task 2: The suspension is no longer one-way

**Files:**
- Modify: `src/lib/admin/actions.ts`
- Modify: `src/components/admin/SuspensionPanel.tsx`

- [ ] **Step 1: Read what is already there**

```bash
grep -n "export async function suspendAccount" -A25 src/lib/admin/actions.ts
grep -n "SuspendedAccount" -A12 src/lib/admin/queries.ts
sed -n 1,80p src/components/admin/SuspensionPanel.tsx
```

`reactivate_account` takes `(target_profile uuid, reason text)`, requires
`is_platform_admin()`, requires a reason of at least 4 characters, refuses
`not_suspended`, and writes to `moderation_actions`. Match `suspendAccount`'s shape and
its `AdminError` type exactly rather than inventing a parallel one.

- [ ] **Step 2: Write `reactivateAccount`**

```ts
/**
 * Undo a suspension.
 *
 * Nothing called reactivate_account, so suspending was a ONE-WAY DOOR: the only
 * exit was a hand-written statement against production. The reason is required
 * by the definer and lands in moderation_actions, so an unsuspension is as
 * accountable as the suspension it reverses.
 */
export async function reactivateAccount(
  profileId: string,
  reason: string,
): Promise<AdminError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_account", {
    target_profile: profileId,
    reason,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
```

Adjust the return type to whatever `suspendAccount` actually returns — read it first.

- [ ] **Step 3: Add the control to `SuspensionPanel`**

Each suspended row gets a reason input and a reactivate button, mirroring the existing
suspend form's markup and `data-testid` conventions. The definer's `reason_required`
(under 4 characters) and `not_suspended` each get their own message.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

---

## Task 3: The analytics gate, flag-conditional

**Files:**
- Modify: `src/app/brand-os/page.tsx`

- [ ] **Step 1: Gate it the way the database gates things**

`BreederStatsPanel` is rendered at `src/app/brand-os/page.tsx:95` and `:212`. Wrap both:

```tsx
// Flag-conditional, exactly like the DB entitlement gates in
// 20260813114001. While subscriptions_enabled is false nobody holds Pro, so
// enforcing would not turn a paywall on — it would take stats away from every
// operator who has them today.
const statsVisible =
  !(await isSubscriptionsEnabled()) || (await hasEntitlement("analytics"));
```

`has_entitlement(uuid, text)` is granted to `authenticated`; add a `hasEntitlement`
helper in `src/lib/subscriptions/queries.ts` calling it with `(select auth.uid())`
semantics — read the function signature before writing the call.

- [ ] **Step 2: Verify nothing changes today**

With `subscriptions_enabled` false, `statsVisible` must be `true` for every operator.
Confirm in the e2e suite: `brand-os.spec.ts` asserts on `breeder-stats-panel`, so it
passing unchanged IS the check that this gate is inert.

```bash
npx playwright test tests/e2e/brand-os.spec.ts --reporter=line
```

Expected: same count as before. If it drops, the gate is not inert and the flag logic is
inverted.

- [ ] **Step 3: Commit, and state the consequence in the message**

The commit must record that flipping `subscriptions_enabled` will remove stats from
non-Pro operators, so the decision is visible in `git log` rather than only in this plan.

---

## Task 4: Verification

- [ ] **Step 1: Every gate**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && bash ./run-probes.sh && npm run build
npx playwright test --reporter=line
```

Expected: 23 probes / 226 assertions ALL PASS (W3 adds no migration), e2e **182 passed,
7 skipped**. Read the counts.

- [ ] **Step 2: Verify `HEAD`, not the working tree**

```bash
git status --short
git worktree add -q --detach /tmp/w3-headcheck HEAD
ln -s "$PWD/node_modules" /tmp/w3-headcheck/node_modules
(cd /tmp/w3-headcheck && npx tsc --noEmit && npx vitest run)
rm -rf /tmp/w3-headcheck && git worktree prune
```

- [ ] **Step 3: Record results here and commit**

---

## Self-review notes

**Spec coverage.** The design's W3 asks for callers to the four orphaned subscription
RPCs plus the `analytics` gate. Three get callers here. `redeem_fee_credit` is banked with
a named unblock and the reason stated, because it is an order-scoped fee mutation and the
money-path review gate already covers exactly that surface.

**Deliberately not here.** Any change to what a plan costs or promises. The `analytics`
gate's consequence is flagged, not decided — if Pro should mean *more* analytics rather
than free meaning none, that is a different change.

**Highest risk.** Task 3 inverting. `!enabled || hasEntitlement` is inert today;
`enabled && !hasEntitlement` hiding the panel would also be inert today and would be
wrong the moment the flag flips — and no test running now would tell them apart. The
brand-os e2e passing unchanged is necessary but not sufficient; read the condition twice.
