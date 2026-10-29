import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getConversationParticipants,
  getReceiptState,
  getThread,
  getOtherParticipantProfile,
} from "@/lib/messaging/queries";
import { getListingInquiryContexts } from "@/lib/marketplace/queries";
import type { MessageContext } from "@/lib/messaging/context";
import { MessageThread } from "@/components/messaging/MessageThread";
import { DealRoomPanel } from "@/components/messaging/DealRoomPanel";
import {
  getDealContractsForConversation,
  getTransportQuotesForConversation,
  getAvailableTransportServices,
} from "@/lib/contracts/queries";
import { AppPage } from "@/components/app/AppPage";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!; // middleware gates /messages
  const conv = await getConversationParticipants(id);
  if (!conv || (conv.userA !== user.id && conv.userB !== user.id)) notFound();
  const [initial, other, listingContexts, receipts, contracts, quotes, transportServices, locale, t] = await Promise.all([
    getThread(id, user.id),
    getOtherParticipantProfile(id, user.id),
    getListingInquiryContexts(id),
    getReceiptState(id, user.id),
    getDealContractsForConversation(id),
    getTransportQuotesForConversation(id),
    getAvailableTransportServices(),
    getLocale(),
    getTranslations("messages"),
  ]);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const contexts: MessageContext[] = listingContexts.map((context) => {
    const isDirectCreatureInquiry =
      !context.listingId && context.priceCents === 0 && Boolean(context.creatureId);
    return {
      kind: isDirectCreatureInquiry ? "creature" : "listing",
      id: context.id,
      label: context.title,
      eyebrow: isDirectCreatureInquiry
        ? t("creatureContext")
        : t(
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
      href: context.listingId
        ? `/listing/${context.listingId}`
        : context.creatureSlug
          ? `/c/${context.creatureSlug}`
          : null,
    };
  });
  const otherName = other?.display_name ?? `@${other?.username ?? "unknown"}`;

  return (
    <AppPage>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 p-3 backdrop-blur">
        <Link
          href="/messages"
          className="grid size-8 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <h1 className="text-base font-bold">{otherName}</h1>
      </header>
      <div className="p-3">
        <DealRoomPanel
          conversationId={id}
          viewerId={user.id}
          contracts={contracts}
          inquiries={listingContexts}
          quotes={quotes}
          transportServices={transportServices}
        />
        <MessageThread
          conversationId={id}
          meId={user.id}
          initial={initial}
          contexts={contexts}
          gate={{ status: conv.status, iInitiated: conv.initiatedBy === user.id }}
          otherName={otherName}
          otherLastReadAt={receipts.otherLastReadAt}
        />
      </div>
    </AppPage>
  );
}
