export type SpeciesIdentity = { groupName: string; roleBadge: string; youngGroup: string };

// Species-neutral by construction: every family gets its own vocabulary
// instead of forcing "kennel"/"pack" onto a cattery or an aviary. Unknown or
// unset species fall back to the generic pair rather than guessing.
const IDENTITY_BY_SPECIES: Record<string, SpeciesIdentity> = {
  dog: { groupName: "My Pack", roleBadge: "Kennel", youngGroup: "litter" },
  cat: { groupName: "My Clowder", roleBadge: "Cattery", youngGroup: "litter" },
  rabbit: { groupName: "My Warren", roleBadge: "Rabbitry", youngGroup: "litter" },
  bird: { groupName: "My Aviary", roleBadge: "Aviary", youngGroup: "clutch" },
  reptile: { groupName: "My Colony", roleBadge: "Herpetarium", youngGroup: "clutch" },
  fish: { groupName: "My School", roleBadge: "Aquarium", youngGroup: "spawn" },
  insect: { groupName: "My Colony", roleBadge: "Insectary", youngGroup: "brood" },
};

const DEFAULT_IDENTITY: SpeciesIdentity = { groupName: "My Animals", roleBadge: "Breeder", youngGroup: "group" };

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

/**
 * Contextual taxonomy sub-type label based on animal species.
 * Instead of assuming "Breed" for every animal, returns the domain-accurate descriptor:
 * - Reptile: "Morph / Locality"
 * - Insect / Invertebrate: "Species / Caste" (e.g. Queen, Colony)
 * - Fish / Aquatic: "Strain / Variety"
 * - Bird / Avian: "Mutation / Variety"
 * - Dog / Cat / Rabbit: "Breed"
 * - Default: "Breed / Morph / Variety"
 */
export function taxonomyLabelForSpecies(species: string | null | undefined): string {
  if (!species) return "Breed / Morph / Variety";
  switch (species.trim().toLowerCase()) {
    case "dog":
    case "cat":
    case "rabbit":
      return "Breed";
    case "reptile":
      return "Morph / Locality";
    case "insect":
      return "Species / Caste";
    case "fish":
      return "Strain / Variety";
    case "bird":
      return "Mutation / Variety";
    default:
      return "Breed / Morph / Variety";
  }
}

