"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authErrorKey, type AuthErrorKey } from "@/lib/auth/errors";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | "mismatch" | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("mismatch");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(authErrorKey(updateError.message));
      return;
    }
    router.push("/login?notice=password_updated");
    router.refresh();
  }

  return (
    <main className="p-6">
      <h1 className="text-3xl font-semibold">{t("reset.title")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("reset.body")}</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("reset.newPassword")}
          <input
            className="min-h-11 rounded border border-input bg-transparent p-2"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("reset.confirmPassword")}
          <input
            className="min-h-11 rounded border border-input bg-transparent p-2"
            type="password"
            name="password-confirmation"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">{t("passwordHint")}</p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error === "mismatch" ? t("reset.mismatch") : t(`errors.${error}`)}
          </p>
        )}
        <Button className="min-h-11" type="submit" disabled={busy}>
          {busy ? t("working") : t("reset.save")}
        </Button>
      </form>
    </main>
  );
}
