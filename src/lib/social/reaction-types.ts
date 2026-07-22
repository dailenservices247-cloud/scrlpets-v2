// Client-safe reaction constants (no server imports) so client components can
// use them without pulling the server data layer into the bundle.
export const REACTION_TYPES = [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "strong",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
