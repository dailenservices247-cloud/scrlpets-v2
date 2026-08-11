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

export function validateListing(
  input: { title: string; priceCents: number | null },
  // R17: a rehoming may legitimately be free. Sales still require a price, so
  // this is opt-in per call rather than a loosening of the default.
  opts?: { allowFree?: boolean },
): Validation {
  if (!input.title.trim()) return { ok: false, error: "required" };
  if (input.priceCents === null || input.priceCents < 0) return { ok: false, error: "price" };
  if (!opts?.allowFree && input.priceCents <= 0) return { ok: false, error: "price" };
  return { ok: true };
}

export type SaleTerms = { depositBps: number; inspectionHours: number };

/**
 * The two terms a seller sets on a sale, parsed from the compose form.
 *
 * Sellers think in percent and hours; the database stores basis points and
 * hours. Storing the deposit as a PERCENTAGE rather than an amount is what keeps
 * the 25% ceiling true when a price changes later — a stored amount quietly
 * becomes 60% of the price the moment somebody discounts the animal.
 *
 * The ceilings are duplicated from the DB check constraints on purpose. The
 * constraint is the guarantee; this is so a seller gets a sentence they can act
 * on instead of a Postgres violation.
 */
export function parseSaleTerms(
  rawDepositPercent: string,
  rawInspectionHours: string,
): { ok: true; terms: SaleTerms } | { ok: false; error: string } {
  const depositPercent = rawDepositPercent.trim() === "" ? 0 : Number(rawDepositPercent);
  if (!Number.isFinite(depositPercent) || depositPercent < 0) {
    return { ok: false, error: "deposit_invalid" };
  }
  // 25%: enough commitment to mean something, small enough that the escrow still
  // has something left to return if the sale fails.
  if (depositPercent > 25) return { ok: false, error: "deposit_too_large" };

  const inspectionHours =
    rawInspectionHours.trim() === "" ? 24 : Math.round(Number(rawInspectionHours));
  if (!Number.isFinite(inspectionHours)) return { ok: false, error: "inspection_invalid" };
  // A seller may extend the window, never waive it, and never park funds for
  // months to look generous.
  if (inspectionHours < 24) return { ok: false, error: "inspection_too_short" };
  if (inspectionHours > 336) return { ok: false, error: "inspection_too_long" };

  return {
    ok: true,
    terms: { depositBps: Math.round(depositPercent * 100), inspectionHours },
  };
}
