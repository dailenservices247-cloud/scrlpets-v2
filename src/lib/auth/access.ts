export const PUBLIC_DISCOVERY_PREFIXES = [
  "/",
  "/b/",
  "/c/",
  "/listing/",
  "/post/",
  "/shop",
  "/u/",
  "/watch/",
] as const;

export const PROTECTED_PREFIXES = [
  "/admin",
  "/brand-os",
  "/brands",
  "/compose",
  "/messages",
  "/notifications",
  "/saved",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
