export type SpeciesIdentity = { groupName: string; roleBadge: string };

// Species-neutral by construction: every family gets its own vocabulary
// instead of forcing "kennel"/"pack" onto a cattery or an aviary. Unknown or
// unset species fall back to the generic pair rather than guessing.
const IDENTITY_BY_SPECIES: Record<string, SpeciesIdentity> = {
  dog: { groupName: "My Pack", roleBadge: "Kennel" },
  cat: { groupName: "My Clowder", roleBadge: "Cattery" },
  rabbit: { groupName: "My Warren", roleBadge: "Rabbitry" },
  bird: { groupName: "My Aviary", roleBadge: "Aviary" },
  reptile: { groupName: "My Colony", roleBadge: "Herpetarium" },
  fish: { groupName: "My School", roleBadge: "Aquarium" },
  insect: { groupName: "My Colony", roleBadge: "Insectary" },
};

const DEFAULT_IDENTITY: SpeciesIdentity = { groupName: "My Animals", roleBadge: "Breeder" };

/** Case-insensitive species → group identity. Unknown species get the default pair. */
export function speciesIdentity(species: string | null | undefined): SpeciesIdentity {
  if (!species) return DEFAULT_IDENTITY;
  return IDENTITY_BY_SPECIES[species.trim().toLowerCase()] ?? DEFAULT_IDENTITY;
}

/** Mode species across a set of creatures. Ties keep whichever species was seen first. */
export function dominantSpecies(speciesList: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of speciesList) {
    const key = raw?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/** The operator's species identity: the mode over their creatures' species. */
export function dominantSpeciesIdentity(speciesList: (string | null | undefined)[]): SpeciesIdentity {
  return speciesIdentity(dominantSpecies(speciesList));
}
