"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authErrorKey, type AuthErrorKey } from "@/lib/auth/errors";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const callback = new URL("/auth/callback", location.origin);
    callback.searchParams.set("next", "/reset-password");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callback.toString(),
    });
    setBusy(false);
    if (resetError) {
      setError(authErrorKey(resetError.message));
      return;
    }
    setSent(true);
  }

  return (
    <main className="p-6">
      <Link href="/login" className="text-sm text-brand-link underline">
        {t("backToSignIn")}
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">{t("recovery.title")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("recovery.body")}
      </p>
      {sent ? (
        <section className="mt-6 rounded-2xl border border-secondary/35 bg-secondary/10 p-5" role="status">
          <h2 className="font-semibold">{t("recovery.sentTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("recovery.sentBody", { email })}
          </p>
        </section>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("email")}
            <input
              className="min-h-11 rounded border border-input bg-transparent p-2"
              type="email"
              name="email"
              autoComplete="email"
              required
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
          <Button className="min-h-11" type="submit" disabled={busy}>
            {busy ? t("working") : t("recovery.send")}
          </Button>
        </form>
      )}
    </main>
  );
}
