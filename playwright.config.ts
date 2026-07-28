import { defineConfig } from "@playwright/test";
import { config as dotenv } from "dotenv";

dotenv({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Dev-server suite: first-compile of routes and tolerant auth windows make
  // multi-step tests exceed the 30s default under full-suite load. Individual
  // expect timeouts still fail fast on real defects.
  timeout: 90_000,
  // File-level parallelism, NOT test-level. Tests share one real dev DB and the
  // same fixture accounts, so the races we care about are between tests that
  // mutate and read the same seed row — and those all live inside one file
  // (e.g. profiles.spec.ts edits breeder_jane's bio, then reads it back).
  // fullyParallel:false keeps tests within a file serial and in declaration
  // order on a single worker, while different files run concurrently. That is
  // safe here because every cross-file mutation is already scoped to a value
  // the test itself owns: unique per-run markers (`Date.now()`), self-created
  // listing ids, or DB-queried ids. The "no animal listing in /shop" style
  // assertions in adoption/commerce are invariants over ids they fetched
  // themselves, not counts of global state, so a concurrent insert in another
  // file cannot fail them.
  //
  // 3 workers, not 4: all workers share ONE `next dev` server (Playwright
  // starts webServer once regardless of worker count), and dev-mode route
  // compilation is the bottleneck. 4 cold-compiling workers push multi-step
  // tests toward the 90s timeout above; 3 gets ~3x on 27 files with headroom.
  // Tune per-run with `npx playwright test --workers=N` — no config edit needed.
  //
  // If a NEW spec file asserts on UNSCOPED global state (a raw row count, "the
  // feed has exactly N posts", a shared profile field without a unique marker),
  // it is not safe under this setting. Fix it in the spec — scope the assertion
  // to a marker the test owns, or add `test.describe.configure({ mode: "serial" })`
  // if its own tests must fail-fast as a chain. Dropping back to workers:1 is
  // the last resort, not the first.
  fullyParallel: false,
  // REVERTED 2026-07-28: workers: 3 with file-level parallelism failed the full
  // suite — 6 specs stuck at /login. The data-race analysis was sound, but it
  // missed the real constraint: EVERY spec file signs in as the same two or
  // three fixture accounts, so concurrent workers collide on Supabase auth
  // (rate limiting / concurrent session issuance), not on table rows. All 9
  // auth specs pass at workers: 1.
  //
  // Parallelism needs per-worker fixture accounts (e.g. e2e-w0@, e2e-w1@ keyed
  // off TEST_WORKER_INDEX), which is real work rather than a config change.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    // Mobile-first is the primary form factor; the desktop web shell (F7) hides
    // the bottom nav behind a sidebar at lg+. Default the suite to phone width so
    // it exercises the layout most users see; desktop-specific tests override.
    viewport: { width: 390, height: 844 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [
            { name: "scrlpets_analytics_consent", value: "declined" },
          ],
        },
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Fresh server every run: guarantees the dummy PostHog key below is
    // present so the consent test can never pass vacuously, and the suite
    // always runs the committed code instead of a stale dev server.
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_POSTHOG_KEY:
        process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "phc_e2e_dummy_key",
    },
  },
});
