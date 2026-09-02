"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { changeUsername } from "@/lib/profiles/actions";
import { validateUsername } from "@/lib/profiles/username";
import { Button } from "@/components/ui/button";

/**
 * Separate from ProfileEditForm on purpose: a handle change rewrites the
 * address of your public page and is rate-limited, so it should not ride along
 * with editing a bio. Different consequence, different button.
 */
/**
 * The reasons the action and the database can raise. Anything outside this list
 * falls back to the generic message rather than being interpolated into a
 * message key that does not exist — next-intl throws on a missing key, so an
 * unexpected postgres error would have crashed the form instead of explaining
 * itself.
 */
const KNOWN_ERRORS = [
  "username_taken",
  "username_cooldown",
  "username_reserved",
  "username_format",
  "username_length",
  "username_leading",
];

export function UsernameForm({ current }: { current: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Same validator the action and the database use, so the form refuses what
  // the server would refuse instead of round-tripping to find out.
  const parsed = validateUsername(value);
  const unchanged = parsed.ok && parsed.value === current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.ok || unchanged) return;
    setBusy(true);
    setErr(null);
    setDone(false);
    const fd = new FormData();
    fd.set("username", value);
    const res = await changeUsername(fd);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "generic");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="premium-panel rounded-2xl p-4" data-testid="username-form">
      <label className="text-sm font-medium" htmlFor="username">
        {t("usernameLabel")}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">@</span>
        <input
          id="username"
          data-testid="username-input"
          className="min-h-11 w-full rounded-xl border border-input bg-background px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("usernameHint")}</p>

      {err && (
        <p className="mt-3 text-sm text-destructive" role="alert" data-testid="username-error">
          {t(`usernameError.${KNOWN_ERRORS.includes(err) ? err : "generic"}`)}
        </p>
      )}
      {done && (
        <p className="mt-3 text-sm text-brand-link" role="status" data-testid="username-saved">
          {t("usernameSaved")}
        </p>
      )}

      <Button
        type="submit"
        className="mt-4 min-h-11 w-full"
        disabled={busy || !parsed.ok || unchanged}
        data-testid="username-save"
      >
        {t("usernameSave")}
      </Button>
    </form>
  );
}
