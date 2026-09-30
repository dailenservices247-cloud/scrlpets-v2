import { expect, test, type Page } from "@playwright/test";

/**
 * Frozen criterion 6: `prefers-reduced-motion: reduce` produces zero morph
 * animation — measured, not assumed.
 *
 * Measured as the wall time a view transition spends between `ready` (the
 * moment its animations start) and `finished`. Counting entries in
 * `document.getAnimations()` cannot work here: a zeroed animation has already
 * finished by the time a test can look, so "disabled" and "never fired" read
 * identically and the assertion passes vacuously. Elapsed time separates the
 * two, and the control test below is what proves it separates them — without a
 * measured 320ms morph on the same doorway, a 0ms reading means nothing.
 */

type Instrumented = Window & { __morphMs?: number | null };

/**
 * Patched before any page script runs, so React reads the wrapper rather than
 * the original. React is what calls `startViewTransition`, not the app.
 */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    (window as Instrumented).__morphMs = null;
    const original = document.startViewTransition;
    if (!original) return;
    document.startViewTransition = function patched(this: Document, ...args) {
      const transition = original.apply(this, args);
      void transition.ready
        .then(() => {
          const startedAt = performance.now();
          return transition.finished.then(() => {
            (window as Instrumented).__morphMs = performance.now() - startedAt;
          });
        })
        .catch(() => {});
      return transition;
    };
  });
}

/**
 * The listing doorway, because it is the one an existing spec already proves is
 * reachable (a11y.spec.ts). Filtering on the CARD, never the action link: the
 * link's only text is a translated label and an aria-hidden icon, so a
 * hasNotText filter on it excludes nothing. `has: tile-media` additionally
 * requires a tile with a PHOTO — a doorway with no media has no shared element
 * and would give a reading of "no morph" for the wrong reason.
 */
async function openTheListingRealm(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("tile-listing")
    .filter({ hasNotText: "E2E " })
    .filter({ has: page.getByTestId("tile-media") })
    .first()
    .getByTestId("tile-destination-listing")
    .click();
  // Tolerant: dev-mode first compile of the destination route under load.
  await expect(page.getByTestId("destination-listing")).toBeVisible({ timeout: 20_000 });
}

async function morphMs(page: Page, label: string) {
  await page.waitForFunction(() => (window as Instrumented).__morphMs !== null, null, {
    timeout: 15_000,
  });
  const ms = await page.evaluate(() => (window as Instrumented).__morphMs as number);
  // Recorded, not just asserted: criterion 6 asks for a measurement, and a
  // pass/fail alone does not tell a later reader what was measured.
  test.info().annotations.push({ type: "measurement", description: `${label}: ${ms.toFixed(1)}ms` });
  return ms;
}

test.describe("the morph animates", () => {
  test("a tile that opens a listing realm morphs for the spec's 320ms", async ({ page }) => {
    await instrument(page);
    await openTheListingRealm(page);
    const ms = await morphMs(page, "morph");
    // Nominal 320ms. The floor is what matters: it proves this doorway really
    // does animate, which is the only thing that gives the reduced-motion
    // reading below any meaning.
    expect(ms, `morph lasted ${ms}ms`).toBeGreaterThan(250);
  });
});

test.describe("reduced motion", () => {
  test("the same doorway animates for zero time", async ({ page }) => {
    // emulateMedia rather than the reducedMotion fixture: one call, and it sits
    // next to the instrumentation instead of in a separate describe option.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await instrument(page);
    await openTheListingRealm(page);
    // A reading at all means the transition still ran — it just carried no
    // duration, which is the browser's own instant swap.
    const ms = await morphMs(page, "morph under reduced motion");
    expect(ms, `morph lasted ${ms}ms under prefers-reduced-motion`).toBeLessThan(100);
  });
});
