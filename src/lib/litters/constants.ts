// Mirrors the litters_status_check / creatures_role_check / creatures_gender_check
// DB constraints — the DB is the authority.
export const LITTER_SPECIES = [
  "dog",
  "cat",
  "rabbit",
  "bird",
  "reptile",
  "fish",
  "insect",
  "other",
] as const;

export type LitterSpecies = (typeof LITTER_SPECIES)[number];

export const LITTER_STATUSES = ["expecting", "born", "closed"] as const;

export type LitterStatus = (typeof LITTER_STATUSES)[number];

export const YOUNG_GENDERS = ["male", "female", "unknown"] as const;

export type YoungGender = (typeof YOUNG_GENDERS)[number];
