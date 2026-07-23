import type { ComposeAttribution } from "./ComposerTabs";

/**
 * Stamp attribution fields onto a compose FormData. Slice C: animals reference
 * via the creature FK; about_id carries the selected non-animal subject entity.
 */
export function applyAttribution(
  fd: FormData,
  attribution: ComposeAttribution,
): void {
  fd.set("postingAsType", attribution.postingAsType);
  if (attribution.brandId) fd.set("brandId", attribution.brandId);
  fd.set("aboutType", attribution.aboutType);
  if (attribution.aboutId) fd.set("aboutId", attribution.aboutId);
}
