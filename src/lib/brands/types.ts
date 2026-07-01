import type { BrandType } from "./queries";

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
