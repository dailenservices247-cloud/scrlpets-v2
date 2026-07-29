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
  initialMode = "signin",
  referralCode = null,
}: {
  nextPath: string;
  initialError?: AuthErrorKey | null;
  notice?: AuthNoticeKey | null;
  initialMode?: Mode;
  referralCode?: string | null;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [resent, setResent] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  function callbackUrl() {
    const callback = new URL("/auth/callback", location.origin);
    callback.searchParams.set("next", nextPath);
    // OAuth cannot carry signup metadata, so the invite code rides the
    // callback URL; the callback route claims it once a session exists.
    if (referralCode) callback.searchParams.set("ref", referralCode);
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
        options: {
          emailRedirectTo: callbackUrl(),
          // The confirmation link may be opened on another device, where the
          // ref query param of THIS page no longer exists. Metadata survives
          // the hop; the callback claims it and clears the key.
          ...(referralCode ? { data: { referral_code: referralCode } } : {}),
        },
      });
      setBusy(false);
      if (signUpError) {
        setError(authErrorKey(signUpError.message));
        return;
      }
      // With email confirmation on, Supabase obfuscates existing confirmed
      // accounts as a success with no identities — no email will arrive.
      if (data.user && data.user.identities?.length === 0) {
        setMode("signin");
        setError("already_registered");
        return;
      }
      if (!data.session) {
        setAwaitingVerification(true);
        return;
      }
      // Confirmation off (dev/E2E): the session exists right here and no
      // callback will ever run, so this is the only chance to claim. Best
      // effort — every real refusal lives in the definer and stays silent.
      if (referralCode) {
        await supabase.rpc("claim_referral", { code: referralCode });
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (signInError) {
        const key = authErrorKey(signInError.message);
        // Unconfirmed accounts get the pending/resend screen, not a dead end.
        if (key === "email_not_confirmed") {
          setAwaitingVerification(true);
          return;
        }
        setError(key);
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
        {mode === "signup" && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="age-confirmation"
              data-testid="age-confirmation"
              required
              className="size-5 shrink-0 accent-primary"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
            />
            {t("ageConfirmation")}
          </label>
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
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
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
