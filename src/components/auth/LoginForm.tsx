"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { authErrorKey, type AuthErrorKey, type AuthNoticeKey } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { signUpWithPassword } from "@/lib/auth/signup";

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

  function callbackUrl(destination = nextPath) {
    const callback = new URL("/auth/callback", location.origin);
    callback.searchParams.set("next", destination);
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
      // Signup runs in a server action: the password rule and the age gate are
      // decided there, where a scripted client cannot skip them.
      const fd = new FormData();
      fd.set("email", email);
      fd.set("password", password);
      fd.set("ageConfirmed", String(ageConfirmed));
      fd.set("nextPath", nextPath);
      if (referralCode) fd.set("referralCode", referralCode);
      const result = await signUpWithPassword(fd);
      setBusy(false);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      if (result.status === "already_registered") {
        setMode("signin");
        setError("already_registered");
        return;
      }
      if (result.status === "verify") {
        setAwaitingVerification(true);
        return;
      }
      // Session already set by the action. A brand-new account answers the
      // interests screen before it goes anywhere else; the confirmation-email
      // path reaches the same screen through the callback's `next`.
      router.push(`/onboarding?next=${encodeURIComponent(nextPath)}`);
      router.refresh();
      return;
    }

    // The lockout is checked BEFORE the attempt so a locked account is told
    // the truth instead of a "wrong password" no retry can fix.
    //
    // ponytail: the check is a client call to a SECURITY DEFINER function, so
    // a scripted client can skip it and keep guessing — Supabase's own
    // per-IP sign-in rate limit is the backstop there. Closing that gap means
    // proxying sign-in through a server action or an auth hook; the counter
    // this reads is already server-owned and would not change.
    const { data: locked } = await supabase.rpc("is_locked_out", {
      target_email: email,
    });
    if (locked) {
      setBusy(false);
      setError("locked_out");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      const key = authErrorKey(signInError.message);
      // Unconfirmed accounts get the pending/resend screen, not a dead end —
      // and no failure is recorded, because their password was not the problem.
      if (key === "email_not_confirmed") {
        setAwaitingVerification(true);
        return;
      }
      if (key === "invalid_credentials") {
        await supabase.rpc("record_login_failure", { target_email: email });
        // That failure may be the one that trips the lock. Say so now rather
        // than after another wasted attempt.
        const { data: nowLocked } = await supabase.rpc("is_locked_out", {
          target_email: email,
        });
        setError(nowLocked ? "locked_out" : key);
        return;
      }
      setError(key);
      return;
    }
    // A good login un-sticks the counter.
    await supabase.rpc("clear_login_failures", { target_email: email });

    router.push(nextPath);
    router.refresh();
  }

  async function resendVerification() {
    setError(null);
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      // Same destination the signup action asked for, so a resent link does
      // not quietly skip the interests screen.
      options: {
        emailRedirectTo: callbackUrl(`/onboarding?next=${encodeURIComponent(nextPath)}`),
      },
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
            minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
            aria-describedby={mode === "signup" ? "password-rule" : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {/* Stated before submitting, not discovered afterwards. The server
            action enforces exactly this sentence. */}
        {mode === "signup" && (
          <p id="password-rule" className="text-xs leading-5 text-muted-foreground" data-testid="password-rule">
            {t("passwordRule")}
          </p>
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
    <p
      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
      data-testid="auth-error"
      // The KEY, not the copy: a test can then assert which refusal happened
      // without pinning the wording of a translated sentence.
      data-error={error}
    >
      {t(`errors.${error}`)}
    </p>
  );
}
