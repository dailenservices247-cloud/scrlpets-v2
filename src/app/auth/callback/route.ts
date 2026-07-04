import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = safeNextPath(searchParams.get("next"));
  if (!code) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", "confirmation_failed");
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", "confirmation_failed");
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
