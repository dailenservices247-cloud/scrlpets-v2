import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SERVICE_CATEGORIES } from "@/lib/services/categories";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

/**
 * `categories.ts` opens with "Mirrors the services_category_check DB
 * constraint — the DB is the authority." Nothing enforced that. The drift it
 * invites is one-directional and silent: add a category to the TypeScript array
 * and not to the constraint, and the picker offers a value every insert then
 * refuses.
 *
 * So this reads the constraint out of the migrations rather than restating it.
 */
function constraintCategories(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  // Last definition wins — the same order Postgres applied them in.
  const defining = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => readFileSync(join(dir, f), "utf8").includes("services_category_check"));
  const sql = readFileSync(join(dir, defining[defining.length - 1]), "utf8");
  const block = sql.slice(sql.lastIndexOf("services_category_check"));
  const arr = block.slice(block.indexOf("array["), block.indexOf("]"));
  return [...arr.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("service categories", () => {
  it("offers the three consumer segments legacy carried and v2 dropped", () => {
    // Legacy shipped nine; v2's baseline shipped six. Walking and sitting are
    // the whole Rover/Wag market; photography is a real breeder-adjacent trade.
    expect(SERVICE_CATEGORIES).toContain("walking");
    expect(SERVICE_CATEGORIES).toContain("sitting");
    expect(SERVICE_CATEGORIES).toContain("photography");
  });

  it("never offers a category the database would refuse", () => {
    const allowed = constraintCategories();
    expect(allowed.length).toBeGreaterThan(0);
    for (const c of SERVICE_CATEGORIES) {
      expect(allowed, `"${c}" is offered by the UI but not in services_category_check`).toContain(c);
    }
  });

  it("never allows a category the picker cannot show", () => {
    // The other direction: a constraint value with no constant is a row the app
    // can hold and never render.
    for (const c of constraintCategories()) {
      expect(SERVICE_CATEGORIES as readonly string[]).toContain(c);
    }
  });

  it("has a label in every locale, not just English", () => {
    type WithCategories = { services: { category: Record<string, string> } };
    const locales: Record<string, Record<string, string>> = {
      en: (en as WithCategories).services.category,
      es: (es as WithCategories).services.category,
    };
    for (const [locale, labels] of Object.entries(locales)) {
      for (const c of SERVICE_CATEGORIES) {
        expect(labels?.[c], `${locale} is missing services.category.${c}`).toBeTruthy();
      }
    }
  });
});
