"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";

/**
 * Choose a language.
 *
 * The value is re-resolved through the allowlist before it is stored, not only
 * when it is read. A server action is reachable by direct POST, so this is a
 * trust boundary and not form validation — storing an unvalidated locale would
 * put the bad value one `resolveLocale` bug away from an import path.
 */
export async function setLocale(value: string): Promise<{ ok: true }> {
  const locale = resolveLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  // Every rendered string changes, so nothing cached survives the switch.
  revalidatePath("/", "layout");
  return { ok: true };
}
