import type { ComposeAttribution } from "./ComposerTabs";

/**
 * Stamp attribution fields onto a compose FormData.
 * about_id is resolved client-side to the tagged creature when the subject is an animal;
 * other about_types stay unresolved this slice (polymorphic id deferred).
 */
export function applyAttribution(
  fd: FormData,
  attribution: ComposeAttribution,
  creatureId: string | null,
): void {
  fd.set("postingAsType", attribution.postingAsType);
  if (attribution.brandId) fd.set("brandId", attribution.brandId);
  fd.set("aboutType", attribution.aboutType);
  if (attribution.aboutType === "animal" && creatureId) fd.set("aboutId", creatureId);
}
