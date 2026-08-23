/**
 * The locales that ship, and the only values allowed to reach a message import.
 *
 * `src/i18n/request.ts` interpolates the result into
 * `import("../../messages/${locale}.json")`. The value comes from a cookie, so
 * this allowlist is a trust boundary — without it, a request header would be
 * choosing a filesystem path.
 *
 * Adding a locale here without adding `messages/<locale>.json` is a crash at
 * request time, not a missing translation.
 */
export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie the switcher writes. Read on every request. */
export const LOCALE_COOKIE = "scrlpets_locale";

export function resolveLocale(value: string | null | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
