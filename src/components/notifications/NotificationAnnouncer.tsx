"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { unreadNotificationCount } from "@/lib/notifications/actions";

const POLL_MS = 30_000;

/**
 * Announces newly-arrived notifications to screen readers.
 *
 * A live region only speaks when its content CHANGES while the page is open,
 * so something has to notice the arrival. That something is a poll rather than
 * a Realtime subscription because `public.notifications` is not in the
 * supabase_realtime publication — only `public.messages` is — and adding it
 * needs a migration this lane cannot ship.
 *
 * ponytail: 30s poll, paused while the tab is hidden via the native
 * visibilitychange event. Swap for a Realtime subscription the moment
 * notifications joins the publication.
 */
export function NotificationAnnouncer({ initialUnread }: { initialUnread?: number }) {
  const t = useTranslations("notifications");
  const [message, setMessage] = useState("");
  // Undefined means "not seeded yet" — the first poll establishes the baseline
  // instead of announcing it. Without that, mounting app-wide would announce a
  // backlog of already-seen notifications on every page load.
  const lastCount = useRef<number | undefined>(initialUnread);
  // A live region only speaks when its text CHANGES. Two single arrivals in a
  // row produce the same string, React bails on the identical value, the DOM
  // never changes, and the second one is silent. The nonce forces a change
  // without altering what is read out.
  const nonce = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      const count = await unreadNotificationCount();
      if (cancelled) return;
      const previous = lastCount.current;
      if (previous !== undefined && count > previous) {
        nonce.current += 1;
        setMessage(
          `${t("announceNew", { count: count - previous })}${"​".repeat(nonce.current % 2)}`,
        );
      }
      lastCount.current = count;
    }

    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [t]);

  return (
    <p
      className="sr-only"
      // Deliberately NOT role="status". Now that this lives in the app shell it
      // is present on every page, and role="status" would make each page report
      // a permanent, usually-empty status region — competing with the real
      // transient ones (13 elsewhere in the app) and making a bare
      // getByRole("status") ambiguous. aria-live is what performs the
      // announcement; the role only duplicates it.
      aria-live="polite"
      aria-atomic="true"
      data-testid="notification-announcer"
    >
      {message}
    </p>
  );
}
