import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth/access";
import { safeNextPath } from "@/lib/auth/redirect";
import { updateSession } from "@/lib/supabase/middleware";

// Discovery is public. Authentication begins only when a visitor moves from
// browsing into creating, messaging, or account/brand administration.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
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
