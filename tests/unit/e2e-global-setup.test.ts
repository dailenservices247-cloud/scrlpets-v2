import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 2026-09-21: every Playwright run spent ~60s in globalSetup before its first
 * test. The creature sweep called delete_creature_if_unreferenced once per
 * `E2E ` creature, awaiting each before sending the next, and on dev all 1,844
 * of those creatures were still referenced — so every run paid a ~95ms refusal
 * for each of them, one after another (662 on the busiest account alone).
 *
 * What the sweep removes must not change: every stray is still offered to the
 * RPC exactly once, and only after the litter delete that clears litter_id.
 * Only the waiting changes.
 */

const STRAY_OWNER = "scrlpets-rbac-e2e@scrlpets.com";
const STRAYS = Array.from({ length: 40 }, (_, i) => `creature-${i}`);

const log: string[] = [];
let inFlight = 0;
let maxInFlight = 0;

function query(table: string, owner: string) {
  const rows = table === "creatures" && owner === STRAY_OWNER ? STRAYS.map((id) => ({ id })) : [];
  const chain = {
    select: () => chain,
    delete: () => chain,
    eq: () => chain,
    like: () => chain,
    is: () => chain,
    then: (resolve: (value: unknown) => void) => {
      log.push(`${table} done for ${owner}`);
      resolve({ data: rows, error: null });
    },
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    let owner = "";
    return {
      auth: {
        signInWithPassword: async ({ email }: { email: string }) => {
          owner = email;
          return { data: { user: { id: email } }, error: null };
        },
      },
      from: (table: string) => query(table, owner),
      rpc: async (fn: string, args: Record<string, string>) => {
        log.push(`${fn} ${Object.values(args)[0]}`);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        return { data: null, error: { message: "creature_referenced" } };
      },
    };
  },
}));

describe("e2e globalSetup creature sweep", () => {
  beforeEach(async () => {
    log.length = 0;
    inFlight = 0;
    maxInFlight = 0;
    vi.stubEnv("E2E_PASSWORD", "unused");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("")));
    const { default: globalSetup } = await import("../e2e/global-setup");
    await globalSetup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("offers every stray creature to the RPC exactly once, after its owner's litters are deleted", () => {
    const calls = log.filter((line) => line.startsWith("delete_creature_if_unreferenced "));
    expect(calls.toSorted()).toEqual(
      STRAYS.map((id) => `delete_creature_if_unreferenced ${id}`).toSorted(),
    );
    expect(log.indexOf(`litters done for ${STRAY_OWNER}`)).toBeGreaterThan(-1);
    expect(log.indexOf(`litters done for ${STRAY_OWNER}`)).toBeLessThan(log.indexOf(calls[0]));
  });

  it("keeps several creature RPCs in flight at once, but a bounded number", () => {
    // One at a time, the refusals queue end to end: ~60s per run on dev.
    expect(maxInFlight).toBeGreaterThan(1);
    // ... and never the whole backlog at once against the shared dev project.
    expect(maxInFlight).toBeLessThanOrEqual(16);
  });
});
