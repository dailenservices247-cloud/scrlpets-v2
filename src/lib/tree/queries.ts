import { createClient } from "@/lib/supabase/server";

export type TreePrivacy = "public" | "buyers" | "private";

export type TreeCreature = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatarUrl: string | null;
  creatureRole: "pet" | "breeding";
  pageVisible: boolean;
  deceasedAt: string | null;
  memorialMessage: string | null;
  birthDate: string | null;
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
  sireId: string | null;
  damId: string | null;
  /** Derived, not the DB column — see assembleTree() below. */
  generation: number;
  /** Derived, not the DB column — see assembleTree() below. */
  isFounder: boolean;
};

export type TreeGeneration = { generation: number; creatures: TreeCreature[] };

export type TreeData = { creatures: TreeCreature[]; generations: TreeGeneration[] };

type RawCreatureRow = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatar_url: string | null;
  creature_role: "pet" | "breeding";
  page_visible: boolean;
  deceased_at: string | null;
  memorial_message: string | null;
  birth_date: string | null;
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
};

type RawLineageEdge = { creature_id: string; parent_id: string; parent_type: "sire" | "dam" };

const CREATURE_COLUMNS =
  "id,name,species,slug,avatar_url,creature_role,page_visible,deceased_at,memorial_message,birth_date,breed,gender";

/**
 * generation/is_founder ARE DB columns, but link_creature_parent/unlink_creature_parent
 * only recompute the CHILD side of a link (see the migration). A true founder
 * that is never itself passed as target_creature keeps generation=NULL and
 * is_founder=false forever — including every animal seeded before this
 * feature existed. Deriving both from the fetched lineage edges is always
 * correct, needs no extra RPC round trip, and needs no DB change, so the raw
 * columns aren't even selected above.
 */
function assembleTree(rows: RawCreatureRow[], edges: RawLineageEdge[]): TreeData {
  const parentsByChild = new Map<string, { sireId: string | null; damId: string | null }>();
  for (const row of rows) parentsByChild.set(row.id, { sireId: null, damId: null });
  for (const edge of edges) {
    const slot = parentsByChild.get(edge.creature_id);
    if (!slot) continue;
    if (edge.parent_type === "sire") slot.sireId = edge.parent_id;
    else slot.damId = edge.parent_id;
  }

  const known = new Set(rows.map((r) => r.id));
  const generationCache = new Map<string, number>();
  function generationOf(id: string, seen: Set<string>): number {
    const cached = generationCache.get(id);
    if (cached !== undefined) return cached;
    // Lineage cycles are refused at the DB (link_creature_parent's cycle guard);
    // this is only a defensive stop so a bad read can't hang the request.
    if (seen.has(id)) return 1;
    seen.add(id);
    const slot = parentsByChild.get(id);
    const parentIds = [slot?.sireId, slot?.damId].filter((pid): pid is string => !!pid && known.has(pid));
    const generation = parentIds.length === 0 ? 1 : 1 + Math.max(...parentIds.map((pid) => generationOf(pid, seen)));
    generationCache.set(id, generation);
    return generation;
  }

  const creatures: TreeCreature[] = rows.map((row) => {
    const slot = parentsByChild.get(row.id)!;
    // A parent that exists as an edge but was filtered out of this fetch (a
    // hidden creature on the visitor path) is treated as no link at all —
    // never point a connector or a founder computation at a card that isn't
    // being rendered.
    const sireId = slot.sireId && known.has(slot.sireId) ? slot.sireId : null;
    const damId = slot.damId && known.has(slot.damId) ? slot.damId : null;
    return {
      id: row.id,
      name: row.name,
      species: row.species,
      slug: row.slug,
      avatarUrl: row.avatar_url,
      creatureRole: row.creature_role,
      pageVisible: row.page_visible,
      deceasedAt: row.deceased_at,
      memorialMessage: row.memorial_message,
      birthDate: row.birth_date,
      breed: row.breed,
      gender: row.gender,
      sireId,
      damId,
      generation: generationOf(row.id, new Set()),
      isFounder: !sireId && !damId && row.creature_role === "breeding",
    };
  });

  const byGeneration = new Map<number, TreeCreature[]>();
  for (const creature of creatures) {
    if (!byGeneration.has(creature.generation)) byGeneration.set(creature.generation, []);
    byGeneration.get(creature.generation)!.push(creature);
  }
  const generations = [...byGeneration.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, genCreatures]) => ({ generation, creatures: genCreatures }));

  return { creatures, generations };
}

async function fetchTree(ownerId: string, onlyVisible: boolean): Promise<TreeData> {
  const supabase = await createClient();
  let query = supabase.from("creatures").select(CREATURE_COLUMNS).eq("owner_id", ownerId);
  if (onlyVisible) query = query.eq("page_visible", true);
  const { data: rows } = await query.order("created_at");
  const creatures = (rows ?? []) as RawCreatureRow[];
  if (creatures.length === 0) return { creatures: [], generations: [] };

  const ids = creatures.map((c) => c.id);
  const { data: edges } = await supabase
    .from("creature_lineage")
    .select("creature_id,parent_id,parent_type")
    .in("creature_id", ids);

  return assembleTree(creatures, (edges ?? []) as RawLineageEdge[]);
}

/** The operator's own tree — every creature they own, regardless of page_visible (R16 console view). */
export async function getOwnTree(ownerId: string): Promise<TreeData> {
  return fetchTree(ownerId, false);
}

/** A visitor's rendered tree — page_visible creatures only. */
export async function getVisitorTree(ownerId: string): Promise<TreeData> {
  return fetchTree(ownerId, true);
}

export type TreeOwnerProfile = {
  id: string;
  username: string;
  displayName: string | null;
  treePrivacy: TreePrivacy;
};

/** Scoped to what the tree route needs (id, username, display name, privacy) — not a rewrite of profiles/queries.ts. */
export async function getTreeOwnerProfile(username: string): Promise<TreeOwnerProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,tree_privacy")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    treePrivacy: data.tree_privacy as TreePrivacy,
  };
}

export async function getTreePrivacy(ownerId: string): Promise<TreePrivacy> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("tree_privacy").eq("id", ownerId).maybeSingle();
  return (data?.tree_privacy as TreePrivacy | undefined) ?? "public";
}

/** "buyers" privacy = viewer has an ACCEPTED pack link with the tree owner, either direction. */
export async function hasAcceptedPackLink(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pack_links")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${ownerId}),and(requester_id.eq.${ownerId},addressee_id.eq.${viewerId})`,
    )
    .maybeSingle();
  return !!data;
}

/** Pack size stat for the header: accepted links in either direction. */
export async function getAcceptedPackLinkCount(ownerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pack_links")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${ownerId},addressee_id.eq.${ownerId}`);
  return count ?? 0;
}
