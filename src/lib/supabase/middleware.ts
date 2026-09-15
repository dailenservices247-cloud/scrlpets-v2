import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { owesSecondFactor } from "@/lib/auth/second-factor";
import { fetchWithTimeout } from "./fetch";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { response, user: null, secondFactorOwed: false };
    // The token getUser() just validated — only its aal claim is read. Factors
    // come from getUser() itself, never from this stored session.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      response,
      user,
      secondFactorOwed: owesSecondFactor(user.factors, session?.access_token),
    };
  } catch {
    // ponytail: a failed getUser() keeps the existing signed-out handling; the
    // database gate refuses an owing session even if this one request slips by.
    return { response, user: null, secondFactorOwed: false };
  }
}
