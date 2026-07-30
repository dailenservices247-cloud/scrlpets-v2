"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MediaInput } from "@/components/compose/MediaInput";
import { Button } from "@/components/ui/button";
import { shareAlumniUpdate } from "@/lib/alumni/actions";

/**
 * The update composer, open to both parties.
 *
 * Same shape as the group composer, and for the same reason: it only shapes the
 * row. An update is a post tagged to the animal, so `shareAlumniUpdate` hands
 * off to the real composer action and inherits its validation.
 */
export function AlumniUpdateForm({
  alumniId,
  animalName,
  userId,
}: {
  alumniId: string;
  animalName: string;
  userId: string;
}) {
  const t = useTranslations("alumni");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("body", body);
    fd.set("mediaUrl", mediaUrl ?? "");
    const res = await shareAlumniUpdate(alumniId, fd);
    setBusy(false);
    if (!res.ok) {
      setErr(t("composerError"));
      return;
    }
    setBody("");
    setMediaUrl(null);
    router.refresh();
  }

  const placeholder = t("composerPlaceholder", { name: animalName });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="alumni-update-form">
      <textarea
        className="min-h-24 rounded border border-input bg-transparent p-2"
        placeholder={placeholder}
        aria-label={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-testid="alumni-update-body"
      />
      <MediaInput userId={userId} onUploaded={(url) => setMediaUrl(url)} />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="self-start" data-testid="alumni-update-submit">
        {t("composerSubmit")}
      </Button>
    </form>
  );
}
