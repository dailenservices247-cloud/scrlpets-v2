import { describe, expect, it } from "vitest";
import config from "../../playwright.config";

/**
 * 2026-09-16: a sibling worktree's `next-server` took :3000 during this run's
 * two-minute build. Our `next start` died with EADDRINUSE, and Playwright ran
 * the suite against the other worktree's build anyway — 8 plausible-looking
 * product failures, not one of which pointed at the port.
 *
 * Playwright (1.60, WebServerPlugin._waitForProcess) declares the server ready
 * on whichever settles FIRST: the `url`/`port` probe, the `wait` output match,
 * or the process exiting. A probe is satisfied by anything answering on the
 * port, so while one is configured a foreign server wins that race, and our
 * own server dying afterwards is silently ignored. Only output our process
 * alone prints can prove it is the one listening.
 */
describe("playwright webServer readiness", () => {
  const webServer = [config.webServer].flat()[0];

  it("never probes the port, because a foreign server answering there satisfies the probe", () => {
    expect(webServer?.url).toBeUndefined();
    expect(webServer?.port).toBeUndefined();
  });

  it("waits for our own next start to report it is listening", () => {
    // next start logs this inside its own server.on("listening"); on EADDRINUSE
    // it exits 1 instead. Playwright sets FORCE_COLOR=1, which wraps the check
    // mark in ANSI codes, so the pattern cannot anchor on the mark.
    const ready = "[32m[1m✓[22m[39m Ready in 1.2s";
    expect(webServer?.wait?.stdout?.test(ready)).toBe(true);
    // next build reports its own steps as "✓ … in 45s" earlier in the same stream.
    expect(webServer?.wait?.stdout?.test(" ✓ Compiled successfully in 45s")).toBe(false);
  });
});
