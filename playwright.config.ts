import { defineConfig } from "@playwright/test";
import { config as dotenv } from "dotenv";

dotenv({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial: tests share one dev DB; parallel workers race on mutated rows
  // (e.g. profile-edit vs profile-read of the same seed user).
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
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
    reuseExistingServer: true,
  },
});
