// Mirrors the services_category_check DB constraint — the DB is the authority.
export const SERVICE_CATEGORIES = [
  "grooming",
  "training",
  "boarding",
  "transport",
  "veterinary",
  "walking",
  "sitting",
  "photography",
  "other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
