"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { turnstileSiteKey } from "@/lib/auth/captcha";

/**
 * Cloudflare Turnstile, or nothing at all.
 *
 * Renders NOTHING without a site key, which is what makes the rollout order
 * survivable: this ships first and inert, the key comes second, and the
 * Supabase dashboard toggle comes last. Reverse the last two and every sign-in
 * fails, because Supabase starts demanding a token the app is not yet sending.
 *
 * No dependency. The widget is a script tag and one global; @marsidev/react-
 * turnstile would be a package to keep current for that.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = turnstileSiteKey();
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!siteKey || !ready || !ref.current || !window.turnstile) return;
    window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: (token: string) => onToken(token),
      // A token that expired while the user was typing is worse than no token:
      // it fails at submit with a message about credentials. Clear it instead.
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
  }, [siteKey, ready, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onLoad={() => setReady(true)}
        strategy="afterInteractive"
      />
      <div ref={ref} id={id} data-testid="turnstile-widget" />
    </>
  );
}
