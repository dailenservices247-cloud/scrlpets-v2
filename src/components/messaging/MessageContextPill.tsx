import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MessageContext } from "@/lib/messaging/context";

export function MessageContextPill({
  context,
  className,
}: {
  context: MessageContext;
  className?: string;
}) {
  const content = (
    <>
      {context.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={context.imageUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-sm text-secondary-foreground" aria-hidden>
          {context.label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="eyebrow block">{context.eyebrow}</span>
        <span className="block truncate text-sm font-medium">{context.label}</span>
        {context.description && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {context.description}
          </span>
        )}
      </span>
    </>
  );
  const classes = cn(
    "flex min-h-14 items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/10 p-2",
    context.href &&
      "transition hover:bg-secondary/15 focus:outline-none focus:ring-2 focus:ring-ring",
    className,
  );

  return context.href ? (
    <Link
      href={context.href}
      className={classes}
      data-testid="message-context-pill"
    >
      {content}
    </Link>
  ) : (
    <div className={classes} data-testid="message-context-pill">
      {content}
    </div>
  );
}
