import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";

/**
 * Locale per request, from a cookie.
 *
 * A COOKIE rather than a profile column, deliberately. Public discovery without
 * an account is a locked strength of this product, so a Spanish-speaking guest
 * browsing animals must be able to read the app before they have a profile to
 * store a preference on. A column would serve only signed-in members and needs a
 * migration to do it.
 * ponytail: no cross-device sync. Add a profile column when someone asks for it.
 *
 * `resolveLocale` is what stops a cookie value becoming an import path.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
