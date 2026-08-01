import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * The ONLY auth surface the app reads. Swap the body for shared-SSO later;
 * callers never change.
 *
 * Memoised per request. `supabase.auth.getUser()` is a network round trip
 * (~128 ms measured against the dev project), and nearly every route already
 * called this before AppPage started calling it too for the header — so without
 * `cache()` the shell change would have added a full round trip to every page
 * in the app. React dedupes within a single render pass, which is exactly the
 * scope needed: a fresh request still re-reads the session.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
});
