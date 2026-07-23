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
  // Serial: tests share one dev DB; parallel workers race on mutated rows
  // (e.g. profile-edit vs profile-read of the same seed user).
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
