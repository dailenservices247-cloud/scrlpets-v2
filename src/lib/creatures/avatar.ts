/**
 * What to write to `creatures.avatar_url`, given what the owner did.
 *
 * Three intentions, one nullable column: leave it alone, set a new picture,
 * take the picture down. The profile editor's shape — `if (avatarUrl)
 * patch.avatar_url = avatarUrl` — folds "removed" and "left alone" into the
 * same branch, so it cannot express the third. An animal's photo needs the
 * third: a wrong picture on a listed animal has to come down, not merely be
 * overwritten.
 *
 * Returning an object with the key ABSENT (rather than undefined) is the point.
 * Spread into a patch, an absent key leaves the column untouched, while
 * `avatar_url: null` clears it — two different writes that a single nullable
 * string could not otherwise distinguish.
 */
export type AvatarPatch = { avatar_url?: string | null };

export function resolveAvatarPatch(
  uploadedUrl: string | null,
  removeRequested: boolean,
): AvatarPatch {
  const url = (uploadedUrl ?? "").trim();
  if (url) return { avatar_url: url };
  if (removeRequested) return { avatar_url: null };
  return {};
}
