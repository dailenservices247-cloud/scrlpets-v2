import { describe, expect, it } from "vitest";
import {
  FOOD_VERTICAL_DOSSIERS,
  FOOD_VERTICAL_NAME_CANDIDATES,
  SYNERGY_MESSENGER_THREADS,
  SYNERGY_STORE_MODULES,
  TECH_VERTICAL_DOSSIERS,
  TECH_VERTICAL_NAME_CANDIDATES,
} from "@/lib/synergy/catalog";

describe("Synergy Ecosystem Catalog & Multi-Vertical Parity", () => {
  it("enforces Dailen's single-word naming heuristic on Vertical #2 and Vertical #3 candidates", () => {
    const forbiddenPattern =
      /^(Neo|Pro|X|Cyber|Hyper|Smart|Quick)|(-Hub|-Lab|-Studio|-ify|-ly|-ai)$/i;

    expect(TECH_VERTICAL_NAME_CANDIDATES.length).toBeGreaterThanOrEqual(5);
    for (const candidate of TECH_VERTICAL_NAME_CANDIDATES) {
      expect(candidate.name.split(/\s+/)).toHaveLength(1);
      expect(forbiddenPattern.test(candidate.name)).toBe(false);
    }

    expect(FOOD_VERTICAL_NAME_CANDIDATES.length).toBeGreaterThanOrEqual(5);
    for (const candidate of FOOD_VERTICAL_NAME_CANDIDATES) {
      expect(candidate.name.split(/\s+/)).toHaveLength(1);
      expect(forbiddenPattern.test(candidate.name)).toBe(false);
    }
  });

  it("includes all three pillars in Vertical #2 (Hardware Rigs, Gaming & Mods, AI Work Stack)", () => {
    const pillars = TECH_VERTICAL_DOSSIERS.map((d) => d.pillar);
    expect(pillars).toEqual(["hardware", "gaming", "ai_work_stack"]);
    for (const dossier of TECH_VERTICAL_DOSSIERS) {
      expect(dossier.nodes.length).toBe(4);
      expect(dossier.clearances.length).toBe(4);
      expect(dossier.linkedThreadId).toBeTruthy();
    }
  });

  it("includes all three pillars in Vertical #3 (Local Eats/Trucks, Forkable Recipes, Small-Batch Chef Drops)", () => {
    const pillars = FOOD_VERTICAL_DOSSIERS.map((d) => d.pillar);
    expect(pillars).toEqual(["local_eats", "recipes", "chef_drops"]);
    for (const dossier of FOOD_VERTICAL_DOSSIERS) {
      expect(dossier.nodes.length).toBe(4);
      expect(dossier.clearances.length).toBe(4);
      expect(dossier.linkedThreadId).toBeTruthy();
    }
  });

  it("wires auto-connected Synergy Messenger threads across Scrlpets, Tech/Gaming, and Food verticals", () => {
    const verticals = new Set(SYNERGY_MESSENGER_THREADS.map((t) => t.vertical));
    expect(verticals.has("scrlpets")).toBe(true);
    expect(verticals.has("tech_gaming")).toBe(true);
    expect(verticals.has("food_recipes")).toBe(true);

    for (const thread of SYNERGY_MESSENGER_THREADS) {
      expect(thread.dealCard.handoverPin).toMatch(/^\d{6}$/);
      expect(thread.dealCard.handoverQrPayload).toContain("SYNERGY-HANDOVER:");
    }

    expect(SYNERGY_STORE_MODULES.some((m) => m.id === "scrlpets")).toBe(true);
    expect(SYNERGY_STORE_MODULES.some((m) => m.id === "tech_vertical")).toBe(
      true,
    );
    expect(SYNERGY_STORE_MODULES.some((m) => m.id === "food_vertical")).toBe(
      true,
    );
    expect(
      SYNERGY_STORE_MODULES.some((m) => m.id === "synergy_messenger"),
    ).toBe(true);
  });
});
