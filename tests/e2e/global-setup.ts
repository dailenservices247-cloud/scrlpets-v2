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

  // Listings accumulate exactly like marker posts and were never cleaned: 209
  // of them once filled every slot of the feed and starved posts/reels/videos
  // off the surface entirely. The feed now caps commercial density, but the
  // litter of dead fixtures still belongs in the bin.
  const { data: staleListings } = await db
    .from("listings")
    .select("id")
    .eq("seller_id", data.user.id)
    .like("title", "%E2E%")
    .is("deleted_at", null);
  for (const row of staleListings ?? []) {
    await db.rpc("soft_delete_managed_listing", { target_listing_id: row.id });
  }

  // Third table, same story: every litter on the dev database was an `E2E `
  // leftover, because subject-layer.spec's own delete is its LAST line and any
  // earlier failure skips it. Litters have no deleted_at — deleteLitter in
  // src/lib/litters/actions.ts is a hard delete too — and creatures.litter_id
  // is ON DELETE SET NULL, so retiring a fixture litter never touches the young
  // it recorded. One filtered statement; RLS keeps it to this account's rows.
  await db.from("litters").delete().eq("owner_id", data.user.id).like("name", "E2E %");

  // The young outlive their litter by design, so they need their own sweep —
  // and they get the app's escape hatch instead of a DELETE, which `creatures`
  // has no policy for anyway. The RPC refuses any creature something still
  // points at (lineage, listings, posts, alumni, tests, breeding events), so
  // this can only ever remove rows nothing depends on; the rest simply stay.
  // Order matters: it counts a still-linked young as referenced, and the litter
  // delete above is what clears litter_id.
  const { data: strays } = await db
    .from("creatures")
    .select("id")
    .eq("owner_id", data.user.id)
    .like("name", "E2E %");
  for (const row of strays ?? []) {
    await db.rpc("delete_creature_if_unreferenced", { target_creature: row.id });
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
