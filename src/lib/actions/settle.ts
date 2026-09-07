/**
 * Call a server action so that a FAILURE always arrives as a returned value.
 *
 * Every form here awaits an action and then reads `result.ok`. That is correct
 * only while the call returns. It does not return when the network drops or an
 * edge layer answers before the function does — the await throws, and every
 * line after it in the submit handler is skipped: the busy flag stays set, the
 * error is never shown, the dialog never closes. The person is left with a
 * form that looks like it is still thinking, forever.
 *
 * Seen in production as a 503 on the action POST.
 *
 * `unreachable` rather than the thrown message on purpose: the message from a
 * failed fetch is a browser string ("Failed to fetch", "Load failed") that
 * differs per engine and means nothing to the person reading it. Call sites
 * already translate a failure into their own sentence.
 */
export type SettledFailure = { ok: false; error: string };

export async function settleAction<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | SettledFailure> {
  try {
    const result = await run();
    // An action that resolves to nothing is the nastier shape: without this the
    // TypeError lands inside the CALLER's handler, after the await appeared to
    // succeed, which is much harder to read in a stack trace.
    if (!result || typeof result.ok !== "boolean") return { ok: false, error: "unreachable" };
    return result;
  } catch {
    return { ok: false, error: "unreachable" };
  }
}
