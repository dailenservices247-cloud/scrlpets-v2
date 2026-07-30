// Mirrors the support_tickets_category_check DB constraint — the DB is the authority.
export const SUPPORT_CATEGORIES = [
  "account",
  "listing",
  "transaction",
  "bug",
  "feature",
  "feedback",
  "other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
