"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPost } from "@/lib/compose/actions";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

export function PostForm({
  userId,
  creatures,
}: {
  userId: string;
  creatures: { id: string; name: string }[];
}) {
  const t = useTranslations("compose");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("body", body);
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (creatureId) fd.set("creatureId", creatureId);
    const res = await createPost(fd);
    setBusy(false);
    if (!res.ok) {
      setErr(t("errorRequired"));
      return;
    }
    capture("post_created", { has_media: !!mediaUrl, has_creature: !!creatureId });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-4" data-testid="post-form">
      <textarea
        className="min-h-28 rounded border border-input bg-transparent p-2"
        placeholder={t("bodyPlaceholder")}
        aria-label={t("bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-testid="post-body"
      />
      <MediaInput userId={userId} onUploaded={setMediaUrl} />
      <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy} data-testid="post-submit">
        {t("submitPost")}
      </Button>
    </form>
  );
}
