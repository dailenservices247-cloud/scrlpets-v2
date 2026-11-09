"use client";

import { useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";

export function DismissibleFeedCard({
  children,
}: {
  children: (onHide: () => void) => ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <div
        className="my-3 flex items-center justify-between rounded-2xl border border-border/80 bg-muted/40 px-4 py-3.5 text-xs text-muted-foreground shadow-sm transition-opacity duration-200"
        data-testid="feed-card-hidden-notice"
      >
        <p className="font-medium text-foreground/80">
          Post hidden. You will see fewer posts like this.
        </p>
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-link transition hover:bg-primary/10 hover:underline"
          data-testid="undo-hide-post"
        >
          <Undo2 className="size-3.5" />
          <span>Undo</span>
        </button>
      </div>
    );
  }

  return <>{children(() => setHidden(true))}</>;
}
