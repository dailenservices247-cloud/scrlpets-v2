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
  // Playwright's 5s expect default predates worker parallelism. Three workers
  // share one `next dev` server and first-compiles of route bundles regularly
  // hold a navigation past 5s — that exact flake killed a worker, and the
  // replacement worker cascade is documented in tests/e2e/fixtures.ts. 15s
  // still fails fast on real defects; per-assertion overrides remain.
  expect: { timeout: 15_000 },
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
  // RE-ENABLED 2026-07-28 (second attempt): the first try at workers: 3 failed
  // with 6 specs stuck at /login because every file signed in as the same two
  // or three fixture accounts — concurrent workers collided on Supabase auth,
  // not on table rows. tests/e2e/fixtures.ts now maps each worker index to its
  // own full account set (seeded by supabase-dev/seed-e2e-worker-fixtures.sql),
  // so an account is only ever active on one worker at a time.
  //
  // Raising this above 3 requires seeding another account set FIRST — worker
  // indexes beyond the seeded range would sign in as accounts that don't exist.
  workers: 3,
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
    // PRODUCTION BUILD, not `next dev` (switched 2026-07-29): dev-mode
    // first-compiles of cold routes were the root cause of the recurring
    // stuck-at-/login timeout class — every route added made it worse, and
    // the 5th recurrence (Phase B's six new routes) pushed sign-ins past any
    // sane window at 3 workers. One ~30s build up front beats per-route
    // compile stalls, and the suite now exercises the artifact that ships.
    command: "npm run build && npm run start -- -p 3000",
    url: "http://localhost:3000",
    timeout: 240_000,
    // Fresh server every run: guarantees the dummy PostHog key below is
    // present so the consent test can never pass vacuously, and the suite
    // always runs the committed code instead of a stale dev server.
    reuseExistingServer: false,
    env: {
      ...process.env,
      // The suite asserts on its own `E2E *` marker content; the production
      // build would otherwise hide it (see hideFixtures in lib/feed/query).
      E2E_KEEP_FIXTURES: "1",
      NEXT_PUBLIC_POSTHOG_KEY:
        process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "phc_e2e_dummy_key",
    },
  },
});
