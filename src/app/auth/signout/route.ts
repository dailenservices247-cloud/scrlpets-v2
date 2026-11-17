import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "global" ? "global" : "local";
  await supabase.auth.signOut({ scope });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
