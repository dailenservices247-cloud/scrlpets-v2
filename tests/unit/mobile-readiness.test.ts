import { describe, it, expect } from "vitest";
import capacitorConfig from "../../capacitor.config";
import packageJson from "../../package.json";

describe("Mobile Shell Capacitor Readiness", () => {
  it("has valid Capacitor application and production host configuration", () => {
    expect(capacitorConfig.appId).toBe("com.scrlpets.app");
    expect(capacitorConfig.appName).toBe("Scrlpets");
    expect(capacitorConfig.server?.url).toBe("https://scrlpets.com");
    expect(capacitorConfig.server?.cleartext).toBe(false);
  });

  it("authorizes required navigation domains in allowNavigation", () => {
    const allowNav = capacitorConfig.server?.allowNavigation ?? [];
    expect(allowNav).toContain("scrlpets.com");
    expect(allowNav).toContain("*.scrlpets.com");
    expect(allowNav).toContain("*.supabase.co");
    expect(allowNav).toContain("connect.stripe.com");
  });

  it("has mobile build and sync scripts in package.json", () => {
    const scripts = packageJson.scripts as Record<string, string>;
    expect(scripts["cap:sync"]).toBe("cap sync");
    expect(scripts["cap:build:android"]).toContain("cap sync android");
    expect(scripts["cap:build:ios"]).toContain("cap sync ios");
  });
});
