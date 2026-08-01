/** Creature page phase 2 — shared enums, option lists, and guards.
 * Mirrors the style of src/lib/brands/types.ts: plain value lists (no
 * hardcoded English labels) so every component resolves display text through
 * next-intl at render time.
 */

export const CREATURE_ROLES = ["pet", "breeding"] as const;
export type CreatureRole = (typeof CREATURE_ROLES)[number];

export const GENDERS = ["male", "female", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];

/** The identity anchor's marker type — mirrors the DB check constraint in
 * 20260801174832_identity_anchor.sql. Species-neutral by construction: a bird
 * carries a leg band, a reptile a tag or tattoo, and an animal with no physical
 * marker at all is never pretended into one. */
export const ANCHOR_TYPES = ["microchip", "leg_band", "tattoo", "tag"] as const;
export type AnchorType = (typeof ANCHOR_TYPES)[number];

/** What creature_assurance() returns. Derived per read, never stored, so it
 * cannot drift from the facts behind it. */
export type AssuranceLevel = "anchored" | "documented" | "declared";

export const GENETIC_TEST_TYPES = [
  "hip",
  "elbow",
  "cardiac",
  "eye",
  "patella",
  "thyroid",
  "pennhip",
  "dna_panel",
  "dna_single",
  "other",
] as const;
export type GeneticTestType = (typeof GENETIC_TEST_TYPES)[number];

export const GENETIC_TEST_RESULTS = [
  "clear",
  "carrier",
  "affected",
  "normal",
  "abnormal",
  "pending",
] as const;
export type GeneticTestResult = (typeof GENETIC_TEST_RESULTS)[number];

const ROLE_SET = new Set<string>(CREATURE_ROLES);
export function isCreatureRole(v: string): v is CreatureRole {
  return ROLE_SET.has(v);
}

const GENDER_SET = new Set<string>(GENDERS);
export function isGender(v: string): v is Gender {
  return GENDER_SET.has(v);
}

const ANCHOR_TYPE_SET = new Set<string>(ANCHOR_TYPES);
export function isAnchorType(v: string): v is AnchorType {
  return ANCHOR_TYPE_SET.has(v);
}

const TEST_TYPE_SET = new Set<string>(GENETIC_TEST_TYPES);
export function isGeneticTestType(v: string): v is GeneticTestType {
  return TEST_TYPE_SET.has(v);
}

const RESULT_SET = new Set<string>(GENETIC_TEST_RESULTS);
export function isGeneticTestResult(v: string): v is GeneticTestResult {
  return RESULT_SET.has(v);
}

/** Color-coding for the public result badge: green/amber/red per the spec. */
export type ResultTone = "good" | "warn" | "bad";
const RESULT_TONES: Record<GeneticTestResult, ResultTone> = {
  clear: "good",
  normal: "good",
  carrier: "warn",
  pending: "warn",
  affected: "bad",
  abnormal: "bad",
};
export function resultTone(result: GeneticTestResult): ResultTone {
  return RESULT_TONES[result];
}
