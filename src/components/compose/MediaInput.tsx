"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { uploadPhoto } from "@/lib/media/upload";

export function MediaInput({
  userId,
  onUploaded,
}: {
  userId: string;
  onUploaded: (url: string | null) => void;
}) {
  const t = useTranslations("compose");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    const res = await uploadPhoto(file, userId);
    setBusy(false);
    if ("error" in res) {
      setErr(res.error);
      onUploaded(null);
      return;
    }
    setPreview(res.url);
    onUploaded(res.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted-foreground">
        {busy ? t("uploading") : t("addPhoto")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handle}
          className="block mt-1 text-sm"
          data-testid="media-input"
          disabled={busy}
        />
      </label>
      {err && <p className="text-destructive text-sm">{err}</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          width={800}
          height={600}
          className="h-auto w-full max-h-60 rounded-md object-cover"
          data-testid="media-preview"
        />
      )}
    </div>
  );
}
