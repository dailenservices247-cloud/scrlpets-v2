import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Playwright runs from different worktrees take turns.
 *
 * 2026-09-16: brand-rbac.spec.ts failed while other worktrees built and ran their
 * own suites on the same 8-core Mac and Supabase dev database. Load average hit
 * ~99 and every layer slowed 10–20×. On a quiet machine the same specs passed
 * 30/30 with 5–10× margins.
 *
 * playwright.config.ts calls this first, and every run loads that file:
 * ship-verify, a bare `npx playwright test`, and scratch configs that import it.
 * It has to block synchronously. Playwright does not await a config export, and
 * webServer starts the two-minute build BEFORE globalSetup, so a lock taken any
 * later would let builds overlap.
 */
const OWNER_ENV = "SCRLPETS_E2E_LOCK_OWNER";

type Owner = { pid: number; worktree: string; command: string; startedAt: string };

function sharedLockDir(): string {
  try {
    // One .git for every worktree of this repo, and nothing in it is ever committed.
    const gitDir = execSync("git rev-parse --git-common-dir", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return join(resolve(gitDir), "e2e-run.lock");
  } catch {
    return join(tmpdir(), "scrlpets-e2e-run.lock");
  }
}

function readOwner(lockDir: string): Owner | null {
  try {
    return JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8")) as Owner;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function heldByLiveRun(lockDir: string, owner: Owner | null): boolean {
  // ponytail: a reused pid can pass for a dead holder; the queue deadline names it.
  if (owner) return isAlive(owner.pid);
  try {
    // mkdir happened but owner.json isn't written yet: a run that is starting.
    return Date.now() - statSync(lockDir).mtimeMs < 10_000;
  } catch {
    return false;
  }
}

export function holdE2eLock(
  options: { lockDir?: string; pollMs?: number; maxWaitMs?: number } = {},
): void {
  // Unit tests import playwright.config.ts; they are not a run.
  if (process.env.VITEST) return;
  const { lockDir = sharedLockDir(), pollMs = 2_000, maxWaitMs = 30 * 60_000 } = options;
  const startedWaiting = Date.now();
  let lastNotice = -Infinity;

  for (;;) {
    try {
      mkdirSync(lockDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = readOwner(lockDir);
      if (!heldByLiveRun(lockDir, owner)) {
        // ponytail: two waiters that both find a crashed holder can race here; only
        // reachable right after a crash, and the loser simply waits one more turn.
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      // Workers and the test loader are children of the holder and load this config too.
      if (owner && String(owner.pid) === process.env[OWNER_ENV]) return;

      const holder = owner
        ? `pid ${owner.pid} in ${owner.worktree} since ${owner.startedAt} (${owner.command})`
        : "a run that is still starting";
      const waited = Date.now() - startedWaiting;
      if (waited >= maxWaitMs) {
        throw new Error(`e2e run lock: gave up after ${Math.round(waited / 1000)}s waiting for ${holder}. Lock: ${lockDir}`);
      }
      if (waited - lastNotice >= 60_000) {
        // writeSync: stderr to a pipe is async on macOS, and the wait below blocks the loop.
        writeSync(2, `e2e run lock: waiting for ${holder} — runs from other worktrees take turns\n`);
        lastNotice = waited;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollMs);
      continue;
    }

    const owner: Owner = {
      pid: process.pid,
      worktree: process.cwd(),
      command: process.argv.slice(1).join(" "),
      startedAt: new Date().toISOString(),
    };
    writeFileSync(join(lockDir, "owner.json"), JSON.stringify(owner));
    process.env[OWNER_ENV] = String(process.pid);
    process.on("exit", () => {
      if (readOwner(lockDir)?.pid === process.pid) rmSync(lockDir, { recursive: true, force: true });
    });
    return;
  }
}
