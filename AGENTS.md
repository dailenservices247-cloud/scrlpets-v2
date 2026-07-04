<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

After any UI-touching change, before reporting the task complete, run self-verification:
- For web routes, navigate through the affected happy path and inspect console/network failures.
- For mobile screens, verify the corresponding mobile runtime.
- Fix unexpected state or errors before marking the work complete.
