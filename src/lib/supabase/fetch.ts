const REQUEST_TIMEOUT_MS = 10_000;
// Media uploads on slow uplinks legitimately exceed 10s; bound them at 60s.
const STORAGE_TIMEOUT_MS = 60_000;

function timeoutFor(input: Parameters<typeof fetch>[0]): number {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/storage/v1/") ? STORAGE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

/** Prevent a stalled auth/data request from hanging the entire app shell. */
export const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(new Error("request_timeout")),
    timeoutFor(input),
  );
  const sourceSignal = init.signal;
  const abortFromSource = () => controller.abort(sourceSignal?.reason);
  sourceSignal?.addEventListener("abort", abortFromSource, { once: true });

  try {
    return await globalThis.fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    sourceSignal?.removeEventListener("abort", abortFromSource);
  }
};
