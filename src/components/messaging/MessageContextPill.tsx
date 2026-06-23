import Link from "next/link";
import { cn } from "@/lib/utils";

export type MessageContext = {
  href: string;
  label: string;
  eyebrow: string;
  imageUrl?: string | null;
};

export function MessageContextPill({
  context,
  className,
}: {
  context: MessageContext;
  className?: string;
}) {
  return (
    <Link
      href={context.href}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/10 p-2 transition hover:bg-secondary/15 focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      data-testid="message-context-pill"
    >
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
      </span>
    </Link>
  );
}
