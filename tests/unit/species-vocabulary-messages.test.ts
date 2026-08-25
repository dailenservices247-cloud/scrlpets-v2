import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { LITTER_SPECIES } from "@/lib/litters/constants";
import { speciesIdentity } from "@/lib/species/identity";

/**
 * `pack-alumni-ui.spec.ts` guards dog-shaped vocabulary with a regex over
 * rendered English. That guard is structurally blind twice over: it runs only
 * on the alumni surface, and it can only ever read one locale. `es.json`
 * carries 28 instances of "camada" that no gate has ever looked at.
 *
 * A message-file test closes both holes for the strings where the species IS
 * known, because it reads the source of the copy rather than one rendering of
 * it.
 */
type Messages = {
  species?: { youngGroup?: Record<string, string> };
  creature: { fromLitter: string };
};

const LOCALES: Record<string, Messages> = { en, es };

describe("species vocabulary in message files", () => {
  it("carries a word for every youngGroup the identity map can return", () => {
    const needed = new Set(
      [...LITTER_SPECIES, "axolotl", null].map((s) => speciesIdentity(s).youngGroup),
    );
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const vocab = messages.species?.youngGroup ?? {};
      for (const key of needed) {
        expect(vocab[key], `${locale} is missing species.youngGroup.${key}`).toBeTruthy();
      }
    }
  });

  it("does not hardcode a mammal word into the animal page's litter link", () => {
    // The link renders on /c/[slug] for a bird as readily as for a dog, so the
    // word must arrive as a parameter, not be baked into the sentence.
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const copy = messages.creature.fromLitter;
      expect(copy, `${locale} creature.fromLitter must interpolate {group}`).toContain("{group}");
      expect(
        /litter|camada/i.test(copy),
        `${locale} creature.fromLitter still hardcodes a mammal word: ${copy}`,
      ).toBe(false);
    }
  });
});
