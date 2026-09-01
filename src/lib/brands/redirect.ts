/**
 * Where to land after a brand is created.
 *
 * Lives here rather than in `actions.ts` because that file is `"use server"`,
 * and a server-action module may only export async functions — exporting this
 * synchronous helper from there compiles under tsc and then fails the Next
 * build.
 *
 * `next` reaches this from a form field, so it is attacker-supplied: only
 * same-origin absolute PATHS are honoured, and a protocol-relative `//host` is
 * rejected along with full URLs.
 */
export function brandRedirectTarget(brandId: string, next: string | null): string {
  const fallback = `/compose?brand=${brandId}`;
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
