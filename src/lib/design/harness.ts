/**
 * The design harness renders fixture content that must never be reachable on
 * scrlpets.com. The e2e suite runs a PRODUCTION build (playwright.config.ts
 * webServer), so NODE_ENV alone would hide the harness from the very tests that
 * measure it — hence an explicit opt-in flag, the same shape as
 * E2E_KEEP_FIXTURES.
 *
 * Pure function on purpose: a gate and its inverse are both inert while the
 * flag is off, so the only way to prove both branches is to test the decision
 * itself rather than the page.
 */
export function designHarnessEnabled(env: {
  NODE_ENV?: string;
  DESIGN_HARNESS?: string;
}): boolean {
  if (env.DESIGN_HARNESS === "1") return true;
  return env.NODE_ENV !== "production";
}
