/**
 * Per-worker fixture identities.
 *
 * Every spec file signs in through these instead of naming an account, because
 * concurrent workers sharing one account collide on Supabase auth at /login —
 * that collision is what forced workers:1 on 2026-07-28. Playwright sets
 * TEST_WORKER_INDEX per worker process; each index owns a full account set, so
 * an account is only ever active on one worker at a time.
 *
 * Worker 0 = the original accounts (breeder_jane and friends), so a
 * single-worker run behaves exactly as it always has. Workers 1..2 are seeded
 * by supabase-dev/seed-e2e-worker-fixtures.sql — seed another set before
 * raising `workers` in playwright.config.ts.
 *
 * TEST_PARALLEL_INDEX, NOT TEST_WORKER_INDEX. The worker index increments
 * every time Playwright replaces a worker process (it spawns a fresh one after
 * any test failure), so one flaky test sent the replacement hunting for a
 * `…-w3@` account that was never seeded and every later file on that worker
 * failed sign-in. The parallel index is the stable slot (0..workers-1), which
 * is exactly the guarantee the accounts need: one slot, one account set,
 * active on one worker at a time.
 *
 * Seeded PUBLIC content (breeder_jane's pets, /c/max-c1, sunny_paws_aviary)
 * stays referenced by literal in guest read-only tests: those never sign in,
 * so they cannot collide.
 */
const WORKER = Number(process.env.TEST_PARALLEL_INDEX ?? "0");

function workerEmail(base: string): string {
  return WORKER === 0 ? base : base.replace("@", `-w${WORKER}@`);
}

/** Identity-verified seller (worker 0: scrlpets-e2e@…, username breeder_jane). */
export const SELLER_EMAIL = workerEmail(
  process.env.E2E_EMAIL ?? "scrlpets-e2e@scrlpets.com",
);
/** Deliberately UNVERIFIED member — the verification-gate specs depend on it. */
export const MEMBER_EMAIL = workerEmail("scrlpets-rbac-e2e@scrlpets.com");
/** Third profile for outsider/forgery probes. */
export const THIRD_EMAIL = workerEmail("scrlpets-rbac-third@scrlpets.com");

export const SELLER_USERNAME = WORKER === 0 ? "breeder_jane" : `e2e_seller_w${WORKER}`;
export const MEMBER_USERNAME =
  WORKER === 0 ? "scrlpets-rbac-e2e_8f62" : `e2e_member_w${WORKER}`;
export const THIRD_USERNAME =
  WORKER === 0 ? "scrlpets-rbac-third_2138" : `e2e_third_w${WORKER}`;

// Fixed ids: worker 0 = the original accounts; seeded workers use the
// deterministic 000…00N1/N2/N3 block from the seed file.
export const SELLER_PROFILE_ID =
  WORKER === 0
    ? "00000000-0000-0000-0000-000000000001"
    : `00000000-0000-0000-0000-0000000000${WORKER}1`;
export const MEMBER_PROFILE_ID =
  WORKER === 0
    ? "8f62eba7-aa0a-4603-8134-5e37ca74ab23"
    : `00000000-0000-0000-0000-0000000000${WORKER}2`;
export const THIRD_PROFILE_ID =
  WORKER === 0
    ? "2138dc38-36de-41b0-863e-34028cbd301a"
    : `00000000-0000-0000-0000-0000000000${WORKER}3`;

/**
 * Cached API sign-in.
 *
 * 26 spec files each call `signInWithPassword` — 47 call sites, several per
 * test. Against a production-build server the suite runs fast enough that
 * those pack into a window Supabase auth starts refusing, and a refused
 * sign-in surfaces as `auth.data.user` being null deep inside a spec (18
 * failures, all "Cannot read properties of null"). Sessions are per-account
 * and reusable, so each worker signs in ONCE per account and hands the same
 * authenticated client back afterwards.
 *
 * Retries exist for the genuinely-first sign-in of a run, where several
 * workers still race each other.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const sessions = new Map<string, { db: SupabaseClient; userId: string }>();

export async function signInCached(
  email: string,
): Promise<{ db: SupabaseClient; userId: string }> {
  const cached = sessions.get(email);
  if (cached) return cached;

  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const auth = await db.auth.signInWithPassword({
      email,
      password: process.env.E2E_PASSWORD!,
    });
    if (auth.data.user) {
      const entry = { db, userId: auth.data.user.id };
      sessions.set(email, entry);
      return entry;
    }
    lastError = auth.error?.message ?? "no user returned";
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`E2E sign-in failed for ${email}: ${lastError}`);
}
