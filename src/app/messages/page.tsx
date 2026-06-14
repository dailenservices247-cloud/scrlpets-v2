import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getInbox } from "@/lib/messaging/queries";
import { Card } from "@/components/ui/card";

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const user = (await getSessionUser())!; // middleware gates /messages
  const inbox = await getInbox(user.id);

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 p-3 backdrop-blur">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <Link href="/" className="text-sm text-brand-link underline" aria-label="Back to feed">
          ←
        </Link>
      </header>
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
                </div>
                {row.lastBody && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{row.lastBody}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
