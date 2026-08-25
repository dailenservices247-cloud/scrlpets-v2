import { describe, expect, it } from "vitest";
import { speciesIdentity } from "@/lib/species/identity";
import { LITTER_SPECIES } from "@/lib/litters/constants";

/**
 * A bird lays a clutch, a fish spawns, an insect broods. Calling any of those a
 * "litter" is the same dog-shaped-vocabulary defect `pack-alumni-ui.spec.ts`
 * already guards against on the alumni surface — it just never covered the
 * animal page, where `creature.fromLitter` renders inside app-shell.
 *
 * Legacy solved this in `src/lib/speciesConfig.ts` with a per-species
 * `terminology` map. v2's identity system kept `groupName` + `roleBadge` and
 * dropped the vocabulary, so the word had nowhere to come from.
 */
describe("speciesIdentity.youngGroup", () => {
  it("gives egg-layers a clutch, not a litter", () => {
    expect(speciesIdentity("bird").youngGroup).toBe("clutch");
    expect(speciesIdentity("reptile").youngGroup).toBe("clutch");
  });

  it("gives fish a spawn and insects a brood", () => {
    expect(speciesIdentity("fish").youngGroup).toBe("spawn");
    expect(speciesIdentity("insect").youngGroup).toBe("brood");
  });

  it("keeps litter for the mammals it is actually correct for", () => {
    expect(speciesIdentity("dog").youngGroup).toBe("litter");
    expect(speciesIdentity("cat").youngGroup).toBe("litter");
    expect(speciesIdentity("rabbit").youngGroup).toBe("litter");
  });

  it("falls back to a species-neutral word when the species is unknown", () => {
    // Consistent with DEFAULT_IDENTITY choosing "My Animals"/"Breeder" over the
    // mammal default. An unset species cannot justify guessing "litter".
    expect(speciesIdentity(null).youngGroup).toBe("group");
    expect(speciesIdentity("other").youngGroup).toBe("group");
    expect(speciesIdentity("axolotl").youngGroup).toBe("group");
  });

  it("covers every species the litters feature can actually store", () => {
    // The wizard writes one of LITTER_SPECIES; none may fall through to a word
    // that contradicts its own biology.
    for (const species of LITTER_SPECIES) {
      expect(speciesIdentity(species).youngGroup).toBeTruthy();
    }
    expect(speciesIdentity("bird").youngGroup).not.toBe("litter");
  });
});
