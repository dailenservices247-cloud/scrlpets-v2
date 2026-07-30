"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startConversation } from "@/lib/messaging/actions";

export function MessageButton({ profileId }: { profileId: string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  async function go() {
    // "direct": a DM opened off someone's profile is the cold knock the
    // request gate exists for. Packmates are exempted inside the action.
    const res = await startConversation(profileId);
    if ("id" in res) {
      router.push(`/messages/${res.id}`);
    }
  }
  return (
    <button
      onClick={go}
      data-testid="message-button"
      className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
    >
      {t("message")}
    </button>
  );
}
