import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §6 motion rules, as the parts that can be checked without a browser. The
 * rendered values — 180ms UI feedback on one curve, the 320ms morph, and the
 * reduced-motion override — are measured in tests/e2e/design-system.spec.ts and
 * tests/e2e/realm-morph.spec.ts, because a computed value is the only honest
 * proof of those.
 */
const css = readFileSync("src/app/globals.css", "utf8");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("motion tokens are defined once", () => {
  it.each(["--duration-ui", "--duration-morph", "--ease-realm"])(
    "%s is declared exactly once",
    (token) => {
      // "One easing curve, defined once" is the rule a second declaration
      // breaks, and a second declaration is exactly how two curves got into
      // the app in the first place.
      const declarations = css.match(new RegExp(`${token}\\s*:`, "g")) ?? [];
      expect(declarations).toHaveLength(1);
    },
  );

  it("Tailwind's transition defaults read those tokens rather than repeating them", () => {
    expect(css).toMatch(/--default-transition-duration:\s*var\(--duration-ui\)/);
    expect(css).toMatch(/--default-transition-timing-function:\s*var\(--ease-realm\)/);
  });
});

describe("no entry animation on static mount", () => {
  /**
   * §6: "Entry animations only where content genuinely arrives (Suspense
   * reveals), never on static mount."
   *
   * The app has zero Suspense boundaries and zero loading.tsx, so there is
   * currently nowhere an entry animation is permitted — which makes this a
   * clean zero rather than a judgement call. It is a tripwire, not a permanent
   * ban: when the first Suspense boundary lands, this test should be narrowed
   * to "animate-* only inside a Suspense fallback" rather than deleted, so the
   * permission arrives with the surface that earns it.
   */
  it("no component carries a keyframe animation", () => {
    const offenders = tsxFiles("src").filter((file) =>
      /\banimate-[a-z0-9-]+/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
