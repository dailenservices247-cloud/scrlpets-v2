import { Capacitor } from "@capacitor/core";

export type DeepLinkHandler = (path: string) => void;

/**
 * Extracts internal relative app path from an external deep link URL or push payload.
 * Supports:
 * - https://scrlpets.com/messages/conv-123 -> /messages/conv-123
 * - scrlpets://watch/reel/reel-456 -> /watch/reel/reel-456
 * - /orders/ord-789 -> /orders/ord-789
 */
export function parseDeepLinkPath(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  try {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith("/")) {
      return trimmed;
    }

    if (trimmed.startsWith("scrlpets://")) {
      const rest = trimmed.replace("scrlpets://", "");
      return rest.startsWith("/") ? rest : `/${rest}`;
    }

    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("scrlpets.com") || parsed.hostname.includes("localhost")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the current runtime is a native Capacitor Android or iOS container.
 */
export function isNativeMobile(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

interface CapacitorAppPlugin {
  addListener: (
    eventName: "appUrlOpen",
    listenerFunc: (data: { url: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

interface CustomWindow extends Window {
  Capacitor?: {
    Plugins?: {
      App?: CapacitorAppPlugin;
    };
  };
}

/**
 * Registers deep-link listeners if running in a native Capacitor mobile container.
 * In browser/PWA, this cleanly no-ops without throwing.
 */
export function registerMobileDeepLinks(onNavigate: DeepLinkHandler): () => void {
  if (!isNativeMobile()) return () => {};

  const win = window as unknown as CustomWindow;
  if (win.Capacitor?.Plugins?.App) {
    const listenerPromise = win.Capacitor.Plugins.App.addListener(
      "appUrlOpen",
      (data: { url: string }) => {
        const path = parseDeepLinkPath(data.url);
        if (path) onNavigate(path);
      },
    );

    return () => {
      void listenerPromise.then((handle) => handle?.remove?.());
    };
  }

  return () => {};
}
