import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Without a media-src, <video> falls back to default-src 'self': every
 * Supabase-hosted video is refused before a request is even sent (the reel
 * realm renders solid black), and so is the composer's blob: preview.
 *
 * The header only exists in production builds, so `next dev` never shows the
 * block. These read the value the production config actually serves, through
 * its own headers() — no browser, no build.
 */

async function productionCsp() {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  const { default: config } = await import("../../next.config");
  const csp = (await config.headers!())
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  expect(csp, "production Content-Security-Policy header").toContain("default-src 'self'");
  return csp!;
}

function sources(csp: string, directive: string) {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${directive} `));
  return new Set(found?.split(" ").slice(1));
}

describe("production CSP media-src", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets <video> load the project's Supabase storage and the composer's blob: preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    const csp = await productionCsp();
    // Exact set: a bare https: or * here would let any host's media through.
    expect(sources(csp, "media-src")).toEqual(
      new Set(["'self'", "blob:", "https://abcdefghijklmnopqrst.supabase.co"]),
    );
  });

  it("falls back to the Supabase wildcard when the project URL is missing at build", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const csp = await productionCsp();
    expect(sources(csp, "media-src")).toEqual(new Set(["'self'", "blob:", "https://*.supabase.co"]));
  });
});
