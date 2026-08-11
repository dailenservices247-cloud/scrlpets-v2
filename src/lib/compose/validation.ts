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

export type GuaranteeInput =
  | { kind: "none" }
  | { kind: "template"; templateKey: string }
  | {
      kind: "custom";
      customTerms: string;
      customRemedy: "vet_costs" | "replacement" | "refund_on_return";
      customDurationDays: number;
    };

const REMEDIES = ["vet_costs", "replacement", "refund_on_return"] as const;

/**
 * Mirrors the one-governing-document CHECK on listing_guarantees.
 *
 * The constraint is the guarantee; this exists so an incomplete promise comes
 * back as a sentence a seller can act on rather than a Postgres violation. It
 * refuses the same shapes the database refuses — a template with no template, a
 * custom promise with no remedy — because those are precisely the ambiguity that
 * contra proferentem would later resolve against the seller.
 */
export function parseGuarantee(
  kind: string,
  templateKey: string,
  customTerms: string,
  customRemedy: string,
  customDurationDays: string,
): { ok: true; guarantee: GuaranteeInput } | { ok: false; error: string } {
  if (kind === "" || kind === "none") return { ok: true, guarantee: { kind: "none" } };

  if (kind === "template") {
    if (!templateKey.trim()) return { ok: false, error: "guarantee_incomplete" };
    return { ok: true, guarantee: { kind: "template", templateKey: templateKey.trim() } };
  }

  if (kind === "custom") {
    const terms = customTerms.trim();
    const days = Math.round(Number(customDurationDays));
    if (!terms) return { ok: false, error: "guarantee_incomplete" };
    if (!(REMEDIES as readonly string[]).includes(customRemedy)) {
      return { ok: false, error: "guarantee_incomplete" };
    }
    // Coverage with no duration is coverage that never ends or never starts,
    // depending on who is reading it. That IS the ambiguity.
    if (!Number.isFinite(days) || days < 1) return { ok: false, error: "guarantee_incomplete" };
    return {
      ok: true,
      guarantee: {
        kind: "custom",
        customTerms: terms,
        customRemedy: customRemedy as GuaranteeInput extends { customRemedy: infer R } ? R : never,
        customDurationDays: days,
      },
    };
  }

  return { ok: false, error: "guarantee_incomplete" };
}
