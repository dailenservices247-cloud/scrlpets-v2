import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The composer's subject list used to be fetched with
 * `.or("owner_id.eq.<uid>,brand_id.in.(<every brand id>)")`. That URL grows
 * with the number of brands a person manages, and at ~400 brands it crossed
 * PostgREST's 16KB header limit: the query threw UND_ERR_HEADERS_OVERFLOW,
 * /compose rendered the error boundary, and the composer was simply gone.
 * These tests pin the shape that cannot do that — two bounded queries whose
 * request size is independent of how many brands exist — plus the merge rules
 * that shape now has to get right on its own.
 */

type Call = { table: string; select: string; filters: [string, string][]; ors: string[] };
const calls: Call[] = [];

type Row = { id: string; name?: string; title?: string; brand_id: string | null; created_at: string };
let ownRows: Record<string, Row[]> = {};
let brandRows: Record<string, Row[]> = {};
let promoRows: Row[] = [];

function rowsFor(call: Call): Row[] {
  if (call.table === "promos") return promoRows;
  return call.select.includes("brand_memberships")
    ? (brandRows[call.table] ?? [])
    : (ownRows[call.table] ?? []);
}

function builder(table: string) {
  const call: Call = { table, select: "", filters: [], ors: [] };
  calls.push(call);
  const self = {
    select(cols: string) { call.select = cols; return self; },
    eq(col: string, val: string) { call.filters.push([col, String(val)]); return self; },
    or(expr: string) { call.ors.push(expr); return self; },
    order() { return self; },
    limit() { return self; },
    then(ok: (r: unknown) => unknown, err?: (e: unknown) => unknown) {
      return Promise.resolve({ data: rowsFor(call), error: null }).then(ok, err);
    },
  };
  return self;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => builder(table) }),
}));

const { getMySubjects } = await import("@/lib/subjects/queries");

const UID = "11111111-1111-1111-1111-111111111111";
const BRAND = "22222222-2222-2222-2222-222222222222";

function litter(id: string, name: string, created_at: string, brand_id: string | null = null): Row {
  return { id, name, brand_id, created_at };
}

beforeEach(() => {
  calls.length = 0;
  ownRows = { litters: [], services: [] };
  brandRows = { litters: [], services: [] };
  promoRows = [];
});

describe("getMySubjects", () => {
  it("asks for brand-managed subjects by membership, never by a list of brand ids", async () => {
    await getMySubjects(UID);
    // The overflow came from packing ids into a filter. Nothing may do that:
    // no `.or()` at all, and no single filter value longer than one uuid.
    expect(calls.flatMap((c) => c.ors)).toEqual([]);
    for (const [, value] of calls.flatMap((c) => c.filters)) {
      expect(value.length).toBeLessThanOrEqual(36);
    }
    // Membership is the criterion, expressed as a join the DB resolves.
    const joined = calls.filter((c) => c.select.includes("brand_memberships!inner"));
    expect(joined.map((c) => c.table).sort()).toEqual(["litters", "services"]);
    for (const call of joined) {
      expect(call.filters).toContainEqual(["brands.brand_memberships.profile_id", UID]);
    }
  });

  it("merges the two result sets without listing a subject twice", async () => {
    const shared = litter("l1", "Spring Litter", "2026-03-01T00:00:00Z", BRAND);
    ownRows.litters = [shared, litter("l2", "Solo Litter", "2026-02-01T00:00:00Z")];
    brandRows.litters = [shared, litter("l3", "Brand Litter", "2026-01-01T00:00:00Z", BRAND)];

    const { litters } = await getMySubjects(UID);
    expect(litters.map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
    expect(litters[0]).toEqual({ id: "l1", name: "Spring Litter", brandId: BRAND });
  });

  it("keeps the newest 50 across both sets, not 50 from each", async () => {
    ownRows.litters = Array.from({ length: 50 }, (_, i) =>
      litter(`own-${i}`, `Own ${i}`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    );
    brandRows.litters = [litter("newest", "Newest", "2027-01-01T00:00:00Z", BRAND)];

    const { litters } = await getMySubjects(UID);
    expect(litters).toHaveLength(50);
    expect(litters[0].id).toBe("newest");
  });

  it("still maps promos to products", async () => {
    promoRows = [{ id: "p1", title: "Collar", brand_id: null, created_at: "2026-01-01T00:00:00Z" }];
    const { products } = await getMySubjects(UID);
    expect(products).toEqual([{ id: "p1", name: "Collar", brandId: null }]);
  });
});
