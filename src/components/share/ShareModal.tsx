"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  text?: string;
  mediaUrl?: string | null;
}

export function ShareModal({
  isOpen,
  onClose,
  url,
  title,
  text,
  mediaUrl,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareText = text || title;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Fallback
    } finally {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title,
        text: shareText,
        url,
      });
      onClose();
    } catch {
      // User cancelled share
    }
  };

  const shareOptions = [
    {
      name: "Facebook",
      icon: "📘",
      color: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/30 text-[#1877F2]",
      action: () => {
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;
        window.open(fbUrl, "_blank", "width=600,height=500,noopener,noreferrer");
      },
    },
    {
      name: "X (Twitter)",
      icon: "🐦",
      color: "hover:bg-sky-500/10 hover:border-sky-500/30 text-sky-400",
      action: () => {
        const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
        window.open(xUrl, "_blank", "width=600,height=500,noopener,noreferrer");
      },
    },
    {
      name: "WhatsApp",
      icon: "💬",
      color: "hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-400",
      action: () => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
      },
    },
    {
      name: "Instagram",
      icon: "📸",
      color: "hover:bg-pink-500/10 hover:border-pink-500/30 text-pink-400",
      action: async () => {
        await handleCopy();
        window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      },
      note: "Copies link & opens Instagram",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="share-modal"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-brand-link" />
            <h2 className="text-base font-semibold">Share & Export</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          {/* Preview Card */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-center gap-3">
            {mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt=""
                className="size-12 rounded-lg object-cover ring-1 ring-border shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{title}</p>
              <p className="truncate text-micro text-muted-foreground font-mono">{url}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 gap-1.5 h-8 text-xs font-medium"
              data-testid="share-copy-button"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* 1-Tap Social Destinations */}
          <div>
            <p className="eyebrow px-1 mb-2">Export to Social Platforms</p>
            <div className="grid grid-cols-2 gap-2">
              {shareOptions.map((opt) => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={opt.action}
                  className={`flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition ${opt.color} active:scale-[0.98]`}
                  data-testid={`share-dest-${opt.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{opt.name}</p>
                      {opt.note ? (
                        <p className="text-[10px] text-muted-foreground truncate">{opt.note}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Post directly</p>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="size-3 text-muted-foreground/60 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Native OS Share Sheet Button (Mobile/Tablet) */}
          {canNativeShare && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2 rounded-xl text-xs font-semibold"
              onClick={handleNativeShare}
              data-testid="share-native-device"
            >
              <Share2 className="size-4" />
              <span>More Options (System Share)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
