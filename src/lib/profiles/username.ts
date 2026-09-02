/**
 * Username rules.
 *
 * Handles are generated as `<email-local-part>_<4 hex>` and, until now, could
 * never be changed — so a breeder's storefront lived at /u/janesmith_a3f1
 * permanently. On a marketplace where a breeder's page IS their shopfront, that
 * undercuts the credibility the product is selling.
 *
 * Legacy let people choose, which was right, but its entire validation was
 * `value.replace(/\s/g, "")` on the client. The intent is kept here; the
 * mechanism is not.
 *
 * Pure and server-shared on purpose: the same function decides in the form and
 * in the action, so the client cannot be the only thing standing between a user
 * and the name `admin`.
 */

/** Names that would let someone pose as the platform or its staff. */
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "help",
  "mod",
  "moderator",
  "official",
  "root",
  "scrlpets",
  "staff",
  "support",
  "system",
  "team",
] as const;

export type UsernameResult =
  | { ok: true; value: string }
  | { ok: false; reason: "format" | "length" | "leading" | "reserved" };

const SHAPE = /^[a-z0-9_]+$/;

export function validateUsername(input: string): UsernameResult {
  // Fold case FIRST. Checking reserved words before lowercasing lets "Admin"
  // walk straight through.
  const value = input.trim().toLowerCase();

  if (value.length < 3 || value.length > 30) return { ok: false, reason: "length" };
  if (!SHAPE.test(value)) return { ok: false, reason: "format" };
  // A leading digit or underscore reads as an id rather than a name, and makes
  // @mentions ambiguous.
  if (!/^[a-z]/.test(value)) return { ok: false, reason: "leading" };
  if ((RESERVED_USERNAMES as readonly string[]).includes(value)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, value };
}
