import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth/access";
import { safeNextPath } from "@/lib/auth/redirect";
import { SECOND_FACTOR_PATH, secondFactorExempt } from "@/lib/auth/second-factor";
import { updateSession } from "@/lib/supabase/middleware";

// Discovery is public. Authentication begins only when a visitor moves from
// browsing into creating, messaging, or account/brand administration.
export async function proxy(request: NextRequest) {
  const { response, user, secondFactorOwed } = await updateSession(request);
  const path = request.nextUrl.pathname;
  // Before anything else: a session that has proved only one factor sees the
  // challenge and nothing more — public pages included, and any server action
  // posted from them. Covers every way in (password, email code, Google, magic
  // link, reset link, email-change link) because all of them arrive here.
  if (secondFactorOwed && !secondFactorExempt(path)) {
    const challenge = new URL(SECOND_FACTOR_PATH, request.url);
    challenge.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(challenge);
    // Carry any refresh getUser() just did, or the rotated refresh token is lost
    // and the member is signed out on the next request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(
      new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url),
    );
  }
  if (!user && isProtectedPath(path)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
