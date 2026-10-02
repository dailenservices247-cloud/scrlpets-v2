/**
 * Browsers report a CSP violation in two shapes and we have to read both:
 * `report-uri` POSTs `application/csp-report` with hyphenated keys, the
 * Reporting API POSTs `application/reports+json` with camelCase ones. Firefox
 * and Safari only speak the first, Chrome prefers the second.
 *
 * Everything here is pure so the endpoint stays a thin wrapper, per the house
 * pattern in `app/api/cron/tick/route.ts`.
 */
export type CspViolation = {
  directive: string;
  blockedUrl: string;
  documentPath: string;
  disposition: string;
};

/** Bigger than any real report; past this the body is not worth parsing. */
export const MAX_REPORT_BYTES = 16_384;

/** One wrong directive can report once per page view. Cap what reaches the log. */
export const MAX_LOGGED_PER_INSTANCE = 50;

// Extensions inject into every page and generate the overwhelming majority of
// real-world reports. Keeping them makes the channel useless.
const NOISE_SCHEMES = [
  "chrome-extension:",
  "moz-extension:",
  "safari-extension:",
  "safari-web-extension:",
  "about:",
];

/**
 * Origin for absolute URLs, path for same-document ones, and never a query
 * string: a report carries the URL the member was on, which on this site can
 * be `/u/<username>` or a link with a token in it.
 */
function redactUrl(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  // CSP sends bare keywords for inline/eval violations — they are not URLs.
  if (!value.includes(":")) return value.slice(0, 32);
  try {
    return new URL(value).origin;
  } catch {
    return value.split("?")[0].slice(0, 64);
  }
}

function pathOf(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function isNoise(blocked: unknown): boolean {
  return typeof blocked === "string" && NOISE_SCHEMES.some((scheme) => blocked.startsWith(scheme));
}

function normalise(
  directive: unknown,
  blocked: unknown,
  document: unknown,
  disposition: unknown,
): CspViolation | null {
  if (typeof directive !== "string" || directive === "") return null;
  if (isNoise(blocked)) return null;
  return {
    directive,
    blockedUrl: redactUrl(blocked),
    documentPath: pathOf(document),
    disposition: typeof disposition === "string" && disposition !== "" ? disposition : "enforce",
  };
}

export function parseCspReports(raw: string): CspViolation[] {
  if (raw === "" || raw.length > MAX_REPORT_BYTES) return [];
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return [];
  }

  // report-uri: { "csp-report": { … } }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const report = (payload as Record<string, unknown>)["csp-report"];
    if (!report || typeof report !== "object") return [];
    const r = report as Record<string, unknown>;
    const violation = normalise(
      r["effective-directive"] ?? r["violated-directive"],
      r["blocked-uri"],
      r["document-uri"],
      r.disposition,
    );
    return violation ? [violation] : [];
  }

  // Reporting API: [ { type: "csp-violation", body: { … } }, … ]
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as Record<string, unknown>;
      if (e.type !== "csp-violation") return [];
      const body = e.body;
      if (!body || typeof body !== "object") return [];
      const b = body as Record<string, unknown>;
      const violation = normalise(
        b.effectiveDirective ?? b.violatedDirective,
        b.blockedURL ?? b.blockedURI,
        b.documentURL ?? b.documentURI,
        b.disposition,
      );
      return violation ? [violation] : [];
    });
  }

  return [];
}

export function formatViolation(violation: CspViolation): string {
  return `CSP ${violation.disposition}: ${violation.directive} blocked ${violation.blockedUrl || "(none)"} on ${violation.documentPath || "(unknown)"}`;
}
