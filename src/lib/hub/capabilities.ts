/**
 * R2 — Brand OS's modules are capability-gated, not only type-gated. The
 * vocabulary mirrors the check constraint in
 * supabase/migrations/20260730073541_capabilities_archive_withdraw.sql
 * exactly; a value here that drifts from that constraint is just decoration.
 *
 * This lives under lib/hub, not lib/brands, because src/lib/brands/{queries,types}.ts
 * were out of this slice's edit scope — see the Operator Hub build notes.
 */
export type BrandCapability =
  | "breeding"
  | "selling_animals"
  | "products"
  | "services"
  | "adoption"
  | "content";

export const CAPABILITY_OPTIONS: { value: BrandCapability; label: string }[] = [
  { value: "breeding", label: "Breeding" },
  { value: "selling_animals", label: "Selling animals" },
  { value: "products", label: "Products" },
  { value: "services", label: "Services" },
  { value: "adoption", label: "Adoption" },
  { value: "content", label: "Content" },
];

const VALID = new Set<BrandCapability>(CAPABILITY_OPTIONS.map((o) => o.value));

export function isBrandCapability(value: string): value is BrandCapability {
  return VALID.has(value as BrandCapability);
}

export function hasCapability(
  capabilities: readonly string[],
  capability: BrandCapability,
): boolean {
  return capabilities.includes(capability);
}
