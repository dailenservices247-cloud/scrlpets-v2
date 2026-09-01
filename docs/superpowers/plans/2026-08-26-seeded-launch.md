# Seeded Soft Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between working software and a breeder who joins, fills the app in, and stays — onboarding depth, funnel measurement, and accessibility coverage.

**Architecture:** Three independent slices against `b7e21c7`. Onboarding gains an optional post-species branch into brand creation, reusing the existing `createBrand` action rather than duplicating it. Measurement adds funnel events to the existing PostHog wrapper, which already has a consent surface — only the events are missing. Accessibility extends the existing `a11y.spec.ts` pattern to the routes the seeded path touches. No new dependencies.

**Tech Stack:** Next.js 16 App Router, React server + client components, next-intl (message files per locale), Supabase (RLS + server actions), Vitest (unit), Playwright + axe-core (e2e), PostHog.

---

## Scope corrections found during planning

Two spec assumptions were wrong and the plan reflects the corrected state:

- **The analytics consent surface already exists.** `src/components/privacy/AnalyticsConsent.tsx`, rendered from `src/components/Providers.tsx:11`. The spec said to build it. Only the funnel events are missing, so Task 4 does not touch consent.
- **`createBrand` redirects to `/compose?brand=<id>`** (`src/lib/brands/actions.ts:49`). An onboarding branch cannot call it unchanged without ejecting the user into the composer mid-flow. Task 2 handles this with a `next` parameter rather than a second brand-creation path.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/analytics/events.ts` (create) | The funnel event-name constants. One place, so an event can never be renamed in one caller and not another. |
| `src/lib/analytics.ts` (modify) | Unchanged behaviour; re-exports the event names for callers. |
| `src/lib/brands/actions.ts` (modify) | `createBrand` accepts an optional `next` redirect target. |
| `src/components/onboarding/SpeciesInterests.tsx` (modify) | After saving, routes to the breeder branch instead of straight to `nextPath`. |
| `src/components/onboarding/BreederBranch.tsx` (create) | The optional "do you breed?" step and its skip. |
| `src/app/onboarding/breeder/page.tsx` (create) | Route hosting the branch. Skippable; never shown twice. |
| `messages/en.json`, `messages/es.json` (modify) | Copy for the branch, both locales. |
| `tests/unit/analytics-events.test.ts` (create) | Event-name registry is complete and collision-free. |
| `tests/unit/onboarding-branch.test.ts` (create) | Branch routing logic as a pure function. |
| `tests/e2e/onboarding-branch.spec.ts` (create) | The real signup → species → breeder → brand path, and the skip path. |
| `tests/e2e/a11y.spec.ts` (modify) | Extend to the seeded-path routes. |

---

## Task 1: Event-name registry

**Files:**
- Create: `src/lib/analytics/events.ts`
- Test: `tests/unit/analytics-events.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

/**
 * Event names are a schema. Renaming one after data exists silently splits a
 * funnel across two names, and nothing fails — which is why they live in one
 * frozen object instead of as string literals at each call site.
 */
describe("FUNNEL_EVENTS", () => {
  it("covers every step of the seeded-launch funnel", () => {
    for (const key of [
      "signupCompleted",
      "onboardingSpeciesSaved",
      "onboardingSkipped",
      "breederBranchTaken",
      "breederBranchSkipped",
      "firstBrandCreated",
      "firstAnimalCreated",
      "firstListingCreated",
    ] as const) {
      expect(FUNNEL_EVENTS[key], `FUNNEL_EVENTS.${key} missing`).toBeTruthy();
    }
  });

  it("uses snake_case names with no collisions", () => {
    const names = Object.values(FUNNEL_EVENTS);
    expect(new Set(names).size, "duplicate event name").toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/analytics-events.test.ts`
Expected: FAIL — cannot resolve `@/lib/analytics/events`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * The funnel, named once.
 *
 * These names are a schema: PostHog groups by the literal string, so renaming
 * one after data exists splits a funnel in two and nothing errors. Add names
 * here; never write an event string at a call site.
 */
export const FUNNEL_EVENTS = {
  signupCompleted: "signup_completed",
  onboardingSpeciesSaved: "onboarding_species_saved",
  onboardingSkipped: "onboarding_skipped",
  breederBranchTaken: "breeder_branch_taken",
  breederBranchSkipped: "breeder_branch_skipped",
  firstBrandCreated: "first_brand_created",
  firstAnimalCreated: "first_animal_created",
  firstListingCreated: "first_listing_created",
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/analytics-events.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/events.ts tests/unit/analytics-events.test.ts
git commit -m "RED+GREEN: the funnel gets named once, not at eight call sites"
```

---

## Task 2: `createBrand` accepts a return path

**Files:**
- Modify: `src/lib/brands/actions.ts:26-50`
- Test: `tests/unit/onboarding-branch.test.ts`

`createBrand` currently ends `redirect('/compose?brand=' + brand.id)`. Onboarding needs it to land somewhere else without a second brand-creation path existing.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { brandRedirectTarget } from "@/lib/brands/actions";

/**
 * Extracted as a pure function because the redirect is the ONLY thing that
 * differs between the composer path and the onboarding path, and a redirect
 * inside a server action cannot be asserted directly.
 */
describe("brandRedirectTarget", () => {
  it("defaults to the composer with the new brand preselected", () => {
    expect(brandRedirectTarget("abc", null)).toBe("/compose?brand=abc");
  });

  it("honours an app-relative next path", () => {
    expect(brandRedirectTarget("abc", "/onboarding/breeder?done=1")).toBe(
      "/onboarding/breeder?done=1",
    );
  });

  it("refuses an absolute URL — next is attacker-supplied", () => {
    expect(brandRedirectTarget("abc", "https://evil.test/x")).toBe("/compose?brand=abc");
    expect(brandRedirectTarget("abc", "//evil.test/x")).toBe("/compose?brand=abc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding-branch.test.ts`
Expected: FAIL — `brandRedirectTarget` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/brands/actions.ts`, add above `createBrand`:

```typescript
/**
 * Where to land after a brand is created. `next` reaches this from a form
 * field, so it is attacker-supplied: only same-origin absolute PATHS are
 * honoured, and a protocol-relative `//host` is rejected along with full URLs.
 */
export function brandRedirectTarget(brandId: string, next: string | null): string {
  const fallback = `/compose?brand=${brandId}`;
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
```

Then replace line 49 (`redirect(\`/compose?brand=${brand.id}\`);`) with:

```typescript
  redirect(brandRedirectTarget(brand.id, String(formData.get("next") ?? "") || null));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding-branch.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify nothing else regressed**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all unit tests pass; tsc exits 0 with no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brands/actions.ts tests/unit/onboarding-branch.test.ts
git commit -m "RED+GREEN: brand creation can return somewhere other than the composer"
```

---

## Task 3: The breeder branch

**Files:**
- Create: `src/components/onboarding/BreederBranch.tsx`
- Create: `src/app/onboarding/breeder/page.tsx`
- Modify: `src/components/onboarding/SpeciesInterests.tsx:46-56`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Add copy to BOTH locales**

In `messages/en.json`, inside the existing `"onboarding"` object:

```json
"breederTitle": "Do you breed or raise animals?",
"breederBody": "If you do, we'll set up your page now so your animals have somewhere to live. If you're here to follow along or find an animal, skip this — nothing is locked behind it.",
"breederYes": "Yes, set up my page",
"breederNo": "Not right now",
"breederNameLabel": "What should we call it?",
"breederNameHint": "Your kennel, cattery, aviary or program name. You can change it later."
```

In `messages/es.json`, same keys:

```json
"breederTitle": "¿Crías o cuidas animales?",
"breederBody": "Si es así, configuramos tu página ahora para que tus animales tengan dónde vivir. Si estás aquí para seguir a otros o encontrar un animal, omite esto: no bloquea nada.",
"breederYes": "Sí, configurar mi página",
"breederNo": "Ahora no",
"breederNameLabel": "¿Cómo la llamamos?",
"breederNameHint": "El nombre de tu criadero, aviario o programa. Puedes cambiarlo después."
```

- [ ] **Step 2: Write the failing e2e test**

Create `tests/e2e/onboarding-branch.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

/**
 * The seeded launch walks every breeder down this path, so BOTH exits are
 * asserted. The skip is the one that matters: a skip that strands someone in
 * an empty app is the failure this whole slice exists to prevent.
 */
test.describe("breeder branch", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test("skipping the branch lands in the app, not on a dead end", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    await page.goto("/onboarding/breeder");
    await expect(page.getByTestId("onboarding-breeder")).toBeVisible();
    await page.getByTestId("breeder-skip").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
  });

  test("the branch offers a named page and does not demand one", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    await page.goto("/onboarding/breeder");
    await page.getByTestId("breeder-yes").click();
    await expect(page.getByTestId("breeder-name")).toBeVisible();
    // Empty name must not submit — the DB requires it and a silent failure here
    // is a breeder who thinks they have a page and does not.
    await page.getByTestId("breeder-create").click();
    await expect(page.getByTestId("breeder-name")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx playwright test tests/e2e/onboarding-branch.spec.ts --workers=1`
Expected: FAIL — `/onboarding/breeder` 404s, `onboarding-breeder` testid never appears.

- [ ] **Step 4: Create the branch component**

`src/components/onboarding/BreederBranch.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrand } from "@/lib/brands/actions";
import { capture } from "@/lib/analytics";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";

/**
 * Optional by construction. Skipping is a real answer that costs nothing, and
 * the copy says so — a breeder who is not ready must not feel gated.
 */
export function BreederBranch({ nextPath }: { nextPath: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function skip() {
    capture(FUNNEL_EVENTS.breederBranchSkipped);
    router.push(nextPath);
    router.refresh();
  }

  async function create() {
    if (!name.trim()) return; // The DB requires it; refuse before the round trip.
    setBusy(true);
    capture(FUNNEL_EVENTS.firstBrandCreated);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("brandType", "kennel");
    fd.set("next", nextPath);
    await createBrand(fd);
  }

  return (
    <section className="px-4 pb-10" data-testid="onboarding-breeder">
      <h1 className="text-2xl font-semibold tracking-tight">{t("breederTitle")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("breederBody")}</p>

      {!asked ? (
        <>
          <Button
            className="mt-5 min-h-11 w-full"
            data-testid="breeder-yes"
            onClick={() => {
              capture(FUNNEL_EVENTS.breederBranchTaken);
              setAsked(true);
            }}
          >
            {t("breederYes")}
          </Button>
          <Button
            className="mt-2 min-h-11 w-full"
            variant="ghost"
            data-testid="breeder-skip"
            onClick={skip}
          >
            {t("breederNo")}
          </Button>
        </>
      ) : (
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="breeder-name">
            {t("breederNameLabel")}
          </label>
          <input
            id="breeder-name"
            data-testid="breeder-name"
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("breederNameHint")}</p>
          <Button
            className="mt-4 min-h-11 w-full"
            disabled={busy}
            data-testid="breeder-create"
            onClick={create}
          >
            {t("breederYes")}
          </Button>
          <Button
            className="mt-2 min-h-11 w-full"
            variant="ghost"
            disabled={busy}
            data-testid="breeder-skip"
            onClick={skip}
          >
            {t("breederNo")}
          </Button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Create the route**

`src/app/onboarding/breeder/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { BreederBranch } from "@/components/onboarding/BreederBranch";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

/**
 * Reachable only after the species step, but it does NOT re-gate on
 * `onboarded_at` — that flag is already set by then, and gating here would make
 * the branch unreachable the moment it is needed.
 */
export default async function BreederOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor(`/onboarding/breeder?next=${encodeURIComponent(nextPath)}`));

  return (
    <AppPage showBottomNav={false}>
      <BreederBranch nextPath={nextPath} />
    </AppPage>
  );
}
```

- [ ] **Step 6: Route the species step into the branch**

In `src/components/onboarding/SpeciesInterests.tsx`, replace the body of `finish` after the error check (currently `router.push(nextPath); router.refresh();`) with:

```typescript
    capture(
      species.length > 0
        ? FUNNEL_EVENTS.onboardingSpeciesSaved
        : FUNNEL_EVENTS.onboardingSkipped,
      { count: species.length },
    );
    router.push(`/onboarding/breeder?next=${encodeURIComponent(nextPath)}`);
    router.refresh();
```

Add to that file's imports:

```typescript
import { capture } from "@/lib/analytics";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
```

- [ ] **Step 7: Run the e2e to verify it passes**

Run: `npx playwright test tests/e2e/onboarding-branch.spec.ts --workers=1`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/onboarding src/app/onboarding messages tests/e2e/onboarding-branch.spec.ts
git commit -m "GREEN: the breeder branch V1-14 specified and never got"
```

---

## Task 4: Funnel events at the remaining call sites

**Files:**
- Modify: `src/components/compose/ListingForm.tsx:163`
- Modify: `src/lib/analytics.ts`

`listing_created` already fires. The funnel needs the first-time variant so activation is separable from ongoing use.

- [ ] **Step 1: Re-export the registry from the analytics entry point**

Append to `src/lib/analytics.ts`:

```typescript
export { FUNNEL_EVENTS, type FunnelEvent } from "./analytics/events";
```

- [ ] **Step 2: Add the first-listing event**

In `src/components/compose/ListingForm.tsx`, directly after the existing
`capture("listing_created", ...)` call at line 163, add:

```typescript
      // Activation, not volume: the funnel needs to know a breeder crossed the
      // line once. `isFirst` comes from the server response, never from a
      // client-side count that a refresh would reset.
      if (result.isFirstListing) capture(FUNNEL_EVENTS.firstListingCreated);
```

Add to that file's imports:

```typescript
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
```

- [ ] **Step 3: Verify types and units**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exits 0. If `result.isFirstListing` does not exist on the action's
return type, tsc fails — add it to the listing action's result as
`isFirstListing: boolean` computed server-side from a `count` query on the
seller's existing listings, then re-run.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics.ts src/components/compose/ListingForm.tsx
git commit -m "GREEN: activation events, separable from volume"
```

---

## Task 5: Extend accessibility coverage

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`

Currently 12 of 67 routes. Extend to the routes the seeded path touches first.

- [ ] **Step 1: Add the failing tests**

Append to `tests/e2e/a11y.spec.ts`:

```typescript
test("the seeded onboarding path has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://localhost:3000/");
  for (const route of ["/onboarding/breeder", "/hub", "/litters", "/settings"]) {
    await page.goto(route);
    await expectNoSerious(page);
  }
});

test("guest discovery surfaces have no serious/critical a11y violations", async ({ page }) => {
  for (const route of ["/discover", "/market", "/services", "/guides", "/adopt", "/faq"]) {
    await page.goto(route);
    await expectNoSerious(page);
  }
});
```

- [ ] **Step 2: Run to see what it finds**

Run: `npx playwright test tests/e2e/a11y.spec.ts --workers=1`
Expected: either PASS, or FAIL listing specific axe violation ids and node
counts. **Violations found here are real bugs.** Fix the markup they name; do
not relax `expectNoSerious` and do not add exclusions.

- [ ] **Step 3: Fix every serious/critical violation reported**

For each violation id in the failure output, edit the component that owns the
named nodes. Re-run step 2 until it passes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/a11y.spec.ts src
git commit -m "GREEN: a11y coverage reaches the routes the first cohort walks"
```

---

## Task 6: Full verification

- [ ] **Step 1: Free the port**

Playwright leaks a `next-server` on :3000 between runs. Run:
`lsof -ti:3000 | xargs kill 2>/dev/null; sleep 2`

- [ ] **Step 2: Run the full sweep**

Run: `./ship-verify.sh`
Expected: `RESULT: ALL GATES PASS`. The suite exceeds a 10-minute tool timeout —
run it backgrounded and poll.

- [ ] **Step 3: Commit any fixes and stop**

Do NOT merge or push. The domain flip and Resend are Dailen's; item 4 of the
spec cannot complete without them.

---

## Deferred — do not build

- **Spec item 4 (cold start).** Blocked on the domain flip and Resend.
- **Spec item 5 (V1-07 stud services).** Decided when a real breeder asks.
- **`redeem_fee_credit`, admin MFA enforcement.** Unblock is `payments_enabled`.
- **The 10 banked walkthrough items.** Each has a named unblock that has not fired.
