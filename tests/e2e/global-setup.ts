import { createClient } from "@supabase/supabase-js";

/**
 * Some specs leave `E2E `-marker posts behind by design (a post that survives
 * navigation IS the assertion), and on the shared dev database they accumulate
 * until the seeded media/reel/promo rows fall out of the feed's first 50 —
 * which then fails the guest feed specs. That drift broke runs five separate
 * times before this existed. Each fixture account soft-deletes its own leftover
 * markers here, so every run starts from a clean feed instead of inheriting the
 * last hundred runs' litter. Soft delete matches the app's own semantics: the
 * SELECT policy hides the rows everywhere, and no client hard-delete exists.
 */
async function cleanOwnMarkers(email: string, password: string) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await db.auth.signInWithPassword({ email, password });
  if (!data.user) return; // an unseeded slot account is a config error surfaced by the specs themselves
  const { data: leftovers } = await db
    .from("posts")
    .select("id")
    .eq("author_id", data.user.id)
    .like("body", "E2E %")
    .is("deleted_at", null);
  for (const row of leftovers ?? []) {
    await db.rpc("soft_delete_managed_post", { target_post_id: row.id });
  }
}

export default async function globalSetup() {
  // Warm the dev server's lazily-compiled routes before any test signs in, so a
  // cold `next dev` boot doesn't blow the first sign-in's URL assertion.
  const base = "http://localhost:3000";
  for (const path of ["/login", "/"]) {
    try {
      await fetch(`${base}${path}`);
    } catch {
      // Server may still be starting; webServer readiness + per-test waits cover it.
    }
  }

  const password = process.env.E2E_PASSWORD;
  if (!password) return;
  const bases = [
    process.env.E2E_EMAIL ?? "scrlpets-e2e@scrlpets.com",
    "scrlpets-rbac-e2e@scrlpets.com",
    "scrlpets-rbac-third@scrlpets.com",
  ];
  // Every slot's account set, not just this run's — leftovers don't care which
  // slot wrote them. Mirrors the seeded range in seed-e2e-worker-fixtures.sql.
  const emails = bases.flatMap((base) => [
    base,
    base.replace("@", "-w1@"),
    base.replace("@", "-w2@"),
  ]);
  await Promise.all(emails.map((email) => cleanOwnMarkers(email, password)));
}
