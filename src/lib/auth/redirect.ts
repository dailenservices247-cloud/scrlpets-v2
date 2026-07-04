const FALLBACK_PATH = "/";

/** Accept only same-origin path/query values, never absolute or protocol-relative URLs. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const base = new URL("https://scrlpets.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin || resolved.pathname.startsWith("//")) {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return fallback;
  }
}
