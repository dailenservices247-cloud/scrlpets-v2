import { listHighlights } from "@/lib/highlights/queries";
import { HighlightsPanel } from "./HighlightsPanel";

/**
 * Story highlights on an animal's page. Self-fetching so mounting it is one
 * line, and hidden entirely from visitors when there is nothing to show —
 * an empty rail on someone else's animal is noise, not information.
 */
export async function HighlightsSection({
  creatureId,
  slug,
  creatureName,
  isOwner,
  viewerId,
}: {
  creatureId: string;
  slug: string;
  creatureName: string;
  isOwner: boolean;
  viewerId: string | null;
}) {
  const highlights = await listHighlights(creatureId);
  if (highlights.length === 0 && !isOwner) return null;

  return (
    <HighlightsPanel
      creatureId={creatureId}
      slug={slug}
      creatureName={creatureName}
      highlights={highlights}
      canManage={isOwner && Boolean(viewerId)}
      viewerId={viewerId}
    />
  );
}
