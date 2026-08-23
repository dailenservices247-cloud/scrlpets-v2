import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, resolveLocale } from "@/lib/i18n/locale";

/**
 * The resolved locale is interpolated into a dynamic import path in
 * `src/i18n/request.ts`. That makes the allowlist a TRUST BOUNDARY, not a
 * tidiness rule: the value arrives from a cookie, which is attacker-controlled,
 * and an unvalidated one would be a filesystem path built from user input.
 */
describe("resolveLocale", () => {
  it("accepts the locales that actually ship", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("es")).toBe("es");
  });

  it("falls back to the default when nothing is set", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("refuses anything not on the allowlist, including path fragments", () => {
    // These would otherwise be interpolated into `messages/${locale}.json`.
    for (const hostile of [
      "../../../etc/passwd",
      "en/../../secrets",
      "EN",
      "fr",
      "en.json",
      "en%00",
      "../en",
    ]) {
      expect(resolveLocale(hostile)).toBe(DEFAULT_LOCALE);
    }
  });

  it("ships exactly the two dictionaries that exist", () => {
    // messages/ holds en.json and es.json. A locale on this list with no
    // dictionary is a crash at request time, not a missing translation.
    expect([...LOCALES].sort()).toEqual(["en", "es"]);
  });
});
