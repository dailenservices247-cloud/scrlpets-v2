"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Not in lib.dom: Chromium-only, and only the two members we use. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STANDALONE = "(display-mode: standalone)";

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The one-tap install button, shown ONLY when the browser actually offers one.
 * Safari and Firefox never fire this event, so the page's written steps — not
 * this button — are the reliable path; it is an accelerator, not the feature.
 */
export function InstallPrompt() {
  const t = useTranslations("install");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Display mode is the browser's state, not React's — read it, don't mirror it.
  const installed = useSyncExternalStore(
    subscribeDisplayMode,
    () => window.matchMedia(STANDALONE).matches,
    () => false,
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p
        className="rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-sm"
        role="status"
        data-testid="install-already"
      >
        {t("alreadyInstalled")}
      </p>
    );
  }

  if (!deferred) return null;

  return (
    <Button
      className="min-h-11 w-full"
      data-testid="install-button"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        // A prompt event is single-use whatever the person chose.
        setDeferred(null);
      }}
    >
      {t("installCta")}
    </Button>
  );
}
