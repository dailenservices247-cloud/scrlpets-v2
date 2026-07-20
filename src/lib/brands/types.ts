import type { BrandType } from "./queries";

export type BrandRole = "owner" | "admin" | "contributor";

export const BRAND_ROLE_OPTIONS: { value: Exclude<BrandRole, "owner">; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "contributor", label: "Contributor" },
];

const VALID_ROLES = new Set<BrandRole>(["owner", "admin", "contributor"]);

export function isBrandRole(value: string): value is BrandRole {
  return VALID_ROLES.has(value as BrandRole);
}

// matrix rows 6-7: edit/delete brand-attributed content = author, admin, owner.
export function canManageBrandContent(role: BrandRole | null): boolean {
  return role === "owner" || role === "admin";
}

// matrix row 9: add/remove contributors = admin, owner.
export function canManageContributors(role: BrandRole | null): boolean {
  return role === "owner" || role === "admin";
}

// matrix row 10: add/remove admins, change roles = owner only.
export function canChangeBrandRoles(role: BrandRole | null): boolean {
  return role === "owner";
}

/** The 8 documented brand-type presets (see handoff Brand OS notes). */
export const BRAND_TYPE_OPTIONS: { value: BrandType; label: string }[] = [
  { value: "kennel", label: "Kennel / Breeding Program" },
  { value: "llc", label: "LLC / Company" },
  { value: "pet_shop", label: "Local Pet Shop / Physical Store" },
  { value: "product_brand", label: "Product Brand" },
  { value: "rescue", label: "Rescue / Shelter" },
  { value: "service_provider", label: "Trainer / Service Provider" },
  { value: "creator", label: "Creator / Educator" },
  { value: "independent_seller", label: "Independent Seller" },
];

const VALID_TYPES = new Set(BRAND_TYPE_OPTIONS.map((o) => o.value));

export function isBrandType(v: string): v is BrandType {
  return VALID_TYPES.has(v as BrandType);
}
