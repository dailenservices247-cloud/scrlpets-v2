import { expect, test } from "@playwright/test";

/**
 * Evicting the legacy Lovable PWA.
 *
 * scrlpets.com used to serve a Vite/Workbox PWA. Its service worker registered
 * itself at `/sw.js` with scope `/`, and a service worker survives the site it
 * came from: after the domain was pointed at v2, returning visitors were still
 * served the OLD app out of `workbox-precache-v2-https://scrlpets.com/`, along
 * with a `supabase-api-cache` aimed at the LEGACY Supabase project. Observed on
 * production 2026-09-07 — curl returned v2 while the browser returned legacy.
 *
 * A 404 on the script does NOT clean this up. Chrome treats a failed update
 * check as a failure and keeps the existing worker registered, so the stale app
 * persists indefinitely. The only remedy that reaches an already-affected
 * browser is to serve a REAL worker at the same path that unregisters itself.
 *
 * v2 has no service worker of its own, so `/sw.js` is free for this and nothing
 * competes for the scope.
 */
test("registering /sw.js unregisters itself and leaves no caches", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");

  // The stale caches exist BEFORE the replacement worker arrives — that is the
  // real-world order, and seeding them afterwards races activation.
  await page.evaluate(async () => {
    const c = await caches.open("workbox-precache-v2-legacy-probe");
    await c.put("/probe", new Response("stale"));
  });

  // Stand in for the legacy worker: whatever is served at /sw.js is what a
  // returning visitor's browser fetches on its next update check.
  const registered = await page.evaluate(async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      return { ok: true as const, scope: reg.scope };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
    }
  });
  expect(
    registered.ok,
    `/sw.js must be served for an affected browser to ever recover; got: ${
      registered.ok ? "" : registered.message
    }`,
  ).toBe(true);

  // It removes itself. Polled rather than slept: activation is asynchronous and
  // a fixed wait is either flaky or slow.
  await expect
    .poll(
      async () => (await page.evaluate(() => navigator.serviceWorker.getRegistrations())).length,
      { timeout: 30_000, message: "the worker should unregister itself" },
    )
    .toBe(0);

  const cacheKeys = await page.evaluate(() => caches.keys());
  expect(cacheKeys, "it should take the stale caches with it").toEqual([]);
});
