import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getConversationParticipants,
  getThread,
  getOtherParticipantProfile,
} from "@/lib/messaging/queries";
import { getListingInquiryContexts } from "@/lib/marketplace/queries";
import type { MessageContext } from "@/lib/messaging/context";
import { MessageThread } from "@/components/messaging/MessageThread";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!; // middleware gates /messages
  const conv = await getConversationParticipants(id);
  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) notFound();
  const [initial, other, listingContexts, locale, t] = await Promise.all([
    getThread(id),
    getOtherParticipantProfile(id, user.id),
    getListingInquiryContexts(id),
    getLocale(),
    getTranslations("messages"),
  ]);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const contexts: MessageContext[] = listingContexts.map((context) => ({
    kind: "listing",
    id: context.id,
    label: context.title,
    eyebrow: t(
      context.listingId
        ? "listingContext"
        : "listingContextUnavailable",
      {
        price: money.format(context.priceCents / 100),
      },
    ),
    description:
      [context.brandName, context.creatureName].filter(Boolean).join(" · ") ||
      null,
    href: context.listingId ? `/listing/${context.listingId}` : null,
  }));

  return (
    <main className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 p-3 backdrop-blur">
        <Link href="/messages" className="text-sm text-brand-link underline" aria-label="Back to messages">
          ←
        </Link>
        <h1 className="text-base font-bold">
          {other?.display_name ?? `@${other?.username ?? "unknown"}`}
        </h1>
      </header>
      <div className="p-3">
        <MessageThread
          conversationId={id}
          meId={user.id}
          initial={initial}
          contexts={contexts}
        />
      </div>
    </main>
  );
}
