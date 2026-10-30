"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareModal } from "./ShareModal";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  mediaUrl?: string | null;
  className?: string;
  variant?: "ghost" | "outline" | "pill" | "icon";
  showLabel?: boolean;
}

export function ShareButton({
  url,
  title,
  text,
  mediaUrl,
  className,
  variant = "ghost",
  showLabel = true,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98]",
          variant === "ghost" && "h-9 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          variant === "outline" && "h-9 px-3 rounded-xl border border-border/80 text-xs font-semibold hover:bg-muted/40",
          variant === "pill" && "h-8 px-3 rounded-full bg-secondary/30 text-xs font-medium text-foreground hover:bg-secondary/50",
          variant === "icon" && "size-9 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60",
          className,
        )}
        data-testid="share-trigger-button"
        aria-label="Share post"
        title="Share"
      >
        <Share2 className="size-4 shrink-0" />
        {showLabel && <span className="text-xs">Share</span>}
      </button>

      <ShareModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        url={url}
        title={title}
        text={text}
        mediaUrl={mediaUrl}
      />
    </>
  );
}
