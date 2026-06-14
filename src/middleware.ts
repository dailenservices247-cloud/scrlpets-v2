import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// G1-A: the feed is PUBLIC. Middleware only refreshes the session and
// bounces signed-in users off /login. Route gating returns in slice 2+
// for write/interaction surfaces only.
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (
    !user &&
    (path.startsWith("/compose") ||
      path.startsWith("/settings") ||
      path.startsWith("/messages"))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
