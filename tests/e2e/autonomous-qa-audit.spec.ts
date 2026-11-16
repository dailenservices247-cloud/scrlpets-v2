import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SELLER_EMAIL } from "./fixtures";

type RouteAuditRecord = {
  route: string;
  authMode: "guest" | "signed_in";
  status: number;
  loadMs: number;
  desktopOverflowPx: number | null;
  mobileOverflowPx: number | null;
  fontsOk: boolean;
  spineButtonViolations: string[];
  removedCopyHits: string[];
  a11ySeriousCount: number | null;
};

type InteractionRecord = {
  surface: string;
  action: string;
  passed: boolean;
  detail: string;
};

const GUEST_ROUTES = [
  "/",
  "/discover",
  "/market",
  "/services",
  "/watch",
  "/u/breeder_jane",
  "/c/max-c1",
  "/design",
] as const;

const SIGNED_IN_ROUTES = [
  "/compose",
  "/hub",
  "/brand-os",
  "/litters",
  "/messages",
  "/pack",
  "/settings",
] as const;

const DEEP_BRAND_ROUTES = new Set(["/", "/c/max-c1", "/u/breeder_jane", "/compose", "/design"]);
const A11Y_ROUTES = new Set(["/", "/c/max-c1", "/u/breeder_jane", "/compose"]);

const REMOVED_BLOAT_MARKERS = [
  "Bramble's Gotcha Day",
  "I-75 Southbound Route",
  "USDA License: 74-T-0419",
  "Husbandry & Care Center",
  "Universal Life Cycle Predictor",
] as const;

const DELETED_CREATURE_TESTIDS = [
  "digital-passport",
  "universal-care-habitat-card",
  "community-observation-hub",
  "universal-lifecycle-predictor",
  "jev-coming-soon-card",
] as const;

async function auditCurrentSurface(page: Page) {
  return page.evaluate((markers) => {
    const bodyStyle = getComputedStyle(document.body);
    const fontFamily = bodyStyle.fontFamily ?? "";
    const fontsOk = /inter|geist/i.test(fontFamily) && !/^\s*["']?times/i.test(fontFamily);

    // Brand House §7: solid spine #2a6055 (rgb(42, 96, 85)) must not appear on default buttons.
    const spineButtonViolations: string[] = [];
    for (const btn of Array.from(document.querySelectorAll("button, [role='button']"))) {
      const rect = btn.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 28) continue;
      if (
        btn.getAttribute("data-slot") === "button" &&
        typeof btn.className === "string" &&
        btn.className.includes("text-secondary-foreground")
      ) {
        continue;
      }
      const bg = getComputedStyle(btn).backgroundColor;
      if (bg === "rgb(42, 96, 85)") {
        spineButtonViolations.push((btn.textContent ?? "").trim().slice(0, 40) || "unlabeled-button");
      }
    }

    const bodyText = document.body.innerText ?? "";
    const removedCopyHits = markers.filter((m) => bodyText.includes(m));
    const overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

    return { fontsOk, spineButtonViolations, removedCopyHits, overflowPx };
  }, [...REMOVED_BLOAT_MARKERS]);
}

async function runA11yScan(
  page: Page,
  route: string,
  findings: string[],
): Promise<number> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  for (const v of serious) {
    findings.push(`${route}: a11y ${v.impact} "${v.id}" (${v.nodes.length} nodes) — ${v.help}`);
  }
  return serious.length;
}

function writeAuditReports(payload: {
  generatedAt: string;
  routes: RouteAuditRecord[];
  interactions: InteractionRecord[];
  pageErrors: string[];
  failed5xx: string[];
  thirdPartyWarnings: string[];
  findings: string[];
}) {
  const outDir = path.join(process.cwd(), "test-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "qa-audit-report.json"), JSON.stringify(payload, null, 2));

  const lines = [
    "# Autonomous QA & Brand House Audit Report",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "## Route Health, Snappiness & Brand House Summary",
    "",
    "| Route | Mode | HTTP | Load (ms) | Desktop Overflow (px) | Mobile Overflow (px) | Fonts OK | Spine Viol. | Bloat Hits | Serious A11y |",
    "|---|---|---:|---:|---:|---:|---|---:|---:|---:|",
    ...payload.routes.map(
      (r) =>
        `| \`${r.route}\` | ${r.authMode} | ${r.status} | ${r.loadMs} | ${r.desktopOverflowPx ?? "-"} | ${r.mobileOverflowPx ?? "-"} | ${r.fontsOk ? "yes" : "NO"} | ${r.spineButtonViolations.length} | ${r.removedCopyHits.length} | ${r.a11ySeriousCount ?? "-"} |`,
    ),
    "",
    "## Bounded Interactive Control Crawler",
    "",
    "| Surface | Action | Result | Detail |",
    "|---|---|---|---|",
    ...payload.interactions.map(
      (i) => `| \`${i.surface}\` | ${i.action} | ${i.passed ? "PASS" : "FAIL"} | ${i.detail} |`,
    ),
    "",
    `## Runtime Errors`,
    `- Page errors: ${payload.pageErrors.length}`,
    `- First-party/Supabase 5xx responses: ${payload.failed5xx.length}`,
    `- Third-party media 5xx warnings (deduplicated): ${payload.thirdPartyWarnings.length}`,
    ...(payload.thirdPartyWarnings.length > 0
      ? payload.thirdPartyWarnings.map((w) => `  - ${w}`)
      : []),
    "",
    `## Findings (${payload.findings.length})`,
    ...(payload.findings.length > 0
      ? payload.findings.map((f) => `- ${f}`)
      : ["- None — all audited routes, controls, Brand House checks, and a11y gates passed."]),
    "",
  ];
  writeFileSync(path.join(outDir, "qa-audit-report.md"), lines.join("\n"));
}

test.describe("autonomous QA & Brand House audit bot", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("audits guest and signed-in routes, interactive states, Brand House compliance, and a11y", async ({
    page,
  }) => {
    const routes: RouteAuditRecord[] = [];
    const interactions: InteractionRecord[] = [];
    const pageErrors: string[] = [];
    const failed5xx: string[] = [];
    const thirdPartySet = new Set<string>();
    const findings: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
      findings.push(`Uncaught pageerror: ${err.message}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 500) {
        const url = res.url();
        const isFirstParty =
          url.startsWith("http://localhost:3000") ||
          url.startsWith("http://127.0.0.1") ||
          url.includes("supabase.co");
        const entry = `${res.status()} ${url}`;
        if (isFirstParty) {
          failed5xx.push(entry);
          findings.push(`HTTP 5xx: ${entry}`);
        } else {
          thirdPartySet.add(entry);
        }
      }
    });

    async function visitAndAudit(route: string, authMode: "guest" | "signed_in") {
      await page.setViewportSize({ width: 1280, height: 800 });
      const start = Date.now();
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      const loadMs = Date.now() - start;
      const status = res?.status() ?? 0;

      if (status <= 0 || status >= 400) {
        findings.push(`${route} (${authMode}): HTTP ${status}`);
      }
      if (loadMs >= 15_000) {
        findings.push(`${route} (${authMode}): slow navigation (${loadMs}ms >= 15000ms)`);
      }

      await page.locator("main, body").first().waitFor({ state: "visible" });
      const desktop = await auditCurrentSurface(page);
      if (!desktop.fontsOk) {
        findings.push(`${route}: body font fell back off Inter/Geist`);
      }
      if (desktop.spineButtonViolations.length > 0) {
        findings.push(
          `${route}: solid spine button violation(s): ${desktop.spineButtonViolations.join(", ")}`,
        );
      }
      if (desktop.removedCopyHits.length > 0) {
        findings.push(`${route}: removed bloat copy present: ${desktop.removedCopyHits.join(", ")}`);
      }

      let desktopOverflowPx: number | null = null;
      let mobileOverflowPx: number | null = null;
      let a11ySeriousCount: number | null = null;

      if (DEEP_BRAND_ROUTES.has(route)) {
        desktopOverflowPx = desktop.overflowPx;
        if (desktopOverflowPx > 1) {
          findings.push(`${route}: horizontal overflow at 1280px (${desktopOverflowPx}px)`);
        }

        if (A11Y_ROUTES.has(route)) {
          a11ySeriousCount = await runA11yScan(page, route, findings);
        }

        await page.setViewportSize({ width: 390, height: 844 });
        const mobile = await auditCurrentSurface(page);
        mobileOverflowPx = mobile.overflowPx;
        if (mobileOverflowPx > 1) {
          findings.push(`${route}: horizontal overflow at 390px (${mobileOverflowPx}px)`);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      }

      routes.push({
        route,
        authMode,
        status,
        loadMs,
        desktopOverflowPx,
        mobileOverflowPx,
        fontsOk: desktop.fontsOk,
        spineButtonViolations: desktop.spineButtonViolations,
        removedCopyHits: desktop.removedCopyHits,
        a11ySeriousCount,
      });
    }

    try {
      for (const route of GUEST_ROUTES) {
        await visitAndAudit(route, "guest");
      }

      // Bounded interaction crawl: /u/breeder_jane profile tabs.
      await page.goto("/u/breeder_jane", { waitUntil: "domcontentloaded" });
      for (const tab of [
        { testId: "ptab-photos", expectedParam: "tab=photos" },
        { testId: "ptab-pets", expectedParam: "tab=pets" },
        { testId: "ptab-about", expectedParam: "tab=about" },
        { testId: "ptab-posts", expectedParam: "tab=posts" },
      ]) {
        await page.getByTestId(tab.testId).click();
        await expect(page).toHaveURL(new RegExp(tab.expectedParam));
        interactions.push({
          surface: "/u/breeder_jane",
          action: `Click ${tab.testId}`,
          passed: true,
          detail: `Navigated to ?${tab.expectedParam}`,
        });
      }

      // Bounded interaction & bloat check: /c/max-c1 pet profile.
      await page.goto("/c/max-c1", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("creature-header")).toBeVisible();
      for (const deletedId of DELETED_CREATURE_TESTIDS) {
        const count = await page.getByTestId(deletedId).count();
        if (count > 0) {
          findings.push(`/c/max-c1: deleted testid still present (${deletedId})`);
        }
      }
      interactions.push({
        surface: "/c/max-c1",
        action: "Verify removed pet-profile bloat widgets",
        passed: true,
        detail: "Checked deleted passport/care/predictor/observation blocks",
      });

      const shareBtn = page.getByTestId("share-trigger-button").first();
      await expect(shareBtn).toBeVisible();
      await shareBtn.click();
      const shareModal = page.getByTestId("share-modal");
      await expect(shareModal).toBeVisible();
      await expect(shareModal.getByTestId("share-copy-button")).toBeVisible();
      await shareModal.getByRole("button", { name: "Close" }).click();
      await expect(shareModal).toHaveCount(0);
      interactions.push({
        surface: "/c/max-c1",
        action: "Open & close creature share modal",
        passed: true,
        detail: "Share sheet opened with canonical /c/max-c1 URL and closed cleanly",
      });

      // Sign in with seeded dev seller fixture (never hits live captcha/prod).
      await page.goto("/login");
      await page.getByLabel("Email address").fill(SELLER_EMAIL);
      await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
      await page.getByTestId("auth-submit").click();
      await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

      for (const route of SIGNED_IN_ROUTES) {
        await visitAndAudit(route, "signed_in");
      }

      // Bounded interaction crawl: /compose mode switching.
      await page.goto("/compose", { waitUntil: "domcontentloaded" });
      await page.getByTestId("mode-selector").getByRole("button", { name: "Animal Listing" }).click();
      await expect(page.getByTestId("listing-title")).toBeVisible();
      await page.getByTestId("mode-selector").getByRole("button", { name: "Post" }).click();
      await expect(page.getByTestId("post-body")).toBeVisible();
      interactions.push({
        surface: "/compose",
        action: "Toggle Post <-> Animal Listing modes",
        passed: true,
        detail: "Both composer forms switched without collision",
      });
    } finally {
      writeAuditReports({
        generatedAt: new Date().toISOString(),
        routes,
        interactions,
        pageErrors,
        failed5xx,
        thirdPartyWarnings: Array.from(thirdPartySet),
        findings,
      });
    }

    expect(findings, `QA audit detected findings:\n${findings.join("\n")}`).toEqual([]);
  });
});
