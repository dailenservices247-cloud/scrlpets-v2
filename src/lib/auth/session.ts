import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** The ONLY auth surface the app reads. Swap the body for shared-SSO later; callers never change. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
