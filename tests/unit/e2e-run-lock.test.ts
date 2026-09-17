import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { holdE2eLock } from "../e2e/run-lock";

/**
 * 2026-09-16: brand-rbac.spec.ts failed under a 3-worker run while other
 * worktrees built and ran their own suites on the same 8-core Mac and the same
 * Supabase dev database. Load average reached ~99 and every layer slowed
 * 10–20×. On a quiet machine the same 15 specs passed 30/30 with 5–10× margins.
 * The fix is to make Playwright runs from different worktrees take turns.
 *
 * Each child below stands in for a Playwright runner process: it takes the
 * lock the way playwright.config.ts does, reports when, holds it, and exits.
 */
const LOCK_MODULE = resolve(__dirname, "../e2e/run-lock.ts");

const RUNNER = `
import { spawnSync } from "node:child_process";
import { holdE2eLock } from ${JSON.stringify(LOCK_MODULE)};
holdE2eLock({ lockDir: process.env.LOCK_DIR, pollMs: 25, maxWaitMs: Number(process.env.MAX_WAIT_MS ?? 5000) });
console.log("acquired " + Date.now());
if (process.env.SPAWN_OWN_CHILD) {
  // A Playwright worker: a child of the holder that loads the same config.
  const worker = spawnSync(process.execPath, ["--input-type=module", "-e",
    "import { holdE2eLock } from " + JSON.stringify(${JSON.stringify(LOCK_MODULE)}) + ";" +
    "holdE2eLock({ lockDir: process.env.LOCK_DIR, pollMs: 25, maxWaitMs: 300 });"]);
  console.log("worker-exit " + worker.status);
}
setTimeout(() => { console.log("releasing " + Date.now()); process.exit(0); }, Number(process.env.HOLD_MS ?? 0));
`;

const children: ReturnType<typeof spawn>[] = [];
const tempDirs: string[] = [];

function freshLockDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "e2e-run-lock-"));
  tempDirs.push(dir);
  return join(dir, "e2e-run.lock");
}

function startRunner(lockDir: string, extraEnv: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, LOCK_DIR: lockDir };
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITEST") || key === "SCRLPETS_E2E_LOCK_OWNER") delete env[key];
  }
  const child = spawn(process.execPath, ["--input-type=module", "-e", RUNNER], {
    env: { ...env, ...extraEnv },
  });
  children.push(child);
  const lines: string[] = [];
  let stderr = "";
  child.stdout.on("data", (chunk) => lines.push(...String(chunk).trim().split("\n")));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const exited = new Promise<number | null>((done) => child.on("exit", (code) => done(code)));
  async function line(prefix: string): Promise<string> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const found = lines.find((l) => l.startsWith(prefix));
      if (found) return found;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no "${prefix}" line; stdout=${lines.join("|")} stderr=${stderr}`);
  }
  return { child, exited, line, stderr: () => stderr };
}

const at = (line: string) => Number(line.split(" ")[1]);

describe("e2e run lock", () => {
  afterEach(() => {
    for (const child of children.splice(0)) child.kill("SIGKILL");
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("makes a second run wait until the first one exits", async () => {
    const lockDir = freshLockDir();
    const first = startRunner(lockDir, { HOLD_MS: "600" });
    await first.line("acquired");
    const second = startRunner(lockDir);

    const firstReleased = at(await first.line("releasing"));
    const secondAcquired = at(await second.line("acquired"));

    expect(secondAcquired).toBeGreaterThanOrEqual(firstReleased);
    expect(await second.exited).toBe(0);
  });

  it("does not let a killed run block the next one", async () => {
    const lockDir = freshLockDir();
    const first = startRunner(lockDir, { HOLD_MS: "60000" });
    await first.line("acquired");
    first.child.kill("SIGKILL");
    await first.exited;

    const second = startRunner(lockDir, { MAX_WAIT_MS: "3000" });

    await second.line("acquired");
    expect(await second.exited).toBe(0);
  });

  it("lets the holder's own worker processes through without waiting", async () => {
    const holder = startRunner(freshLockDir(), { SPAWN_OWN_CHILD: "1" });

    expect(await holder.line("worker-exit")).toBe("worker-exit 0");
  });

  it("does not wave a run through because of an owner id that is not the live holder", async () => {
    const lockDir = freshLockDir();
    const first = startRunner(lockDir, { HOLD_MS: "60000" });
    await first.line("acquired");

    // pid 1 is alive (launchd/init) but is not the process holding the lock.
    const second = startRunner(lockDir, { MAX_WAIT_MS: "300", SCRLPETS_E2E_LOCK_OWNER: "1" });

    expect(await second.exited).not.toBe(0);
  });

  it("fails a run that waits past its deadline, naming the holder", async () => {
    const lockDir = freshLockDir();
    const first = startRunner(lockDir, { HOLD_MS: "60000" });
    await first.line("acquired");

    const second = startRunner(lockDir, { MAX_WAIT_MS: "300" });

    expect(await second.exited).not.toBe(0);
    expect(second.stderr()).toContain(`pid ${first.child.pid}`);
  });

  it("never takes the lock when vitest imports the Playwright config", () => {
    const lockDir = freshLockDir();

    holdE2eLock({ lockDir });

    expect(existsSync(lockDir)).toBe(false);
  });
});
