import { lookupSpeciesProfile } from "./statutory-tiers";

export type SpeciesIdentity = { groupName: string; roleBadge: string; youngGroup: string };

// Species-neutral by construction: every family gets its own vocabulary
// instead of forcing "kennel"/"pack" onto a cattery, stable, or an aviary. Unknown or
// unset species fall back to the generic pair rather than guessing.
const IDENTITY_BY_SPECIES: Record<string, SpeciesIdentity> = {
  // Tier 1 Domestic
  dog: { groupName: "My Pack", roleBadge: "Kennel", youngGroup: "litter" },
  cat: { groupName: "My Clowder", roleBadge: "Cattery", youngGroup: "litter" },
  rabbit: { groupName: "My Warren", roleBadge: "Rabbitry", youngGroup: "litter" },
  bird: { groupName: "My Aviary", roleBadge: "Aviary", youngGroup: "clutch" },
  reptile: { groupName: "My Colony", roleBadge: "Herpetarium", youngGroup: "clutch" },
  fish: { groupName: "My School", roleBadge: "Aquarium", youngGroup: "spawn" },
  insect: { groupName: "My Colony", roleBadge: "Insectary", youngGroup: "brood" },
  guinea_pig: { groupName: "My Herd", roleBadge: "Cavy Breeder", youngGroup: "litter" },
  cavy: { groupName: "My Herd", roleBadge: "Cavy Breeder", youngGroup: "litter" },
  hamster: { groupName: "My Colony", roleBadge: "Pocket Pet Breeder", youngGroup: "litter" },
  chinchilla: { groupName: "My Herd", roleBadge: "Chinchilla Breeder", youngGroup: "litter" },
  pigeon: { groupName: "My Loft", roleBadge: "Loftmaster", youngGroup: "clutch" },
  dove: { groupName: "My Loft", roleBadge: "Loftmaster", youngGroup: "clutch" },

  // Tier 2 Exotics
  ferret: { groupName: "My Business", roleBadge: "Ferretry", youngGroup: "kit" },
  hedgehog: { groupName: "My Array", roleBadge: "Hedgehog Breeder", youngGroup: "hoglet" },
  sugar_glider: { groupName: "My Mob", roleBadge: "Marsupial Breeder", youngGroup: "joey" },
  marsupial: { groupName: "My Mob", roleBadge: "Marsupial Breeder", youngGroup: "joey" },
  wallaby: { groupName: "My Mob", roleBadge: "Marsupial Breeder", youngGroup: "joey" },
  kangaroo: { groupName: "My Mob", roleBadge: "Marsupial Breeder", youngGroup: "joey" },
  savannah_cat: { groupName: "My Clowder", roleBadge: "Cattery", youngGroup: "litter" },
  bengal_cat: { groupName: "My Clowder", roleBadge: "Cattery", youngGroup: "litter" },
  wolfdog: { groupName: "My Pack", roleBadge: "Kennel & Pack", youngGroup: "litter" },
  dwarf_caiman: { groupName: "My Vivarium", roleBadge: "Crocodilian Breeder", youngGroup: "clutch" },
  snake: { groupName: "My Herpetarium", roleBadge: "Herpetarium", youngGroup: "clutch" },
  lizard: { groupName: "My Herpetarium", roleBadge: "Herpetarium", youngGroup: "clutch" },
  turtle: { groupName: "My Herpetarium", roleBadge: "Chelonian Breeder", youngGroup: "clutch" },
  tortoise: { groupName: "My Herpetarium", roleBadge: "Chelonian Breeder", youngGroup: "clutch" },
  amphibian: { groupName: "My Vivarium", roleBadge: "Vivarium", youngGroup: "spawn" },
  tarantula: { groupName: "My Colony", roleBadge: "Arachnid Breeder", youngGroup: "brood" },

  // Tier 3 Livestock, Equines & Poultry
  horse: { groupName: "My Stable", roleBadge: "Stable & Equestrian", youngGroup: "foal" },
  equine: { groupName: "My Stable", roleBadge: "Stable & Equestrian", youngGroup: "foal" },
  pony: { groupName: "My Stable", roleBadge: "Stable & Equestrian", youngGroup: "foal" },
  donkey: { groupName: "My Stable", roleBadge: "Stable & Ranch", youngGroup: "foal" },
  mule: { groupName: "My Stable", roleBadge: "Stable & Ranch", youngGroup: "foal" },
  chicken: { groupName: "My Flock", roleBadge: "Aviary & Flock", youngGroup: "clutch" },
  poultry: { groupName: "My Flock", roleBadge: "Aviary & Flock", youngGroup: "clutch" },
  duck: { groupName: "My Raft", roleBadge: "Waterfowl Breeder", youngGroup: "clutch" },
  waterfowl: { groupName: "My Raft", roleBadge: "Waterfowl Breeder", youngGroup: "clutch" },
  goose: { groupName: "My Gaggle", roleBadge: "Waterfowl Breeder", youngGroup: "clutch" },
  goat: { groupName: "My Herd", roleBadge: "Dairy & Herd", youngGroup: "kid" },
  sheep: { groupName: "My Flock", roleBadge: "Flockmaster", youngGroup: "lamb" },
  pig: { groupName: "My Sounder", roleBadge: "Piggery", youngGroup: "piglet" },
  swine: { groupName: "My Sounder", roleBadge: "Piggery", youngGroup: "piglet" },
  alpaca: { groupName: "My Herd", roleBadge: "Ranch & Fiber Herd", youngGroup: "cria" },
  llama: { groupName: "My Herd", roleBadge: "Ranch & Fiber Herd", youngGroup: "cria" },
  camel: { groupName: "My Herd", roleBadge: "Camelid Ranch", youngGroup: "cria" },
  cattle: { groupName: "My Herd", roleBadge: "Cattle Ranch", youngGroup: "foal" },
  bovine: { groupName: "My Herd", roleBadge: "Cattle Ranch", youngGroup: "foal" },

  // Tier 4 Native Wildlife
  fox: { groupName: "My Skulk", roleBadge: "Wildlife Propagation", youngGroup: "kit" },

  // Tier 5 Restricted Small Primates
  primate: { groupName: "My Troop", roleBadge: "Primate Sanctuary", youngGroup: "infant" },
  marmoset: { groupName: "My Troop", roleBadge: "Primate Sanctuary", youngGroup: "infant" },
  capuchin: { groupName: "My Troop", roleBadge: "Primate Sanctuary", youngGroup: "infant" },
  lemur: { groupName: "My Troop", roleBadge: "Primate Sanctuary", youngGroup: "infant" },
};

const DEFAULT_IDENTITY: SpeciesIdentity = { groupName: "My Animals", roleBadge: "Breeder", youngGroup: "group" };

/** Case-insensitive species → group identity. Unknown species get the default pair. */
export function speciesIdentity(species: string | null | undefined): SpeciesIdentity {
  if (!species) return DEFAULT_IDENTITY;
  const key = species.trim().toLowerCase();
  if (IDENTITY_BY_SPECIES[key]) return IDENTITY_BY_SPECIES[key];

  // Check statutory catalog profile if present
  const profile = lookupSpeciesProfile(key);
  if (profile) {
    return {
      groupName: profile.vocabulary.groupName,
      roleBadge: profile.vocabulary.roleBadge,
      youngGroup: profile.vocabulary.youngGroup,
    };
  }

  return DEFAULT_IDENTITY;
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
 * - Horse / Equine: "Breed & Bloodline"
 * - Ferret / Hedgehog: "Color & Pattern" / "Color & Morph"
 * - Dog / Cat / Rabbit: "Breed"
 * - Default: "Breed / Morph / Variety"
 */
export function taxonomyLabelForSpecies(species: string | null | undefined): string {
  if (!species) return "Breed / Morph / Variety";
  const key = species.trim().toLowerCase();
  switch (key) {
    case "dog":
    case "cat":
    case "rabbit":
    case "goat":
    case "sheep":
    case "pig":
    case "swine":
      return "Breed";
    case "horse":
    case "equine":
    case "pony":
      return "Breed & Bloodline";
    case "reptile":
    case "snake":
    case "lizard":
    case "turtle":
    case "dwarf_caiman":
      return "Morph / Locality";
    case "insect":
    case "invertebrate":
    case "tarantula":
      return "Species / Caste";
    case "fish":
      return "Strain / Variety";
    case "bird":
    case "pigeon":
    case "dove":
      return "Mutation / Variety";
    case "chicken":
    case "duck":
    case "poultry":
    case "waterfowl":
      return "Breed & Variety";
    case "ferret":
      return "Color & Pattern";
    case "hedgehog":
      return "Color & Morph";
    case "sugar_glider":
    case "marsupial":
      return "Color Morph & Lineage";
    case "alpaca":
    case "llama":
      return "Fleece & Bloodline";
    default:
      break;
  }

  const profile = lookupSpeciesProfile(key);
  if (profile) return profile.vocabulary.taxonomyLabel;

  return "Breed / Morph / Variety";
}
