import { createClient } from "@/lib/supabase/server";

export type PedigreeNode = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
  role: "subject" | "sire" | "dam";
  generation: number;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
};

export type PedigreeData = {
  subject: PedigreeNode;
  coiPercentage: number;
  generationsCount: number;
  totalAncestorsFound: number;
  commonAncestors: { id: string; name: string }[];
};

type CreatureRow = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
};

type LineageEdge = {
  creature_id: string;
  parent_id: string;
  parent_type: "sire" | "dam";
};

/**
 * Computes Wright's Coefficient of Inbreeding (COI) given sire and dam ancestor graph.
 * F = sum( (1/2)^(n1 + n2 + 1) )
 */
export function calculateCOI(
  sireId: string | null,
  damId: string | null,
  parentEdges: Map<string, { sireId: string | null; damId: string | null }>,
): { coi: number; commonAncestorIds: string[] } {
  if (!sireId || !damId) {
    return { coi: 0, commonAncestorIds: [] };
  }

  // Find all ancestor paths from a starting node: ancestorId -> array of step lengths
  function getAncestorPaths(startId: string, currentDepth: number, visited: Set<string>): Map<string, number[]> {
    const paths = new Map<string, number[]>();
    if (visited.has(startId) || currentDepth > 5) return paths;
    visited.add(startId);

    const parents = parentEdges.get(startId);
    if (!parents) return paths;

    const directParents = [
      { id: parents.sireId, depth: currentDepth + 1 },
      { id: parents.damId, depth: currentDepth + 1 },
    ].filter((p): p is { id: string; depth: number } => Boolean(p.id));

    for (const parent of directParents) {
      if (!paths.has(parent.id)) paths.set(parent.id, []);
      paths.get(parent.id)!.push(parent.depth);

      const subPaths = getAncestorPaths(parent.id, parent.depth, new Set(visited));
      for (const [ancId, depths] of subPaths.entries()) {
        if (!paths.has(ancId)) paths.set(ancId, []);
        paths.get(ancId)!.push(...depths);
      }
    }

    return paths;
  }

  // Step lengths from Sire (0-indexed relative to Sire: Sire's direct parents are depth 1 from Sire)
  const sireAncestors = getAncestorPaths(sireId, 0, new Set());
  // Step lengths from Dam (0-indexed relative to Dam: Dam's direct parents are depth 1 from Dam)
  const damAncestors = getAncestorPaths(damId, 0, new Set());

  // Check if Sire and Dam are identical (self-mating edge case)
  if (sireId === damId) {
    return { coi: 0.5, commonAncestorIds: [sireId] };
  }

  // Check if Dam is an ancestor of Sire, or Sire is an ancestor of Dam (parent-offspring mating)
  let parentChildCoi = 0;
  const commonIds = new Set<string>();

  if (sireAncestors.has(damId)) {
    for (const d of sireAncestors.get(damId)!) {
      parentChildCoi += Math.pow(0.5, d);
      commonIds.add(damId);
    }
  }

  if (damAncestors.has(sireId)) {
    for (const d of damAncestors.get(sireId)!) {
      parentChildCoi += Math.pow(0.5, d);
      commonIds.add(sireId);
    }
  }

  let coi = parentChildCoi;

  // Find common ancestors in both genealogies
  for (const [ancestorId, sireDepths] of sireAncestors.entries()) {
    if (damAncestors.has(ancestorId)) {
      commonIds.add(ancestorId);
      const damDepths = damAncestors.get(ancestorId)!;
      for (const ls of sireDepths) {
        for (const ld of damDepths) {
          // n1 steps from sire, n2 steps from dam + 1
          coi += Math.pow(0.5, ls + ld + 1);
        }
      }
    }
  }

  return {
    coi: Math.min(1, coi),
    commonAncestorIds: [...commonIds],
  };
}

/**
 * Loads a complete 3-generation pedigree tree for an animal, including Wright's COI.
 */
export async function getCreaturePedigree(
  creatureId: string,
  maxGenerations: number = 3,
): Promise<PedigreeData | null> {
  const supabase = await createClient();

  // 1. Fetch subject creature
  const { data: subjectData } = await supabase
    .from("creatures")
    .select("id, name, slug, avatar_url, breed, gender")
    .eq("id", creatureId)
    .single();

  if (!subjectData) return null;

  // 2. Fetch lineage edges up to maxGenerations
  const parentMap = new Map<string, { sireId: string | null; damId: string | null }>();
  const allCreatureIds = new Set<string>([creatureId]);
  let currentLevelIds = [creatureId];

  for (let gen = 1; gen <= maxGenerations; gen++) {
    if (currentLevelIds.length === 0) break;

    const { data: edges } = await supabase
      .from("creature_lineage")
      .select("creature_id, parent_id, parent_type")
      .in("creature_id", currentLevelIds);

    const lineageEdges = (edges ?? []) as unknown as LineageEdge[];
    const nextLevelIds: string[] = [];

    for (const edge of lineageEdges) {
      if (!parentMap.has(edge.creature_id)) {
        parentMap.set(edge.creature_id, { sireId: null, damId: null });
      }
      const slot = parentMap.get(edge.creature_id)!;
      if (edge.parent_type === "sire") slot.sireId = edge.parent_id;
      else if (edge.parent_type === "dam") slot.damId = edge.parent_id;

      if (edge.parent_id && !allCreatureIds.has(edge.parent_id)) {
        allCreatureIds.add(edge.parent_id);
        nextLevelIds.push(edge.parent_id);
      }
    }

    currentLevelIds = nextLevelIds;
  }

  // 3. Batch load ancestor details
  const { data: ancestorsData } = await supabase
    .from("creatures")
    .select("id, name, slug, avatar_url, breed, gender")
    .in("id", [...allCreatureIds]);

  const creaturesById = new Map<string, CreatureRow>();
  for (const c of (ancestorsData ?? []) as unknown as CreatureRow[]) {
    creaturesById.set(c.id, c);
  }

  // 4. Calculate COI
  const subjectParents = parentMap.get(creatureId);
  const { coi, commonAncestorIds } = calculateCOI(
    subjectParents?.sireId ?? null,
    subjectParents?.damId ?? null,
    parentMap,
  );

  const commonAncestors = commonAncestorIds
    .map((id) => creaturesById.get(id))
    .filter((c): c is CreatureRow => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name }));

  // 5. Build tree recursively
  function buildNode(
    id: string,
    role: "subject" | "sire" | "dam",
    generation: number,
  ): PedigreeNode | null {
    const info = creaturesById.get(id);
    if (!info) return null;

    const parents = parentMap.get(id);
    const sire =
      generation < maxGenerations && parents?.sireId
        ? buildNode(parents.sireId, "sire", generation + 1)
        : null;
    const dam =
      generation < maxGenerations && parents?.damId
        ? buildNode(parents.damId, "dam", generation + 1)
        : null;

    return {
      id: info.id,
      name: info.name,
      slug: info.slug,
      avatarUrl: info.avatar_url,
      breed: info.breed,
      gender: info.gender,
      role,
      generation,
      sire,
      dam,
    };
  }

  const subjectNode = buildNode(creatureId, "subject", 0);
  if (!subjectNode) return null;

  return {
    subject: subjectNode,
    coiPercentage: Number((coi * 100).toFixed(2)),
    generationsCount: maxGenerations,
    totalAncestorsFound: allCreatureIds.size - 1,
    commonAncestors,
  };
}
