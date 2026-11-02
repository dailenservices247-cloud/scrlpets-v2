import Link from "next/link";
import type { ElementType, ReactNode } from "react";

const TOKEN_REGEX = /(https?:\/\/[^\s]+|#[\w\d_]+|@[\w\d_]+)/gi;

export function FormattedBody({
  content,
  className = "whitespace-pre-wrap text-body",
  testId = "post-body-text",
  as: Component = "p",
}: {
  content: string;
  className?: string;
  testId?: string;
  as?: ElementType;
}) {
  if (!content) return null;

  const parts: ReactNode[] = [];
  const tokens = content.split(TOKEN_REGEX);

  tokens.forEach((part, index) => {
    if (!part) return;

    if (part.startsWith("#") && part.length > 1) {
      parts.push(
        <Link
          key={`tag-${index}`}
          href={`/search?q=${encodeURIComponent(part)}`}
          className="font-medium text-brand-link transition hover:underline"
        >
          {part}
        </Link>,
      );
    } else if (part.startsWith("@") && part.length > 1) {
      const username = part.slice(1);
      parts.push(
        <Link
          key={`mention-${index}`}
          href={`/u/${username}`}
          className="font-medium text-brand-link transition hover:underline"
        >
          {part}
        </Link>,
      );
    } else if (part.startsWith("http://") || part.startsWith("https://")) {
      parts.push(
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-brand-link underline transition hover:opacity-80"
        >
          {part}
        </a>,
      );
    } else {
      parts.push(part);
    }
  });

  return (
    <Component className={className} data-testid={testId}>
      {parts}
    </Component>
  );
}
