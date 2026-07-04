"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function signInEmail(event: React.FormEvent) {
    event.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  async function signUpEmail() {
    setErr(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  async function signInGoogle() {
    const callback = new URL("/auth/callback", location.origin);
    callback.searchParams.set("next", nextPath);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  }

  return (
    <main className="flex flex-col gap-4 p-6">
      {/* Full mark already contains the wordmark, so no separate text is needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/scrlpets-mark-full.png"
        alt="Scrlpets"
        width={560}
        height={560}
        className="mx-auto w-64 max-w-full rounded-3xl"
        data-testid="login-mark"
      />
      <h1 className="sr-only">Scrlpets</h1>
      <form onSubmit={signInEmail} className="flex flex-col gap-3">
        <input
          className="rounded border border-input bg-transparent p-2"
          placeholder="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="rounded border border-input bg-transparent p-2"
          type="password"
          placeholder="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit">Sign in</Button>
        <Button type="button" variant="outline" onClick={signUpEmail}>
          Create account
        </Button>
      </form>
      <Button variant="secondary" onClick={signInGoogle}>
        Continue with Google
      </Button>
    </main>
  );
}
