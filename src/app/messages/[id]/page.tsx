import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  getConversationParticipants,
  getThread,
  getOtherParticipantProfile,
} from "@/lib/messaging/queries";
import { MessageThread } from "@/components/messaging/MessageThread";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!; // middleware gates /messages
  const conv = await getConversationParticipants(id);
  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) notFound();
  const [initial, other] = await Promise.all([
    getThread(id),
    getOtherParticipantProfile(id, user.id),
  ]);

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
        <MessageThread conversationId={id} meId={user.id} initial={initial} />
      </div>
    </main>
  );
}
