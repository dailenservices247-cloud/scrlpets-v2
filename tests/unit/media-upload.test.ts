import { describe, expect, it } from "vitest";
import { validateMediaFile } from "@/lib/media/upload";

describe("validateMediaFile", () => {
  it("accepts images up to 5MB", () => {
    expect(validateMediaFile("image/jpeg", 4 * 1024 * 1024)).toEqual({ kind: "image" });
    expect(validateMediaFile("image/png", 6 * 1024 * 1024)).toEqual({ error: "size" });
  });
  it("accepts videos up to 50MB", () => {
    expect(validateMediaFile("video/mp4", 40 * 1024 * 1024)).toEqual({ kind: "video" });
    expect(validateMediaFile("video/webm", 51 * 1024 * 1024)).toEqual({ error: "size" });
    expect(validateMediaFile("video/quicktime", 1024)).toEqual({ kind: "video" });
  });
  it("rejects everything else", () => {
    expect(validateMediaFile("application/pdf", 10)).toEqual({ error: "type" });
    expect(validateMediaFile("image/gif", 10)).toEqual({ error: "type" });
  });
});
