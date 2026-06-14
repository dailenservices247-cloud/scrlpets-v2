"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }
  async function signUpEmail() {
    setErr(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }
  async function signInGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="p-6 flex flex-col gap-4">
      {/* Full mark already contains the wordmark — no separate text needed here. */}
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
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded border border-input bg-transparent p-2"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-destructive text-sm">{err}</p>}
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
