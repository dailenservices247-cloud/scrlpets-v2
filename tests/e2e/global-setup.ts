// Warm the dev server's lazily-compiled routes before any test signs in, so a
// cold `next dev` boot doesn't blow the first sign-in's URL assertion.
export default async function globalSetup() {
  const base = "http://localhost:3000";
  for (const path of ["/login", "/"]) {
    try {
      await fetch(`${base}${path}`);
    } catch {
      // Server may still be starting; webServer readiness + per-test waits cover it.
    }
  }
}
