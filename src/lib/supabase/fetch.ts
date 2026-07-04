const REQUEST_TIMEOUT_MS = 10_000;

/** Prevent a stalled auth/data request from hanging the entire app shell. */
export const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(new Error("request_timeout")),
    REQUEST_TIMEOUT_MS,
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
