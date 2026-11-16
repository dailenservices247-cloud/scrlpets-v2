#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function runStep(label, command, args, { allowFail = false } = {}) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  const code = result.status ?? 1;
  if (code !== 0 && !allowFail) {
    console.error(`\nStep failed: ${label} (exit ${code})`);
    process.exit(code);
  }
  return code;
}

runStep("Brand House static token & button guards (Vitest)", "npx", [
  "vitest",
  "run",
  "tests/unit/brand-house-buttons.test.ts",
  "tests/unit/type-scale.test.ts",
]);

const crawlCode = runStep(
  "Autonomous QA & Brand House crawler (Playwright)",
  "npx",
  ["playwright", "test", "tests/e2e/autonomous-qa-audit.spec.ts"],
  { allowFail: true },
);

const jsonPath = path.join(root, "test-results", "qa-audit-report.json");
const mdPath = path.join(root, "test-results", "qa-audit-report.md");

if (!existsSync(jsonPath)) {
  console.error(`Expected report not found at ${jsonPath}`);
  process.exit(crawlCode || 1);
}

const report = JSON.parse(readFileSync(jsonPath, "utf8"));
console.log("\n==> Autonomous QA & Brand House Audit Summary");
console.log(`Routes audited: ${report.routes.length}`);
console.log(`Interactive checks: ${report.interactions.length}`);
console.log(`Page errors: ${report.pageErrors.length}`);
console.log(`First-party/Supabase 5xx: ${report.failed5xx.length}`);
console.log(`Third-party warnings: ${(report.thirdPartyWarnings ?? []).length}`);
console.log(`Findings: ${(report.findings ?? []).length}`);

for (const r of report.routes) {
  const overflow =
    r.desktopOverflowPx === null ? "-" : `${r.desktopOverflowPx}px/${r.mobileOverflowPx}px`;
  const a11y = r.a11ySeriousCount === null ? "-" : String(r.a11ySeriousCount);
  console.log(
    `  ${r.route.padEnd(18)} | ${r.authMode.padEnd(9)} | ${r.status} | ${String(r.loadMs).padStart(5)}ms | overflow=${overflow.padEnd(9)} | a11y=${a11y}`,
  );
}

if (Array.isArray(report.findings) && report.findings.length > 0) {
  console.log("\nFindings:");
  for (const f of report.findings) {
    console.log(`  - ${f}`);
  }
}

console.log(`\nMarkdown report: ${mdPath}`);
console.log(`JSON report:     ${jsonPath}\n`);

if (crawlCode !== 0) {
  process.exit(crawlCode);
}
