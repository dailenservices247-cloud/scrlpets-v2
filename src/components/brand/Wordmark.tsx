/* Scrlpets wordmark — "scroll-tail S" (Brand House v1.1, locked 2026-06-11).
   The S terminates in a curl that reads as both a scroll and a tail.
   S = inline SVG (scales crisp); letterforms = real text (Geist, i18n-safe). */

export function ScrollS({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 44 60"
      width={(size * 44) / 60}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 36 12 C 32 5, 19 3, 12 9 C 5 15, 8 23, 16 26 C 25 29, 35 31, 37 40 C 39 50, 29 57, 19 55 C 12.5 53.6, 8.5 48.5, 9.5 43.5"
        fill="none"
        stroke="#7e303a"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M 9.5 43.5 C 10.5 39.5, 16 39.5, 16.5 43.5 C 16.9 46.7, 13 48.2, 11.2 46"
        fill="none"
        stroke="#a0414e"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-baseline" data-testid="wordmark">
      <span className="self-center">
        <ScrollS size={size * 1.25} />
      </span>
      <span
        className="font-semibold tracking-tight text-foreground"
        style={{ fontSize: size, marginLeft: size * 0.08 }}
      >
        crlpets
      </span>
      <span className="sr-only">Scrlpets</span>
    </span>
  );
}
