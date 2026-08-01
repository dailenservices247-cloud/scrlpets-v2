export const PUBLIC_DISCOVERY_PREFIXES = [
  "/",
  "/adopt",
  "/b/",
  "/c/",
  "/groups",
  "/guides",
  "/listing/",
  "/market",
  "/post/",
  "/services",
  "/shop",
  "/u/",
  "/watch/",
] as const;

export const PROTECTED_PREFIXES = [
  "/admin",
  "/applications",
  "/brand-os",
  "/brands",
  "/calendar",
  "/compose",
  "/health",
  "/messages",
  "/notifications",
  "/pack",
  "/rewards",
  "/saved",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
