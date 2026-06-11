export type Validation = { ok: true } | { ok: false; error: "required" | "too_long" | "price" };

export function validatePost(input: { body: string; mediaUrl: string | null }): Validation {
  const body = input.body.trim();
  if (!body && !input.mediaUrl) return { ok: false, error: "required" };
  if (body.length > 2000) return { ok: false, error: "too_long" };
  return { ok: true };
}

export function parsePriceCents(raw: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  const cents = Math.round(parseFloat(raw) * 100);
  return cents > 0 ? cents : null;
}

export function validateListing(input: { title: string; priceCents: number | null }): Validation {
  if (!input.title.trim()) return { ok: false, error: "required" };
  if (!input.priceCents || input.priceCents <= 0) return { ok: false, error: "price" };
  return { ok: true };
}
