export const PUBLIC_DISCOVERY_PREFIXES = [
  "/",
  "/adopt",
  "/b/",
  "/c/",
  "/groups",
  "/guides",
  "/listing/",
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
  "/compose",
  "/messages",
  "/notifications",
  "/rewards",
  "/saved",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
