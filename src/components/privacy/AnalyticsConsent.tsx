"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { disableAnalytics, enableAnalytics } from "@/lib/analytics";

const CONSENT_KEY = "scrlpets_analytics_consent";

export function AnalyticsConsent() {
  const t = useTranslations("consent");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const timer = window.setTimeout(() => {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent === "accepted") {
        enableAnalytics();
      } else if (!consent) {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function choose(value: "accepted" | "declined") {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === "accepted") enableAnalytics();
    else disableAnalytics();
    setVisible(false);
  }

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-border bg-background/98 p-4 shadow-2xl backdrop-blur"
      aria-label={t("label")}
      data-testid="analytics-consent"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        {t.rich("body", {
          privacy: (chunks) => (
            <Link href="/privacy" className="text-brand-link underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-11 rounded-xl border border-input px-4 text-sm font-semibold"
          onClick={() => choose("declined")}
        >
          {t("decline")}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          onClick={() => choose("accepted")}
        >
          {t("accept")}
        </button>
      </div>
    </aside>
  );
}
