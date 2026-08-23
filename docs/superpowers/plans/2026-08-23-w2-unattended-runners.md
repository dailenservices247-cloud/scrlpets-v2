# W2 — Unattended Runners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four jobs that must run without a human a scheduler, and close the `shipped` dead end that leaves a delivered order stuck at `dispatched` forever.

**Architecture:** One cron route calling one orchestrator. The orchestrator (`src/lib/payments/cron.ts`) isolates each job so one failure cannot starve the others, and is unit-tested with the Supabase client and the Stripe runners mocked — the same shape `tests/unit/refund-runner.test.ts` already uses. The route itself is four lines, matching `api/webhooks/stripe/route.ts`. The `shipped` dead end is closed by an admin queue whose server action holds the service role, which makes its TypeScript admin check load-bearing in a way nothing else in this codebase is.

**Tech Stack:** Next.js App Router route handler (`runtime = "nodejs"`), `node:crypto` `timingSafeEqual`, Supabase service-role client via `@supabase/supabase-js`, `vercel.json` cron, vitest.

---

## Background the engineer needs

### The four jobs

| Job | Kind | Guard | Notes |
|---|---|---|---|
| `release_expired_inspections()` | SQL, returns `integer` | **none** | Advances `inspection` → `released` once `inspection_ends_at` elapses. Uses `for update skip locked`, so concurrent runs are safe. |
| `runPendingRefunds()` | TS, Stripe | RPCs raise `payments_disabled` | `src/lib/payments/payouts.ts:99` |
| `runPendingPayouts()` | TS, Stripe | RPCs raise `payments_disabled` | `src/lib/payments/payouts.ts:26` |
| `overdue_shipments()` | SQL, returns a table | read-only | `shipped` orders stuck at `dispatched` for over 14 days. |

**Refunds run before payouts, deliberately.** They move money in opposite directions, and a refund that is owed should not queue behind a payout batch.

**`release_expired_inspections` has no `payments_enabled` guard.** Every other function in the money layer starts with one; this does not. It will therefore do real work the first time the cron fires, including in dev against fixture orders. That is correct — an inspection window elapsing is a fact about the clock, not about whether Stripe is live — but it means this job is the one that is *not* inert, and the only one whose first run changes rows.

**Both SQL functions are revoked from `anon`, `authenticated` and `public`.** They need the service-role client. `runPendingPayouts` and `runPendingRefunds` already build their own and return an empty result when `SUPABASE_SERVICE_ROLE_KEY` is unset.

### The `shipped` dead end

`confirm_shipment_delivered(target_order)` is the only way a `shipped` order leaves `dispatched`. Its entire body is:

```
if o is null then raise exception 'not_found'
if o.fulfilment <> 'shipped' then raise exception 'not_a_shipped_order'
if o.status <> 'dispatched' then raise exception 'not_dispatched'
→ status = 'inspection', delivered_at = now(), handover_at = now()
```

**There is no caller check. No `uid`, no `is_platform_admin`, nothing.** Its whole authorization model is the grant: `revoke execute … from anon, authenticated, public`. The probe pins the intent — `3e shipped: seller CANNOT declare delivery — that is the carrier's word`.

That has a direct consequence for this plan: **a server action holding the service role bypasses every check the database has.** The `isPlatformAdmin()` call in TypeScript is not defence in depth, it is the only defence. Task 5 exists to test exactly that, and its test must be seen to fail.

There is no carrier integration and none is in scope, so a human confirms delivery from the admin queue, prompted by `overdue_shipments()`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/payments/cron.ts` — **create** | `runScheduledJobs()`. Runs the four jobs in order, isolates each, returns a structured summary. No HTTP, no auth. |
| `tests/unit/cron-tick.test.ts` — **create** | Isolation, ordering, and flag-off behaviour, with Supabase and Stripe mocked. |
| `src/app/api/cron/tick/route.ts` — **create** | Four lines: check the bearer secret, call the orchestrator, return the summary. |
| `tests/unit/cron-auth.test.ts` — **create** | The secret check: missing, wrong, wrong-length, and correct. |
| `vercel.json` — **create** | One cron entry. |
| `src/lib/admin/shipments.ts` — **create** | `getOverdueShipments()` and `confirmShipmentDelivered()`. The admin check lives here. |
| `tests/unit/admin-shipments.test.ts` — **create** | Proves a non-admin is refused before the service-role client is ever built. |
| `src/components/admin/ShipmentQueue.tsx` — **create** | Renders overdue shipments with a confirm control. |
| `src/app/admin/page.tsx` — **modify** | Fetch and render the queue beside the existing ones. |
| `messages/en.json`, `messages/es.json` — **modify** | New `adminShipments` namespace. |

**No migrations.** Every function this plan calls already exists and is probed.

---

## Task 1: The orchestrator

**Files:**
- Create: `src/lib/payments/cron.ts`
- Test: `tests/unit/cron-tick.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cron-tick.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The scheduled tick.
 *
 * The property that matters most: one failing job must not starve the others.
 * A refund that throws while a payout is due would, in a naive sequential
 * runner, mean the payout silently never happens — and "money owed, nothing
 * reported" is the exact failure this whole layer exists to prevent.
 */
const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const runPendingPayouts = vi.fn();
const runPendingRefunds = vi.fn();
vi.mock("@/lib/payments/payouts", () => ({ runPendingPayouts, runPendingRefunds }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  rpc.mockResolvedValue({ data: 0, error: null });
  runPendingRefunds.mockResolvedValue({ attempted: 0, refunded: 0, blocked: [] });
  runPendingPayouts.mockResolvedValue({ attempted: 0, paid: 0, failed: [] });
});

describe("runScheduledJobs", () => {
  it("runs all four jobs", async () => {
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(rpc).toHaveBeenCalledWith("release_expired_inspections");
    expect(rpc).toHaveBeenCalledWith("overdue_shipments");
    expect(runPendingRefunds).toHaveBeenCalledOnce();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors).toEqual([]);
  });

  it("runs refunds BEFORE payouts", async () => {
    // They move money in opposite directions. A refund that is owed should not
    // queue behind a payout batch.
    const order: string[] = [];
    runPendingRefunds.mockImplementation(async () => {
      order.push("refunds");
      return { attempted: 0, refunded: 0, blocked: [] };
    });
    runPendingPayouts.mockImplementation(async () => {
      order.push("payouts");
      return { attempted: 0, paid: 0, failed: [] };
    });
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    await runScheduledJobs();
    expect(order).toEqual(["refunds", "payouts"]);
  });

  it("keeps running after a job throws, and reports which one", async () => {
    // THE test. A thrown refund must not prevent a due payout from being sent.
    runPendingRefunds.mockRejectedValue(new Error("stripe unreachable"));
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].job).toBe("refunds");
    expect(result.errors[0].reason).toContain("stripe unreachable");
  });

  it("survives a thrown SQL job too, and still pays out", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "release_expired_inspections"
        ? { data: null, error: { message: "deadlock detected" } }
        : { data: [], error: null },
    );
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors.map((e) => e.job)).toContain("inspections");
  });

  it("reports the counts each job returned", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "release_expired_inspections"
        ? { data: 3, error: null }
        : { data: [{ order_id: "o1" }, { order_id: "o2" }], error: null },
    );
    runPendingRefunds.mockResolvedValue({ attempted: 2, refunded: 1, blocked: [] });
    runPendingPayouts.mockResolvedValue({ attempted: 5, paid: 5, failed: [] });
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(result.inspectionsReleased).toBe(3);
    expect(result.overdueShipments).toBe(2);
    expect(result.refunds.refunded).toBe(1);
    expect(result.payouts.paid).toBe(5);
  });

  it("does nothing at all without a service key", async () => {
    // Not a silent no-op: it is reported, because a tick that quietly did
    // nothing for weeks looks identical to a tick with nothing to do.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(result.skipped).toBe("no_service_key");
    expect(rpc).not.toHaveBeenCalled();
    expect(runPendingPayouts).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
npx vitest run tests/unit/cron-tick.test.ts
```

Expected: FAIL — `Cannot find package '@/lib/payments/cron'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/payments/cron.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { runPendingPayouts, runPendingRefunds } from "./payouts";
import type { PayoutRunResult, RefundRunResult } from "./payouts";

/**
 * The scheduled tick: everything that has to happen without a human present.
 *
 * ONE route rather than four, because four cron entries need a paid Vercel plan
 * while one works anywhere, needs one secret, and gives one place to look when
 * something has not run.
 * ponytail: split per-job when payments are live and the schedules actually differ.
 *
 * Every job is isolated. A thrown refund must not prevent a due payout from
 * being sent — "money owed, nothing reported" is the failure this layer exists
 * to prevent, and a bare sequential runner reintroduces it.
 */
export type CronJobError = { job: string; reason: string };

export type CronRunResult = {
  skipped?: "no_service_key";
  inspectionsReleased: number;
  overdueShipments: number;
  refunds: RefundRunResult;
  payouts: PayoutRunResult;
  errors: CronJobError[];
};

const EMPTY_REFUNDS: RefundRunResult = { attempted: 0, refunded: 0, blocked: [] };
const EMPTY_PAYOUTS: PayoutRunResult = { attempted: 0, paid: 0, failed: [] };

async function isolate<T>(
  job: string,
  errors: CronJobError[],
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push({ job, reason: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

export async function runScheduledJobs(): Promise<CronRunResult> {
  const errors: CronJobError[] = [];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Reported, never silent. A tick that quietly did nothing for weeks looks
    // exactly like a tick with nothing to do.
    return {
      skipped: "no_service_key",
      inspectionsReleased: 0,
      overdueShipments: 0,
      refunds: EMPTY_REFUNDS,
      payouts: EMPTY_PAYOUTS,
      errors,
    };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  // 1. The clock. This is the ONE job with no `payments_enabled` guard: an
  //    inspection window elapsing is a fact about time, not about Stripe.
  const inspectionsReleased = await isolate("inspections", errors, 0, async () => {
    const { data, error } = await supabase.rpc("release_expired_inspections");
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  });

  // 2. Refunds before payouts: opposite directions, and money owed back should
  //    not wait behind a payout batch.
  const refunds = await isolate("refunds", errors, EMPTY_REFUNDS, runPendingRefunds);

  // 3. Payouts.
  const payouts = await isolate("payouts", errors, EMPTY_PAYOUTS, runPendingPayouts);

  // 4. Read-only. Surfaces shipped orders stuck at `dispatched`, which is what
  //    the admin queue acts on — there is no carrier webhook to close them.
  const overdueShipments = await isolate("overdue_shipments", errors, 0, async () => {
    const { data, error } = await supabase.rpc("overdue_shipments");
    if (error) throw new Error(error.message);
    return (data as unknown[] | null)?.length ?? 0;
  });

  return { inspectionsReleased, overdueShipments, refunds, payouts, errors };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run tests/unit/cron-tick.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the isolation test can fail**

Temporarily replace the `refunds` line with an un-isolated call:

```ts
  const refunds = await runPendingRefunds();
```

Re-run. Expected: **"keeps running after a job throws"** FAILS — the thrown refund propagates and `runPendingPayouts` is never reached. Revert and re-run to confirm 6 pass.

- [ ] **Step 6: Commit RED and GREEN separately**

```bash
git add tests/unit/cron-tick.test.ts
git commit -m "RED: the scheduled tick"
git add src/lib/payments/cron.ts
git commit -m "GREEN: the scheduled tick"
```

State the exact evidence in each message, per `AGENTS.md`. Do not chain `git commit` behind a verification command with `&&` — a timeout there once left a file uncommitted while every gate stayed green.

---

## Task 2: The route and its secret

**Files:**
- Create: `src/app/api/cron/tick/route.ts`
- Create: `src/lib/payments/cron-auth.ts`
- Test: `tests/unit/cron-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cron-auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { isAuthorisedCronRequest } from "@/lib/payments/cron-auth";

beforeEach(() => {
  process.env.CRON_SECRET = "a-real-secret-value";
});

describe("isAuthorisedCronRequest", () => {
  it("accepts the configured secret as a bearer token", () => {
    expect(isAuthorisedCronRequest("Bearer a-real-secret-value")).toBe(true);
  });

  it("refuses a missing header", () => {
    expect(isAuthorisedCronRequest(null)).toBe(false);
  });

  it("refuses a wrong secret of the SAME length", () => {
    // Same length so the comparison cannot short-circuit on size — this is the
    // case a naive `===` would still pass and a length check alone would miss.
    expect(isAuthorisedCronRequest("Bearer a-real-secret-valuX")).toBe(false);
  });

  it("refuses a wrong secret of a different length", () => {
    expect(isAuthorisedCronRequest("Bearer short")).toBe(false);
  });

  it("refuses the raw secret without the Bearer scheme", () => {
    expect(isAuthorisedCronRequest("a-real-secret-value")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    // Fail CLOSED. An unset secret must not mean an open endpoint that can
    // move money — the opposite default is how cron endpoints get abused.
    delete process.env.CRON_SECRET;
    expect(isAuthorisedCronRequest("Bearer anything")).toBe(false);
    expect(isAuthorisedCronRequest(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/cron-auth.test.ts
```

Expected: FAIL — `Cannot find package '@/lib/payments/cron-auth'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/payments/cron-auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * The cron endpoint's only guard.
 *
 * Same shape as the Stripe signature check in `webhook-handler.ts`: compare in
 * constant time, and length-check first because `timingSafeEqual` throws on
 * mismatched buffers rather than returning false.
 *
 * Fails CLOSED when `CRON_SECRET` is unset. An unconfigured environment must
 * not expose an endpoint that runs refunds and payouts.
 */
export function isAuthorisedCronRequest(authorisation: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!authorisation?.startsWith("Bearer ")) return false;
  const presented = Buffer.from(authorisation.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
```

Create `src/app/api/cron/tick/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isAuthorisedCronRequest } from "@/lib/payments/cron-auth";
import { runScheduledJobs } from "@/lib/payments/cron";

/**
 * Everything that has to happen without a human present, on one schedule.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Thin by design, the
 * same as `api/webhooks/stripe/route.ts` — the logic is testable in
 * `lib/payments/cron.ts` and the auth in `lib/payments/cron-auth.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await runScheduledJobs();
  // 200 even with per-job errors: the tick itself succeeded, and the body says
  // what did not. A 500 here would make Vercel retry jobs that already ran.
  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 4: Run and confirm GREEN**

```bash
npx vitest run tests/unit/cron-auth.test.ts && npx tsc --noEmit
```

Expected: 6 tests PASS, tsc exit 0.

- [ ] **Step 5: Prove the fail-closed test can fail**

Temporarily change `if (!secret) return false;` to `if (!secret) return true;`. Re-run.

Expected: **"refuses everything when no secret is configured"** FAILS. Revert, re-run, confirm 6 pass.

- [ ] **Step 6: Commit RED then GREEN, separately**

---

## Task 3: The schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write it**

```json
{
  "crons": [
    {
      "path": "/api/cron/tick",
      "schedule": "0 3 * * *"
    }
  ]
}
```

`vercel.json` rather than `vercel.ts`: the typed config needs `@vercel/config` as a dependency, and this is one path and one schedule. This repo does not add a dependency for what a few lines cover — `src/lib/payments/stripe.ts:1-6` makes the same call about the Stripe SDK for the same reason.

One daily entry fits every Vercel plan, including Hobby's two-jobs-daily limit.

- [ ] **Step 2: Confirm the build still passes**

```bash
npm run build
```

Expected: exit 0, and `/api/cron/tick` listed in the route table.

- [ ] **Step 3: Commit**

- [ ] **Step 4: Record what a human still has to do**

`CRON_SECRET` must exist as a Vercel **Production** environment variable before the schedule does anything. Vercel generates one automatically for projects with crons, but confirm it rather than assuming. This is Dailen's step; note it in the handoff rather than leaving it implied.

---

## Task 4: Overdue shipments, read side

**Files:**
- Create: `src/lib/admin/shipments.ts`
- Test: `tests/unit/admin-shipments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/admin-shipments.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin shipment queue.
 *
 * `confirm_shipment_delivered` has NO caller check in the database — no uid, no
 * admin test. Its entire authorization is that it is revoked from every client
 * role. A server action holding the service role therefore bypasses everything,
 * and the isPlatformAdmin() call below is not defence in depth: it is the only
 * defence that exists. That is what these tests are for.
 */
const isPlatformAdmin = vi.fn();
vi.mock("@/lib/verification/queries", () => ({ isPlatformAdmin }));

const rpc = vi.fn();
const createClient = vi.fn(() => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("confirmShipmentDelivered", () => {
  it("refuses a non-admin BEFORE building a service-role client", async () => {
    // Order matters. Building the client first and checking after would mean a
    // bug in the check leaves a fully-privileged handle already constructed.
    isPlatformAdmin.mockResolvedValue(false);
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    const result = await confirmShipmentDelivered("11111111-1111-1111-1111-111111111111");
    expect(result).toEqual({ ok: false, error: "not_admin" });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the definer for an admin", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: null, error: null });
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    const result = await confirmShipmentDelivered("11111111-1111-1111-1111-111111111111");
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("confirm_shipment_delivered", {
      target_order: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("returns the definer's refusal verbatim", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: null, error: { message: "not_dispatched" } });
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    const result = await confirmShipmentDelivered("11111111-1111-1111-1111-111111111111");
    expect(result).toEqual({ ok: false, error: "not_dispatched" });
  });
});

describe("getOverdueShipments", () => {
  it("refuses a non-admin", async () => {
    isPlatformAdmin.mockResolvedValue(false);
    const { getOverdueShipments } = await import("@/lib/admin/shipments");
    expect(await getOverdueShipments()).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the rows for an admin", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({
      data: [
        {
          order_id: "11111111-1111-1111-1111-111111111111",
          shipped_at: "2026-08-01T00:00:00Z",
          carrier: "UPS",
          tracking_number: "1Z999",
        },
      ],
      error: null,
    });
    const { getOverdueShipments } = await import("@/lib/admin/shipments");
    const rows = await getOverdueShipments();
    expect(rows).toHaveLength(1);
    expect(rows[0].carrier).toBe("UPS");
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/admin-shipments.test.ts
```

Expected: FAIL — `Cannot find package '@/lib/admin/shipments'`.

- [ ] **Step 3: Confirm the real export name before writing against it**

The test mocks `isPlatformAdmin` from `@/lib/verification/queries`. Verify that is the actual export and its signature:

```bash
grep -n "export async function isPlatformAdmin" -A3 src/lib/verification/queries.ts
```

If it takes an argument, adjust both the implementation and the mock. A mock that does not match the real module is a test that proves nothing.

- [ ] **Step 4: Write the implementation**

Create `src/lib/admin/shipments.ts`:

```ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/verification/queries";

/**
 * The `shipped` path's last step, and the only place it can be taken.
 *
 * `confirm_shipment_delivered` is revoked from anon, authenticated and public,
 * so it cannot be reached from a user session at all — which is deliberate:
 * `fulfilment_modes.probe.sql` pins that a seller cannot declare their own
 * delivery, because that is the carrier's word and not theirs.
 *
 * There is no carrier integration, so without a caller a shipped order reaches
 * `dispatched` and stops: the buyer can never accept, and the seller is never
 * paid. A human closes it, prompted by `overdue_shipments()`.
 *
 * THE ADMIN CHECK BELOW IS THE ONLY AUTHORIZATION THAT EXISTS. The definer has
 * no uid check of its own; its whole model is the grant, and the service-role
 * client bypasses the grant. Check first, build the client second — the reverse
 * leaves a fully-privileged handle constructed before anyone has been refused.
 *
 * ponytail: human-confirmed delivery; replace with a carrier webhook if a
 * carrier integration ever exists.
 */
export type ShipmentResult = { ok: true } | { ok: false; error: string };

export type OverdueShipment = {
  order_id: string;
  shipped_at: string;
  carrier: string | null;
  tracking_number: string | null;
};

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getOverdueShipments(): Promise<OverdueShipment[]> {
  if (!(await isPlatformAdmin())) return [];
  const { data, error } = await service().rpc("overdue_shipments");
  if (error) return [];
  return (data ?? []) as OverdueShipment[];
}

export async function confirmShipmentDelivered(orderId: string): Promise<ShipmentResult> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "not_admin" };
  const { error } = await service().rpc("confirm_shipment_delivered", {
    target_order: orderId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
```

- [ ] **Step 5: Run and confirm GREEN**

```bash
npx vitest run tests/unit/admin-shipments.test.ts && npx tsc --noEmit
```

Expected: 5 tests PASS, tsc exit 0.

- [ ] **Step 6: Prove the admin check is load-bearing**

Temporarily delete the `if (!(await isPlatformAdmin())) return { ok: false, error: "not_admin" };` line from `confirmShipmentDelivered` and re-run.

Expected: **"refuses a non-admin BEFORE building a service-role client"** FAILS. This is the single most important inversion in W2 — that line is the only thing standing between any caller and a privileged write. Revert, re-run, confirm 5 pass.

- [ ] **Step 7: Commit RED then GREEN, separately**

---

## Task 5: The admin queue UI

**Files:**
- Create: `src/components/admin/ShipmentQueue.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Read the pattern before writing**

```bash
sed -n 1,60p src/components/admin/RedemptionQueue.tsx
sed -n 1,68p src/app/admin/page.tsx
```

`ShipmentQueue` mirrors the existing queue components: a client component taking rows as a prop, a per-row action, busy and error state, `data-testid` on the interactive parts. Follow whatever those files do rather than the sketch below where they differ.

- [ ] **Step 2: Add the `adminShipments` namespace to both dictionaries**

```json
"adminShipments": {
  "title": "Overdue shipments",
  "empty": "No shipment has been in transit longer than 14 days.",
  "shippedAt": "Shipped",
  "carrier": "Carrier",
  "tracking": "Tracking",
  "confirmDelivered": "Confirm delivered",
  "confirming": "Confirming…",
  "help": "Only confirm once tracking shows delivery. This starts the buyer's inspection window and is what eventually pays the seller.",
  "errorNotAdmin": "You are not an admin.",
  "errorNotDispatched": "That order is not awaiting delivery.",
  "errorNotShipped": "That order is not a shipped order.",
  "errorGeneric": "That did not work. Try again."
}
```

Spanish equivalents in the same key order. Verify parity with the same command Task 3 of W1 used:

```bash
node -e "const a=require('./messages/en.json').adminShipments,b=require('./messages/es.json').adminShipments;const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();if(JSON.stringify(ka)!==JSON.stringify(kb)){console.error('MISMATCH',ka.filter(k=>!kb.includes(k)),kb.filter(k=>!ka.includes(k)));process.exit(1)}console.log('OK',ka.length,'keys match')"
```

- [ ] **Step 3: Write `ShipmentQueue.tsx`**

Following `RedemptionQueue.tsx`'s structure: `"use client"`, `useTranslations("adminShipments")`, `useRouter`, per-row busy state, a `Button` per row calling `confirmShipmentDelivered(row.order_id)`, the empty state when `rows.length === 0`, and the definer's refusal mapped through the `error*` keys the way `OrderActions.tsx:53-68` does.

- [ ] **Step 4: Render it on the admin page**

Add `getOverdueShipments()` to the existing `Promise.all` in `src/app/admin/page.tsx:30-36` and render `<ShipmentQueue rows={overdue} />` beside `<DisputeQueue />` — the two belong together, since both are how a stuck order gets unstuck.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
```

Expected: exit 0, exit 0, full suite green.

- [ ] **Step 6: Commit**

---

## Task 6: Full verification sweep

- [ ] **Step 1: Run every gate**

`./ship-verify.sh` may be blocked by the auto-mode classifier. If so, run each gate directly:

```bash
npx tsc --noEmit
npm run lint
npx vitest run
bash ./run-probes.sh
npm run build
npx playwright test --reporter=line
```

Expected: exit 0 · exit 0 · all unit green · 21 probes / 213 assertions ALL PASS · exit 0 · 182 passed with **7 skipped** (or 5, if the service-role key has since been added and `order-actions` now runs — in which case expect **184 passed, 5 skipped**).

**Read the counts, not just the absence of red.** A lower passed-count than the previous run means a spec stopped running, which is a regression that reports itself as success.

- [ ] **Step 2: Verify `HEAD`, not the working tree**

The W1 merge shipped a file that was in no commit while every gate stayed green, because gates read the working tree. Before declaring done:

```bash
git status --short
git worktree add -q --detach /tmp/w2-headcheck HEAD
ln -s "$PWD/node_modules" /tmp/w2-headcheck/node_modules
(cd /tmp/w2-headcheck && npx tsc --noEmit && npx vitest run)
rm -rf /tmp/w2-headcheck && git worktree prune
```

`git status --short` must show nothing unexpected, and both commands must pass in the detached checkout. Remove the worktree from the repo root — `git worktree remove` fails when the cwd is inside it.

- [ ] **Step 3: Record the results in this file and commit**

---

## Self-review notes

**Spec coverage.** The design's W2 asks for a `CRON_SECRET`-guarded route running four jobs on one `vercel.ts` schedule, plus the `shipped` dead end closed by a service-role admin action beside the dispute queue. Tasks 1–3 cover the route and schedule; Tasks 4–5 cover the dead end.

**One deliberate divergence from the design.** The design said `vercel.ts` with `@vercel/config`. This plan uses `vercel.json` — the typed config is a new dependency for one path and one schedule, and this repo's standing call is not to add a dependency for what a few lines cover (`stripe.ts:1-6`). If typed config is wanted for other reasons, that is its own change.

**Deliberately not here.** Flipping either flag. Live Stripe keys. A carrier integration. Per-job schedules. The design's out-of-scope list stands unchanged.

**Type consistency.** `PayoutRunResult` and `RefundRunResult` are imported from `payouts.ts`, not redefined. `ShipmentResult` mirrors `OrderResult`'s shape from `orders/actions.ts` but is deliberately a separate type — it is returned by a service-role path and should not be interchangeable with a user-session one.

**Known risk this plan does not remove.** `getOverdueShipments` returns `[]` both when the caller is not an admin and when the RPC errors. An admin seeing an empty queue cannot tell "nothing overdue" from "the query failed". Acceptable for a read-only surface whose failure mode is a missing prompt rather than a wrong action, and the cron's own `overdue_shipments` count is a second signal. Worth revisiting if the queue ever drives something automatic.

---

## Verification record — 2026-08-23, branch `claude/w2-unattended-runners`

`./ship-verify.sh` was blocked by the auto-mode classifier, so each gate was run
directly.

| Gate | Command | Result |
|---|---|---|
| typescript | `npx tsc --noEmit` | exit 0 |
| lint | `npm run lint` | exit 0 — 0 errors, 26 pre-existing warnings |
| unit | `npx vitest run` | 22 files, **260 passed** (was 242) |
| sql probes | `bash ./run-probes.sh` | 21 probes, **213 assertions, ALL PASS** |
| e2e | `npx playwright test` | **182 passed, 7 skipped, 0 failed** (4.6m) |
| prod build | `npm run build` | exit 0, `/api/cron/tick` present |
| HEAD, not worktree | detached checkout of `HEAD` | tsc exit 0 · **260 passed** |

`git status --short` showed only the pre-existing `M AGENTS.md`. The W1 failure —
a file that passed every gate while being in no commit — did not recur.

### The e2e suite went red first, and it was not W2

The first full run came back **181 passed, 1 failed, exit 1**:
`a11y.spec.ts:37 › feed destination page` timed out on `destination-listing`.
The captured snapshot showed the page had rendered **404**.

The test already carried a comment describing that exact race and a filter
written to prevent it — `getByTestId("tile-destination-listing").filter({
hasNotText: "E2E " })`. But `tile-destination-listing` is the action `<Link>`,
whose only text is a translated label and an aria-hidden arrow. **It has never
contained the listing title**, so the filter matched every tile and excluded
nothing. The comment claimed the click was "pinned to a seeded listing"; it was
`.first()` over all listing tiles, which is what the comment says it avoids.

Fixed in `f3d9f3d` by filtering the card (`tile-listing`, the `FeedCardShell`,
which does contain `item.title`) — the shape `comments.spec.ts:134`,
`content-edit-delete.spec.ts:61` and `video-realms.spec.ts:62` already use.

Proof the filter is now load-bearing, which the old locator could not have
passed: a no-op filter matches everything for `hasText` and `hasNotText` alike.

```
inverted  (hasText: "E2E ")     → 1 failed, locator.click timed out, zero matches
corrected (hasNotText: "E2E ")  → 8 passed
full suite re-run               → 182 passed, 7 skipped, exit 0
```

### Still outstanding, and Dailen's

1. **`CRON_SECRET` as a Vercel Production environment variable.** Without it every
   invocation 401s, and a cron that 401s daily looks exactly like a cron with
   nothing to do.
2. **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`**, still absent — the same 7
   skips as W1. Nothing in W2 depends on it, but `order-actions`, `order-thread`,
   `transport-jobs` and `trust-core` remain unrun.

### Not covered by any test

`getOverdueShipments` returns `[]` both when the caller is not an admin and when
the RPC errors, so an empty queue cannot be told from a failed query. Accepted
for a read-only surface whose failure mode is a missing prompt rather than a
wrong action; the cron's own `overdueShipments` count is a second signal. Worth
revisiting if the queue ever drives something automatic.
