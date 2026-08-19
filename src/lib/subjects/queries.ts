import { createClient } from "@/lib/supabase/server";

export type SubjectEntity = {
  id: string;
  name: string;
  brandId: string | null;
};

type Row = { id: string; name: string; brand_id: string | null; created_at: string };

const LIMIT = 50;

/**
 * The subjects a person may post about: the ones they own, plus the ones owned
 * by a brand they belong to.
 *
 * Two bounded queries, not one `or(owner_id.eq.…,brand_id.in.(<every brand id>))`.
 * That filter grew with the caller's brand count and, at a few hundred brands,
 * pushed the request URL past PostgREST's 16KB header limit — the query died
 * with UND_ERR_HEADERS_OVERFLOW and took the whole /compose render down with
 * it. Membership is resolved by the database through the join here, so the
 * request size no longer depends on how many brands exist.
 */
async function getMine(
  table: "litters" | "services",
  userId: string,
): Promise<SubjectEntity[]> {
  const supabase = await createClient();
  const [own, viaBrand] = await Promise.all([
    supabase
      .from(table)
      .select("id, name, brand_id, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from(table)
      .select("id, name, brand_id, created_at, brands!inner(brand_memberships!inner(profile_id))")
      .eq("brands.brand_memberships.profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);
  if (own.error) throw own.error;
  if (viaBrand.error) throw viaBrand.error;
  const byId = new Map<string, Row>();
  for (const row of [...(own.data ?? []), ...(viaBrand.data ?? [])] as Row[]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  // Each query is newest-first on its own, so the merge has to re-sort: the cap
  // must keep the newest LIMIT overall, not LIMIT from whichever set is longer.
  return [...byId.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, LIMIT)
    .map((r) => ({ id: r.id, name: r.name, brandId: r.brand_id }));
}

/** Slice C: the composer's referenceable subject entities for this person. */
export async function getMySubjects(userId: string) {
  const supabase = await createClient();
  const [litters, services, { data: promos }] = await Promise.all([
    getMine("litters", userId),
    getMine("services", userId),
    supabase
      .from("promos")
      .select("id, title")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);
  return {
    litters,
    services,
    products: ((promos ?? []) as { id: string; title: string }[]).map((p) => ({
      id: p.id,
      name: p.title,
      brandId: null,
    })),
  };
}
