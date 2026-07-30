import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getInbox,
  getMessageRequests,
  getMyReceiptSetting,
} from "@/lib/messaging/queries";
import { Card } from "@/components/ui/card";
import { MessageRequestActions } from "@/components/messaging/MessageRequestActions";
import { ReadReceiptToggle } from "@/components/messaging/ReadReceiptToggle";

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const user = (await getSessionUser())!; // middleware gates /messages
  const [inbox, requests, receiptsOn] = await Promise.all([
    getInbox(user.id),
    getMessageRequests(user.id),
    getMyReceiptSetting(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl lg:border-x lg:border-border/60">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 p-3 backdrop-blur">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <Link href="/" className="text-sm text-brand-link underline" aria-label="Back to feed">
          ←
        </Link>
      </header>

      {/* Cold DMs live here, not in the thread list, until they are accepted.
          A declined request leaves both surfaces entirely. */}
      {requests.length > 0 && (
        <section className="border-b p-3" aria-labelledby="message-requests-heading" data-testid="message-requests">
          <h2 id="message-requests-heading" className="text-sm font-semibold">
            {t("requestsTitle", { count: requests.length })}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("requestsHelp")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {requests.map((row) => (
              <li key={row.id}>
                <Card className="flex flex-col gap-3 p-4" data-testid="message-request">
                  <div>
                    <span className="font-medium">
                      {row.fromDisplayName ?? `@${row.fromUsername}`}
                    </span>
                    {row.preview && (
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                        {row.preview}
                      </p>
                    )}
                  </div>
                  <MessageRequestActions
                    conversationId={row.id}
                    senderName={row.fromDisplayName ?? row.fromUsername}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inbox.length === 0 ? (
        <p className="p-6 text-muted-foreground" data-testid="inbox-empty">
          {t("empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 p-3" data-testid="inbox-list">
          {inbox.map((row) => (
            <Link key={row.id} href={`/messages/${row.id}`}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.otherDisplayName ?? `@${row.otherUsername}`}</span>
                  {row.pending && (
                    <span className="text-xs text-muted-foreground" data-testid="inbox-pending">
                      {t("pendingChip")}
                    </span>
                  )}
                </div>
                {row.lastBody && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{row.lastBody}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <section className="border-t p-3" aria-labelledby="message-privacy-heading">
        <h2 id="message-privacy-heading" className="mb-2 text-sm font-semibold">
          {t("privacyTitle")}
        </h2>
        <ReadReceiptToggle enabled={receiptsOn} />
      </section>
    </main>
  );
}
