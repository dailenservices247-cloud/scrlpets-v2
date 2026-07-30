import { createClient } from "@/lib/supabase/server";

export type SubjectEntity = {
  id: string;
  name: string;
  brandId: string | null;
};

type Row = { id: string; name: string; brand_id: string | null };

async function getMine(
  table: "litters" | "services",
  userId: string,
  brandIds: string[],
): Promise<SubjectEntity[]> {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id, name, brand_id")
    .order("created_at", { ascending: false })
    .limit(50);
  query =
    brandIds.length > 0
      ? query.or(`owner_id.eq.${userId},brand_id.in.(${brandIds.join(",")})`)
      : query.eq("owner_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Row[]).map((r) => ({ id: r.id, name: r.name, brandId: r.brand_id }));
}

/** Slice C: the composer's referenceable subject entities for this person. */
export async function getMySubjects(userId: string, brandIds: string[]) {
  const supabase = await createClient();
  const [litters, services, { data: promos }] = await Promise.all([
    getMine("litters", userId, brandIds),
    getMine("services", userId, brandIds),
    supabase
      .from("promos")
      .select("id, title")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
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
