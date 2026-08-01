import { describe, expect, it } from "vitest";
import { parseWaitlistInput } from "@/lib/waitlist/parse";

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

describe("parseWaitlistInput", () => {
  it("accepts a plain email and normalizes case", () => {
    const out = parseWaitlistInput(form({ email: " Dai@Example.COM " }));
    expect(out).toEqual({ email: "dai@example.com", species: [], source: "direct" });
  });

  it("rejects malformed emails", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", "a@@c.com"]) {
      expect(parseWaitlistInput(form({ email: bad }))).toEqual({ error: "email" });
    }
  });

  it("flags the honeypot without validating anything else", () => {
    const out = parseWaitlistInput(form({ email: "real@example.com", company: "x" }));
    expect(out).toEqual({ error: "bot" });
  });

  it("keeps only vocabulary species, deduped", () => {
    const out = parseWaitlistInput(
      form({ email: "a@b.co", species: ["dog", "dog", "dragon", "reptile"] }),
    );
    expect(out).toEqual({ email: "a@b.co", species: ["dog", "reptile"], source: "direct" });
  });

  it("collapses a non-slug source to direct", () => {
    expect(parseWaitlistInput(form({ email: "a@b.co", source: "husbandry" }))).toMatchObject({
      source: "husbandry",
    });
    for (const bad of ["<script>", "A B", "x".repeat(41)]) {
      expect(parseWaitlistInput(form({ email: "a@b.co", source: bad }))).toMatchObject({
        source: "direct",
      });
    }
  });
});
