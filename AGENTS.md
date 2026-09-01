<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

After any UI-touching change, before reporting the task complete, run self-verification:
- For web routes, navigate through the affected happy path and inspect console/network failures.
- For mobile screens, verify the corresponding mobile runtime.
- Fix unexpected state or errors before marking the work complete.

## Ship verification (every release)

Every ship runs `./ship-verify.sh` (types → lint → unit → e2e → prod build) and,
after deploying, `./ship-verify.sh --prod` (live CSP header, sitemap /u/-leak and
fixture-leak guards, feed render). Paste its SUMMARY block into the session log as
the verification evidence. Do not report a ship complete without it.

## TDD checkpoint commits — evidence rules

Re-homed here 2026-08-18 from the `tdd-workflow` skill, which was archived that day. The replacement
(`superpowers:test-driven-development`) carries the RED-GREEN-REFACTOR discipline but has no equivalent
of these evidence rules, and they read like they were written after something got faked.

When a change goes through test-first, leave a commit trail that proves the order:

- One commit for **failing test added and RED validated**.
- One commit for **minimal fix applied and GREEN validated**.
- One optional commit for **refactor complete**.

Separate evidence-only commits are not required if the test commit clearly corresponds to RED and the
fix commit clearly corresponds to GREEN. Do not squash or rewrite these until the workflow completes.
Each message states the stage and the exact evidence captured.

**The anti-gaming part, which is the reason this survived:**

- **Count only commits created on the current active branch, for the current task.**
- **Do not treat commits from other branches, earlier unrelated work, or distant branch history as
  valid checkpoint evidence.**
- **Before treating a checkpoint as satisfied, verify the commit is reachable from the current `HEAD`
  on the active branch and belongs to this task's sequence.**

A checkpoint you cannot reach from `HEAD` is not evidence of anything. Pointing at an old commit on
another branch and calling the gate satisfied is the failure these rules exist to stop.

## Scrlpets legacy-intent gate

Before recommending, planning, or implementing a Scrlpets feature:

- Read the canonical private Scrlpets handoff and legacy-parity ledger identified by the global workspace instructions.
- Inspect the relevant current v2 code and the matching legacy Scrlpets surface. The legacy repo is read-only.
- Compare both with the latest founder direction and approved private product canon.
- In the Safety Net or PRD, classify each material difference as Keep, Rebuild safely, Bank with a named unblock, Reject with explicit approval, or Add.
- Do not silently omit useful legacy intent, and do not blindly copy unsafe or obsolete legacy mechanics.
- After verification, update the private parity ledger and cross-session handoff.

If the legacy source or private ledger is unavailable, stop before implementation and report the missing audit input.
