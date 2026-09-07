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

describe("correcting a mis-set roster flag", () => {
  /**
   * The tick is easy to get wrong in either direction, and until now there was
   * no way back: updateCreatureDetails deliberately does not touch in_roster,
   * so a mistake stranded a real animal off the owner's public profile with no
   * UI able to undo it. This is that path, kept separate from the bulk edit for
   * the same reason — an unrelated form must never move an animal in or out of
   * the roster as a side effect.
   */
  function form(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("takes an animal off the roster", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    const result = await setInRoster(form({ targetCreature: "c1", inRoster: "false" }));
    expect(result).toEqual({ ok: true });
    expect(q.__calls.find((c) => c.method === "update")?.args[0]).toEqual({ in_roster: false });
  });

  it("puts one back on it", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    const result = await setInRoster(form({ targetCreature: "c1", inRoster: "true" }));
    expect(result).toEqual({ ok: true });
    expect(q.__calls.find((c) => c.method === "update")?.args[0]).toEqual({ in_roster: true });
  });

  it("writes nothing but the flag", async () => {
    // The whole reason this is not part of updateCreatureDetails. If it ever
    // grows a second column, it can clobber a field the operator did not touch.
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    await setInRoster(form({ targetCreature: "c1", inRoster: "false" }));
    const payload = q.__calls.find((c) => c.method === "update")?.args[0] as object;
    expect(Object.keys(payload)).toEqual(["in_roster"]);
  });

  it("refuses a missing value instead of defaulting it onto the roster", async () => {
    // createTreeAnimal reads a MISSING flag as true, which is right there — an
    // animal nobody marked as somebody else's is your own. Here the same
    // default would be a bug: a dropped field would silently republish an
    // ancestor onto the public roster, which is the misrepresentation this
    // whole column exists to stop. No write may happen at all.
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    const result = await setInRoster(form({ targetCreature: "c1" }));
    expect(result).toEqual({ ok: false, error: "required" });
    expect(q.__calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("refuses a value that is neither true nor false", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    const result = await setInRoster(form({ targetCreature: "c1", inRoster: "yes" }));
    expect(result).toEqual({ ok: false, error: "required" });
    expect(q.__calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("refuses a missing animal", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    const { setInRoster } = await import("@/lib/tree/actions");
    const result = await setInRoster(form({ inRoster: "false" }));
    expect(result).toEqual({ ok: false, error: "required" });
    expect(q.__calls.find((c) => c.method === "update")).toBeUndefined();
  });
});
