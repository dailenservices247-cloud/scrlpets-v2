"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { capture, FUNNEL_EVENTS } from "@/lib/analytics";
import { authErrorKey } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

type Failure = "code" | "rate_limited";

/**
 * The second factor, asked for after any sign-in — proxy.ts sends every session
 * that still owes it here, however it signed in.
 *
 * The exchange runs in the browser because challenge/verify upgrades the session
 * making the call; a server action would upgrade the wrong thing.
 */
export function TwoFactorChallenge({
  nextPath,
  factorId,
}: {
  nextPath: string;
  factorId: string | null;
}) {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setFailure(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      // authErrorKey files anything mentioning "otp" — so "Invalid TOTP code" —
      // under an expired link. A rate limit is still a rate limit.
      setFailure(authErrorKey(error.message) === "rate_limited" ? "rate_limited" : "code");
      setCode("");
      return;
    }
    capture(FUNNEL_EVENTS.mfaChallengePassed);
    router.push(nextPath);
    router.refresh();
  }

  return (
    <AuthShell>
      <section
        className="rounded-2xl border border-secondary/35 bg-secondary/10 p-5"
        data-testid="two-factor"
      >
        <h1 className="text-center text-2xl font-semibold">{t("title")}</h1>
        <form onSubmit={submitCode} className="mt-5 flex flex-col gap-3">
          <p className="text-center text-sm leading-6 text-muted-foreground">{t("body")}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("codeLabel")}
            <input
              className="min-h-11 rounded border border-input bg-transparent p-2 text-center text-lg tracking-[0.4em]"
              type="text"
              name="one-time-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              data-testid="two-factor-code-input"
            />
          </label>
          {failure && <ChallengeError failure={failure} />}
          <Button
            className="min-h-11"
            type="submit"
            disabled={busy || code.length < 6}
            data-testid="two-factor-submit"
          >
            {busy ? t("working") : t("submit")}
          </Button>
        </form>
        <form action="/auth/signout" method="post" className="mt-2">
          <Button
            className="min-h-11 w-full"
            variant="ghost"
            type="submit"
            data-testid="two-factor-signout"
          >
            {t("signOut")}
          </Button>
        </form>
      </section>
    </AuthShell>
  );
}

function ChallengeError({ failure }: { failure: Failure }) {
  const t = useTranslations("auth.twoFactor");
  return (
    <p
      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
      data-testid="two-factor-error"
      data-error={failure}
    >
      {t(`errors.${failure}`)}
    </p>
  );
}
