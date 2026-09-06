import { createClient } from "@/lib/supabase/server";
import type {
  AnchorType,
  AssuranceLevel,
  CreatureRole,
  Gender,
  GeneticTestType,
  GeneticTestResult,
} from "./types";

export type CreatureDetail = {
  id: string;
  species: string | null;
  breed: string | null;
  gender: Gender | null;
  color: string | null;
  markings: string | null;
  birthDate: string | null;
  registrationNumber: string | null;
  creatureRole: CreatureRole;
  pageVisible: boolean;
  deceasedAt: string | null;
  memorialMessage: string | null;
  litterId: string | null;
  archivedAt: string | null;
  /** The anchor's TYPE only. The value is revoked from every client role —
   * getMyCreatureAnchor is the owner's read path, verifyCreatureAnchor the
   * scanner's. */
  anchorType: AnchorType | null;
  /** The animal's own picture. Nullable by design — the letter placeholder is
   * a legitimate resting state, unlike legacy which forced photo_url NOT NULL. */
  avatarUrl: string | null;
};

type CreatureDetailRow = {
  id: string;
  species: string | null;
  breed: string | null;
  gender: Gender | null;
  color: string | null;
  markings: string | null;
  birth_date: string | null;
  registration_number: string | null;
  creature_role: CreatureRole;
  page_visible: boolean;
  deceased_at: string | null;
  memorial_message: string | null;
  litter_id: string | null;
  archived_at: string | null;
  anchor_type: AnchorType | null;
  avatar_url: string | null;
};

const DETAIL_COLUMNS =
  "id,species,breed,gender,color,markings,birth_date,registration_number,creature_role,page_visible,deceased_at,memorial_message,litter_id,archived_at,anchor_type,avatar_url";

function toCreatureDetail(r: CreatureDetailRow): CreatureDetail {
  return {
    id: r.id,
    species: r.species,
    breed: r.breed,
    gender: r.gender,
    color: r.color,
    markings: r.markings,
    birthDate: r.birth_date,
    registrationNumber: r.registration_number,
    creatureRole: r.creature_role,
    pageVisible: r.page_visible,
    deceasedAt: r.deceased_at,
    memorialMessage: r.memorial_message,
    litterId: r.litter_id,
    archivedAt: r.archived_at,
    anchorType: r.anchor_type,
    avatarUrl: r.avatar_url,
  };
}

/** Phase 2 fields on top of the base CreatureProfile (profiles/queries.ts owns
 * the identity/hero fields; this covers everything the About card, memorial
 * flow, and owner edit sheet need). */
export async function getCreatureDetail(creatureId: string): Promise<CreatureDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select(DETAIL_COLUMNS)
    .eq("id", creatureId)
    .maybeSingle();
  if (!data) return null;
  return toCreatureDetail(data as CreatureDetailRow);
}

/** The anchor VALUE, and only for the animal's own keeper — they need it for a
 * vet or a registry. The column is revoked from anon/authenticated, so this
 * definer is the only read path that exists; it returns null for everybody
 * else, without distinguishing "not yours" from "not set". */
export async function getMyCreatureAnchor(creatureId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_creature_anchor", { target_creature: creatureId });
  return (data as string | null) ?? null;
}

/** The public trust signal (anchored / documented / declared). Derived by the
 * DB on every read. A failed call falls back to "declared", the weakest level:
 * a read error must never be able to UPGRADE what a listing claims. */
export async function getCreatureAssurance(creatureId: string): Promise<AssuranceLevel> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("creature_assurance", { target_creature: creatureId });
  return (data as AssuranceLevel | null) ?? "declared";
}

export type GeneticTest = {
  id: string;
  testType: GeneticTestType;
  conditionName: string;
  result: GeneticTestResult;
  grade: string | null;
  geneName: string | null;
  genotype: string | null;
  provider: string | null;
  testDate: string | null;
  certificateNumber: string | null;
  notes: string | null;
};

type GeneticTestRow = {
  id: string;
  test_type: GeneticTestType;
  condition_name: string;
  result: GeneticTestResult;
  grade: string | null;
  gene_name: string | null;
  genotype: string | null;
  provider: string | null;
  test_date: string | null;
  certificate_number: string | null;
  notes: string | null;
};

function toGeneticTest(r: GeneticTestRow): GeneticTest {
  return {
    id: r.id,
    testType: r.test_type,
    conditionName: r.condition_name,
    result: r.result,
    grade: r.grade,
    geneName: r.gene_name,
    genotype: r.genotype,
    provider: r.provider,
    testDate: r.test_date,
    certificateNumber: r.certificate_number,
    notes: r.notes,
  };
}

/** Public read (RLS follows creature visibility) — every test is self-reported
 * by the owner; the UI labels that explicitly, it is never presented as a
 * platform-run check. */
export async function getGeneticTests(creatureId: string): Promise<GeneticTest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("genetic_tests")
    .select(
      "id,test_type,condition_name,result,grade,gene_name,genotype,provider,test_date,certificate_number,notes",
    )
    .eq("creature_id", creatureId)
    .order("test_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as GeneticTestRow[]).map(toGeneticTest);
}

export type LineageCreature = {
  id: string;
  name: string;
  slug: string;
  species: string | null;
  avatarUrl: string | null;
  parentType: "sire" | "dam";
};

type LineageCardRow = {
  id: string;
  name: string;
  slug: string;
  species: string | null;
  avatar_url: string | null;
};

/** creature_lineage has two FKs into creatures (creature_id/parent_id), so we
 * fetch the edges and the creature rows as two flat queries and join in JS
 * rather than guess PostgREST's embedded-relation FK-hint syntax. This also
 * means a hidden/private creature on either side of the edge simply won't
 * come back from the second query (creatures RLS applies independently),
 * which is the correct behavior — a link never leaks a card the viewer
 * couldn't otherwise see. */
async function loadLineageCards(
  edges: { relatedId: string; parentType: "sire" | "dam" }[],
): Promise<LineageCreature[]> {
  if (edges.length === 0) return [];
  const supabase = await createClient();
  const ids = edges.map((e) => e.relatedId);
  const { data } = await supabase
    .from("creatures")
    .select("id,name,slug,species,avatar_url")
    .in("id", ids);
  const byId = new Map(((data ?? []) as LineageCardRow[]).map((c) => [c.id, c]));
  return edges.flatMap((edge) => {
    const c = byId.get(edge.relatedId);
    if (!c) return [];
    return [{
      id: c.id,
      name: c.name,
      slug: c.slug,
      species: c.species,
      avatarUrl: c.avatar_url,
      parentType: edge.parentType,
    }];
  });
}

/** Parents of this creature (sire/dam), only the ones the viewer can see. */
export async function getCreatureParents(creatureId: string): Promise<LineageCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creature_lineage")
    .select("parent_id,parent_type")
    .eq("creature_id", creatureId);
  const edges = (data ?? []).map((r) => ({
    relatedId: r.parent_id as string,
    parentType: r.parent_type as "sire" | "dam",
  }));
  return loadLineageCards(edges);
}

/** Offspring of this creature — parentType is the role THIS creature plays
 * for that offspring (sire or dam). */
export async function getCreatureOffspring(creatureId: string): Promise<LineageCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creature_lineage")
    .select("creature_id,parent_type")
    .eq("parent_id", creatureId);
  const edges = (data ?? []).map((r) => ({
    relatedId: r.creature_id as string,
    parentType: r.parent_type as "sire" | "dam",
  }));
  return loadLineageCards(edges);
}

/** Litters are public-read (name-only lookup for the "From litter" link). */
export async function getLitterName(litterId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("litters").select("id,name").eq("id", litterId).maybeSingle();
  return data ?? null;
}
