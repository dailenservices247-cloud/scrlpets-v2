/* Scrlpets wordmark — "double-scroll S" v2 (Brand House v1.2, locked 2026-06-11).
   Both ends of the S curl inward in opposite directions: the cross-section of a
   parchment scroll, which happens to BE an S. Matches the Gemini-rendered mark
   (public/brand/scrlpets-mark-full.png). S = inline SVG; letterforms = real text. */

export function ScrollS({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 64"
      width={(size * 48) / 64}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 40 16 C 40 8, 30 3, 20 6 C 11 9, 8 17, 14 23 C 20 29, 32 30, 36 38 C 40 47, 33 56, 22 56 C 13 56, 8 50, 8 44"
        fill="none"
        stroke="#c8a23e"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path
        d="M 40 16 C 40 21, 34 22, 32 18 C 30.5 14.8, 34 11.5, 37 13.5"
        fill="none"
        stroke="#d8b85a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 8 44 C 8 39, 14 38, 16 42 C 17.5 45.2, 14 48.5, 11 46.5"
        fill="none"
        stroke="#d8b85a"
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
        <ScrollS size={size * 1.3} />
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
