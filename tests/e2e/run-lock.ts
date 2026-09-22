import { execSync } from "node:child_process";
import { constants, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
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
 *
 * The lock is the kernel's, taken by open(2) itself. The first version was a
 * mkdir lock with pid checks, and on 2026-09-21 a crowd of waiters broke it: one
 * that found the lock gone mid-check deleted the next holder's fresh lock, and
 * 2–3 runs held it at once. The kernel releases this one when the holder exits,
 * however it exits, and children don't inherit it, so there is no stale lock to
 * recover and nothing to delete.
 */
const OWNER_ENV = "SCRLPETS_E2E_LOCK_OWNER";
// macOS <fcntl.h>: open() also takes an exclusive flock on the file. Node doesn't export it.
const O_EXLOCK = 0x20;

type Owner = { pid: number; worktree: string; command: string; startedAt: string };

function sharedLockFile(): string {
  try {
    // One .git for every worktree of this repo, and nothing in it is ever committed.
    const gitDir = execSync("git rev-parse --git-common-dir", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // Not the old e2e-run.lock path: branches still on the mkdir lock rmSync it.
    return join(resolve(gitDir), "e2e-run.flock");
  } catch {
    return join(tmpdir(), "scrlpets-e2e-run.flock");
  }
}

function readOwner(lockFile: string): Owner | null {
  try {
    return JSON.parse(readFileSync(lockFile, "utf8")) as Owner;
  } catch {
    return null;
  }
}

export function holdE2eLock(
  options: { lockFile?: string; pollMs?: number; maxWaitMs?: number } = {},
): void {
  // Unit tests import playwright.config.ts; they are not a run.
  if (process.env.VITEST) return;
  // `playwright test --list` runs no tests, so it has no turn to wait for.
  // ponytail: Playwright 1.60 loads the list in this process (no workers, no
  // webServer). If list mode moves to a child loader, that child won't see
  // --list and will queue; hand the skip down through the env then.
  if (process.argv.includes("--list")) return;
  // ponytail: O_EXLOCK is macOS-only, and this Mac is the only e2e host. Elsewhere
  // runs don't take turns; a flock(1) holder process would cover Linux.
  if (process.platform !== "darwin") return;
  const { lockFile = sharedLockFile(), pollMs = 2_000, maxWaitMs = 30 * 60_000 } = options;
  const startedWaiting = Date.now();
  let lastNotice = -Infinity;

  for (;;) {
    try {
      // Never closed: this process holds the lock until it exits.
      openSync(lockFile, constants.O_RDONLY | constants.O_CREAT | constants.O_NONBLOCK | O_EXLOCK);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
      const owner = readOwner(lockFile);
      // Workers and the test loader are children of the holder and load this config too.
      if (owner && String(owner.pid) === process.env[OWNER_ENV]) return;

      const holder = owner
        ? `pid ${owner.pid} in ${owner.worktree} since ${owner.startedAt} (${owner.command})`
        : "a run that is still starting";
      const waited = Date.now() - startedWaiting;
      if (waited >= maxWaitMs) {
        throw new Error(`e2e run lock: gave up after ${Math.round(waited / 1000)}s waiting for ${holder}. Lock: ${lockFile}`);
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
    writeFileSync(lockFile, JSON.stringify(owner));
    process.env[OWNER_ENV] = String(process.pid);
    return;
  }
}
