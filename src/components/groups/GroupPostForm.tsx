"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MediaInput } from "@/components/compose/MediaInput";
import { Button } from "@/components/ui/button";
import { createGroupPost } from "@/lib/groups/actions";

/** Members-only composer. Rendered by the group page only when the viewer has joined. */
export function GroupPostForm({
  groupId,
  slug,
  userId,
}: {
  groupId: string;
  slug: string;
  userId: string;
}) {
  const t = useTranslations("groups");
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
    const res = await createGroupPost(groupId, slug, fd);
    setBusy(false);
    if (!res.ok) {
      setErr(t("errorRequired"));
      return;
    }
    setBody("");
    setMediaUrl(null);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="group-post-form">
      <textarea
        className="min-h-24 rounded border border-input bg-transparent p-2"
        placeholder={t("postPlaceholder")}
        aria-label={t("postPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-testid="group-post-body"
      />
      <MediaInput userId={userId} onUploaded={(url) => setMediaUrl(url)} />
      {/* The other half of the same disclosure as the main composer: a group
          post is an ordinary public post that also carries a group label. */}
      <p className="text-xs text-muted-foreground" data-testid="group-public-notice">
        {t("postPublicNotice")}
      </p>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="self-start" data-testid="group-post-submit">
        {t("submitPost")}
      </Button>
    </form>
  );
}
