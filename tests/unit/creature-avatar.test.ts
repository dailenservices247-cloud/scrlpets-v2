import { describe, expect, it } from "vitest";
import { resolveAvatarPatch } from "@/lib/creatures/avatar";

/**
 * Three owner intentions collapse into one nullable column, and the shape used
 * for the profile editor (`if (avatarUrl) patch.avatar_url = avatarUrl`) can
 * only express two of them. "Remove" and "left alone" are indistinguishable
 * there, which is why this is a function with tests rather than an inline if.
 */
describe("resolveAvatarPatch", () => {
  it("leaves the column untouched when nothing was uploaded or removed", () => {
    expect(resolveAvatarPatch(null, false)).toEqual({});
  });

  it("treats an empty upload field as untouched, not as a blank photo", () => {
    // FormData yields "" for a field the owner never interacted with. Writing
    // that through would blank an existing photo on every unrelated edit —
    // change the colour, lose the picture.
    expect(resolveAvatarPatch("", false)).toEqual({});
    expect(resolveAvatarPatch("   ", false)).toEqual({});
  });

  it("sets the uploaded url", () => {
    expect(resolveAvatarPatch("https://example.test/a.jpeg", false)).toEqual({
      avatar_url: "https://example.test/a.jpeg",
    });
  });

  it("clears the column when removal was requested", () => {
    expect(resolveAvatarPatch(null, true)).toEqual({ avatar_url: null });
  });

  it("prefers a fresh upload over a stale removal flag", () => {
    // Contradictory input resolves the non-destructive way: a url means the
    // owner just picked a picture, and losing it costs them the upload again.
    expect(resolveAvatarPatch("https://example.test/b.jpeg", true)).toEqual({
      avatar_url: "https://example.test/b.jpeg",
    });
  });
});
