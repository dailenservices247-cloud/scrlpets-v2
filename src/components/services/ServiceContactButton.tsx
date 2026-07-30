"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startServiceInquiry } from "@/lib/services/actions";

function errorKey(error: string): string {
  const keys = ["service_unavailable", "self_inquiry", "auth_required"];
  return keys.find((key) => key === error) ?? "inquiry_failed";
}

// V3-01: signed-in non-owner gets a working Contact action; the owner sees a
// static note instead (never a button to message themselves); signed-out
// gets a sign-in prompt that returns here afterward.
export function ServiceContactButton({
  serviceId,
  ownerId,
  viewerId,
  returnPath,
}: {
  serviceId: string;
  ownerId: string;
  viewerId?: string | null;
  returnPath: string;
}) {
  const t = useTranslations("services");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (viewerId && viewerId === ownerId) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={`service-owner-state-${serviceId}`}>
        {t("contact.ownerState")}
      </p>
    );
  }

  if (!viewerId) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnPath)}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium text-brand-link"
        data-testid={`service-contact-signin-${serviceId}`}
      >
        <MessageCircle className="size-4" aria-hidden />
        {t("contact.signIn")}
      </Link>
    );
  }

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startServiceInquiry(serviceId);
    setBusy(false);
    if (!result.ok) {
      setError(errorKey(result.error));
      return;
    }
    router.push(`/messages/${result.conversationId}`);
  }

  return (
    <div>
      <Button type="button" disabled={busy} onClick={start} data-testid={`service-contact-${serviceId}`}>
        <MessageCircle className="size-4" aria-hidden />
        {busy ? t("contact.starting") : t("contact.action")}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-200" role="alert">
          {t(`contact.errors.${error}`)}
        </p>
      )}
    </div>
  );
}
