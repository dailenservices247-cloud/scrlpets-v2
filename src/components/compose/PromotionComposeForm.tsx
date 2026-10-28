"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { createPost } from "@/lib/compose/actions";
import type { ComposeAttribution } from "./ComposerTabs";

export function PromotionComposeForm({
  userId,
  attribution,
  disabled,
}: {
  userId: string;
  attribution: ComposeAttribution;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const fd = new FormData();
    const fullBody = [headline.trim(), body.trim(), ctaUrl.trim() ? `Learn more: ${ctaUrl.trim()}` : ""]
      .filter(Boolean)
      .join("\n\n");

    fd.set("body", fullBody);
    fd.set("contentType", "post");
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    fd.set("postingAsType", attribution.postingAsType);
    if (attribution.brandId) fd.set("brandId", attribution.brandId);

    const res = await createPost(fd);
    setBusy(false);

    if (res.ok) {
      router.push("/");
    } else {
      setErr(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="promotion-compose-form">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Promotion Headline</label>
        <input
          required
          placeholder="e.g. 🐶 Spring Litter Announcements Now Open! or 20% Off Boarding This Month"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm font-semibold"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Announcement Details</label>
        <textarea
          rows={3}
          placeholder="Share your promotion details, dates, discount codes, or kennel updates with the Scrlpets community..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Destination / Link (Optional)</label>
        <input
          type="url"
          placeholder="https://scrlpets.com/litters/... or website URL"
          value={ctaUrl}
          onChange={(e) => setCtaUrl(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </div>

      <MediaInput userId={userId} onUploaded={setMediaUrl} />

      {err && <p className="text-xs text-destructive">{err}</p>}

      <Button type="submit" disabled={disabled || busy} className="min-h-11 font-semibold">
        {busy ? "Broadcasting..." : "Publish Promotion to Feed"}
      </Button>
    </form>
  );
}
