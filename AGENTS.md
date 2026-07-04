<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

After any UI-touching change, before reporting the task complete, run self-verification:
- For web routes, navigate through the affected happy path and inspect console/network failures.
- For mobile screens, verify the corresponding mobile runtime.
- Fix unexpected state or errors before marking the work complete.

## Scrlpets legacy-intent gate

Before recommending, planning, or implementing a Scrlpets feature:

- Read the canonical private Scrlpets handoff and legacy-parity ledger identified by the global workspace instructions.
- Inspect the relevant current v2 code and the matching legacy Scrlpets surface. The legacy repo is read-only.
- Compare both with the latest founder direction and approved private product canon.
- In the Safety Net or PRD, classify each material difference as Keep, Rebuild safely, Bank with a named unblock, Reject with explicit approval, or Add.
- Do not silently omit useful legacy intent, and do not blindly copy unsafe or obsolete legacy mechanics.
- After verification, update the private parity ledger and cross-session handoff.

If the legacy source or private ledger is unavailable, stop before implementation and report the missing audit input.
