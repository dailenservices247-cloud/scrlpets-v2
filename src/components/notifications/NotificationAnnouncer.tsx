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
export function NotificationAnnouncer({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations("notifications");
  const [message, setMessage] = useState("");
  const lastCount = useRef(initialUnread);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      const count = await unreadNotificationCount();
      if (cancelled) return;
      if (count > lastCount.current) {
        setMessage(t("announceNew", { count: count - lastCount.current }));
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
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="notification-announcer"
    >
      {message}
    </p>
  );
}
