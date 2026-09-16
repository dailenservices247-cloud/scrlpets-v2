import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Brand House §7 (locked 2026-07-22, founder sampler pick): standard actions are
 * soft wine tint. Spine/teal is RESERVE — trust and verification surfaces only,
 * never a default button.
 *
 * `button.tsx` is exempt because it DEFINES the secondary variant. Defining it
 * is correct; reaching for it on an everyday CTA is what this guard stops. Any
 * genuine trust/verification surface that wants spine should use
 * `<Button variant="secondary">` so the choice is visible at the call site.
 */
const ALLOWED = new Set(["src/components/ui/button.tsx"]);

/** A solid spine fill — `bg-secondary/10` and friends are tints, not fills. */
const SOLID_SPINE = /bg-secondary(?![\w/-])/;
/** Padding, height or weight that means "this is a button", not a placeholder. */
const BUTTON_SHAPED = /min-h-1\d|px-[45]|font-semibold/;

function sourceFiles(): string[] {
  return readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((p) => p.endsWith(".tsx"))
    .map((p) => `src/${p}`)
    .filter((p) => !ALLOWED.has(p));
}

describe("Brand House §7 — spine is reserve, never a default button", () => {
  it("no button-shaped element carries a solid spine fill", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (SOLID_SPINE.test(line) && BUTTON_SHAPED.test(line)) {
            offenders.push(`${file}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
