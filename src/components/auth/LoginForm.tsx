"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { authErrorKey, type AuthErrorKey, type AuthNoticeKey } from "@/lib/auth/errors";

type Mode = "signin" | "signup";

export function LoginForm({
  nextPath,
  initialError,
  notice,
}: {
  nextPath: string;
  initialError?: AuthErrorKey | null;
  notice?: AuthNoticeKey | null;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [resent, setResent] = useState(false);

  function callbackUrl() {
    const callback = new URL("/auth/callback", location.origin);
    callback.searchParams.set("next", nextPath);
    return callback.toString();
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      setBusy(false);
      if (signUpError) {
        setError(authErrorKey(signUpError.message));
        return;
      }
      if (!data.session) {
        setAwaitingVerification(true);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (signInError) {
        setError(authErrorKey(signInError.message));
        return;
      }
    }

    router.push(nextPath);
    router.refresh();
  }

  async function resendVerification() {
    setError(null);
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(false);
    if (resendError) {
      setError(authErrorKey(resendError.message));
      return;
    }
    setResent(true);
  }

  async function signInGoogle() {
    setError(null);
    setBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (oauthError) {
      setBusy(false);
      setError(authErrorKey(oauthError.message));
    }
  }

  if (awaitingVerification) {
    return (
      <AuthShell>
        <section className="rounded-2xl border border-secondary/35 bg-secondary/10 p-5 text-center" role="status">
          <h1 className="text-2xl font-semibold">{t("verify.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("verify.body", { email })}
          </p>
          {resent && <p className="mt-3 text-sm text-brand-link">{t("verify.resent")}</p>}
          {error && <AuthError error={error} />}
          <Button className="mt-5 min-h-11 w-full" disabled={busy} onClick={resendVerification}>
            {busy ? t("working") : t("verify.resend")}
          </Button>
          <Button
            className="mt-2 min-h-11 w-full"
            variant="ghost"
            onClick={() => {
              setAwaitingVerification(false);
              setMode("signin");
              setResent(false);
            }}
          >
            {t("verify.back")}
          </Button>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="grid grid-cols-2 rounded-xl bg-muted/55 p-1" aria-label={t("modeLabel")}>
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            data-testid={`auth-mode-${value}`}
            aria-pressed={mode === value}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${
              mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
          >
            {t(value === "signin" ? "signIn" : "createAccount")}
          </button>
        ))}
      </div>

      <h1 className="text-center text-2xl font-semibold">
        {t(mode === "signin" ? "welcomeBack" : "join")}
      </h1>
      <p className="text-center text-sm leading-6 text-muted-foreground">
        {t(mode === "signin" ? "signInBody" : "signUpBody")}
      </p>

      {notice && (
        <p className="rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-sm" role="status">
          {t(`notices.${notice}`)}
        </p>
      )}

      <form onSubmit={submitEmail} className="flex flex-col gap-3">
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
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("password")}
          <input
            className="min-h-11 rounded border border-input bg-transparent p-2"
            type="password"
            name="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === "signup" && (
          <p className="text-xs leading-5 text-muted-foreground">{t("passwordHint")}</p>
        )}
        {error && <AuthError error={error} />}
        <Button className="min-h-11" type="submit" disabled={busy} data-testid="auth-submit">
          {busy ? t("working") : t(mode === "signin" ? "signIn" : "createAccount")}
        </Button>
      </form>

      {mode === "signin" && (
        <Link
          href="/forgot-password"
          className="text-center text-sm text-brand-link underline"
        >
          {t("forgot")}
        </Link>
      )}

      <Button className="min-h-11" variant="secondary" disabled={busy} onClick={signInGoogle}>
        {t("google")}
      </Button>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        {t.rich("legal", {
          terms: (chunks) => (
            <Link href="/terms" className="text-brand-link underline">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="text-brand-link underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col gap-4 p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/scrlpets-mark-full.png"
        alt="Scrlpets"
        width={560}
        height={560}
        className="mx-auto w-56 max-w-full rounded-3xl"
        data-testid="login-mark"
      />
      {children}
    </main>
  );
}

function AuthError({ error }: { error: AuthErrorKey }) {
  const t = useTranslations("auth");
  return (
    <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
      {t(`errors.${error}`)}
    </p>
  );
}
