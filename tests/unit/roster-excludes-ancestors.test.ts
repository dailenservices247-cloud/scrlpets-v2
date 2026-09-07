import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A recorded ancestor is not an animal you own.
 *
 * Recording a pedigree means creating a `creatures` row for every ancestor —
 * `creature_lineage` foreign-keys both sides to `creatures(id)` and
 * `link_creature_parent` refuses a parent you do not own, so there is nowhere
 * else for a sire or a granddam to live. That makes `owner_id` mean TWO things:
 * "this person owns this animal" and "this person authored this record". The
 * public profile read the second as the first, so a breeder with two dogs who
 * recorded one UKC certificate published "Animals 8" — six of them owned by
 * other named people. `in_roster` is the column that separates the two.
 *
 * These assert the SHAPE of the call, not a filtered result: the exclusion has
 * to happen in SQL, and a test returning rows would pass just as well against a
 * query that ships every ancestor over the wire and drops them in JS.
 *
 * Both halves are pinned here on purpose. A filter that nothing ever sets to
 * false is inert, and a writer whose flag nothing reads is decoration — either
 * alone passes while the profile keeps lying.
 */

const OWNER = "11111111-1111-1111-1111-111111111111";

type Call = { method: string; args: unknown[] };

/** Records every chained call and resolves to `result` when awaited. */
function chain(result: unknown) {
  const calls: Call[] = [];
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "__calls") return calls;
        if (prop === "then") return (res: (v: unknown) => void) => res(result);
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return proxy;
        };
      },
    },
  ) as Record<string, unknown>;
  return proxy as Record<string, unknown> & { __calls: Call[] };
}

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from,
    auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("the public profile's animal read", () => {
  it("asks the database for roster animals only", async () => {
    const q = chain({ data: [] });
    from.mockReturnValue(q);
    const { getCreaturesByOwner } = await import("@/lib/profiles/queries");
    await getCreaturesByOwner(OWNER);
    // The profile page derives the "Animals" metric AND the AnimalRail from
    // this one array, so excluding an ancestor here excludes it from both.
    expect(q.__calls).toContainEqual({ method: "eq", args: ["in_roster", true] });
  });

  it("leaves archived animals out too", async () => {
    // Found in the same function: every OTHER owner-scoped read drops archived
    // rows (the tree, the breeder roster, the listing picker), and this one did
    // not. An animal the operator archived still counted on their public
    // profile — the same over-count, a different cause.
    const q = chain({ data: [] });
    from.mockReturnValue(q);
    const { getCreaturesByOwner } = await import("@/lib/profiles/queries");
    await getCreaturesByOwner(OWNER);
    expect(q.__calls).toContainEqual({ method: "is", args: ["archived_at", null] });
  });
});

describe("recording an ancestor from the tree", () => {
  it("keeps the ancestor out of the roster", async () => {
    const q = chain({ data: { id: "c1" }, error: null });
    from.mockReturnValue(q);
    const { createTreeAnimal } = await import("@/lib/tree/actions");
    const form = new FormData();
    form.set("name", "Ch. Beech Hill Rocky");
    form.set("inRoster", "false");
    await createTreeAnimal(form);
    const insert = q.__calls.find((c) => c.method === "insert");
    expect((insert?.args[0] as { in_roster?: boolean }).in_roster).toBe(false);
  });

  it("keeps an animal you actually own in it", async () => {
    // The same sheet adds both. If it did not discriminate, the assertion above
    // would pass against a writer that marks EVERY tree animal an ancestor.
    const q = chain({ data: { id: "c2" }, error: null });
    from.mockReturnValue(q);
    const { createTreeAnimal } = await import("@/lib/tree/actions");
    const form = new FormData();
    form.set("name", "Big Meech");
    await createTreeAnimal(form);
    const insert = q.__calls.find((c) => c.method === "insert");
    expect((insert?.args[0] as { in_roster?: boolean }).in_roster).toBe(true);
  });
});
