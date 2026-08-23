"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { generateRecoveryCodes } from "@/lib/mfa/actions";

/**
 * Enrolling a second factor, and the recovery codes that keep enrolling from
 * being a trap.
 *
 * The TOTP exchange runs in the BROWSER because challenge/verify upgrades the
 * session that is making the call — a server action would be upgrading the
 * wrong thing. Recovery is the opposite: it needs the service role, so it lives
 * in `lib/mfa/actions`.
 *
 * The codes are shown exactly once, and the panel makes the member say they
 * saved them. A "we generated codes, they're around somewhere" flow is how
 * people discover recovery does not exist on the day they need it.
 */
type Stage = "idle" | "enrolling" | "codes";

export function MfaPanel({ enrolled, codesLeft }: { enrolled: boolean; codesLeft: number }) {
  const t = useTranslations("account");
  const router = useRouter();
  const supabase = createClient();

  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);

  function explain(raw: string): string {
    if (raw.includes("Invalid TOTP") || raw.includes("invalid_code")) {
      return t("mfaErrorInvalidCode");
    }
    if (raw.includes("not_configured")) return t("mfaErrorNotConfigured");
    if (raw.includes("auth_required")) return t("mfaErrorAuthRequired");
    return t("mfaErrorGeneric");
  }

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(explain(enrollError?.message ?? ""));
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStage("enrolling");
  }

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (verifyError) {
      setBusy(false);
      setError(explain(verifyError.message));
      return;
    }
    // Codes are minted only AFTER the factor is verified. Minting them earlier
    // would hand out recovery for a factor that never came into existence.
    const result = await generateRecoveryCodes();
    setBusy(false);
    if (!result.ok) {
      setError(explain(result.error));
      return;
    }
    setCodes(result.codes);
    setStage("codes");
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    const result = await generateRecoveryCodes();
    setBusy(false);
    if (!result.ok) {
      setError(explain(result.error));
      return;
    }
    setCodes(result.codes);
    setStage("codes");
  }

  async function disable() {
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.mfa.listFactors();
    for (const factor of data?.totp ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="mt-6" data-testid="mfa-panel">
      <h2 className="text-sm font-semibold">{t("mfaTitle")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("mfaBody")}</p>

      {stage === "codes" ? (
        <div className="mt-3 rounded-xl border border-border/70 p-3" data-testid="mfa-codes">
          <p className="text-sm font-semibold">{t("mfaCodesTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("mfaCodesBody")}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
            {codes.map((c) => (
              <li key={c} data-testid="mfa-code">
                {c}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground"
            data-testid="mfa-codes-confirm"
            onClick={() => {
              setStage("idle");
              router.refresh();
            }}
          >
            {t("mfaCodesConfirm")}
          </button>
        </div>
      ) : stage === "enrolling" ? (
        <div className="mt-3 flex flex-col gap-2" data-testid="mfa-enrolling">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI from
              Supabase, not a remote asset; next/image would proxy it pointlessly. */}
          {qr && <img src={qr} alt="" className="size-40 self-start" data-testid="mfa-qr" />}
          <p className="text-xs text-muted-foreground">{t("mfaSecretLabel")}</p>
          <code className="break-all text-xs" data-testid="mfa-secret">
            {secret}
          </code>
          <label className="text-xs text-muted-foreground" htmlFor="mfa-code">
            {t("mfaCodeLabel")}
          </label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            data-testid="mfa-code-input"
          />
          <button
            type="button"
            disabled={busy || code.trim().length < 6}
            className="min-h-11 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            data-testid="mfa-verify"
            onClick={verify}
          >
            {busy ? t("mfaVerifying") : t("mfaVerify")}
          </button>
        </div>
      ) : enrolled ? (
        <div className="mt-3 flex flex-col gap-2" data-testid="mfa-enrolled">
          <p className="text-sm">{t("mfaEnrolled")}</p>
          <p className="text-xs text-muted-foreground" data-testid="mfa-codes-remaining">
            {t("mfaCodesRemaining", { count: codesLeft })}
          </p>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
            data-testid="mfa-regenerate"
            onClick={regenerate}
          >
            {busy ? t("mfaCodesRegenerating") : t("mfaCodesRegenerate")}
          </button>
          <p className="text-xs text-muted-foreground">{t("mfaCodesRegenerateWarning")}</p>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
            data-testid="mfa-disable"
            onClick={disable}
          >
            {busy ? t("mfaDisabling") : t("mfaDisable")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          className="mt-3 min-h-11 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          data-testid="mfa-start"
          onClick={start}
        >
          {busy ? t("mfaStarting") : t("mfaStart")}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive" data-testid="mfa-error">
          {error}
        </p>
      )}
    </section>
  );
}
