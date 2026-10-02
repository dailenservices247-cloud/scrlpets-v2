import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secondFactorExempt } from "@/lib/auth/second-factor";
import {
  MAX_LOGGED_PER_INSTANCE,
  MAX_REPORT_BYTES,
  parseCspReports,
} from "@/lib/security/csp-report";

/**
 * The CSP blocks silently: `media-src` was missing for months and nothing
 * anywhere recorded it. These cover the channel that would have said so —
 * the two reporting directives the production policy serves, the parser for
 * the two wire formats browsers actually send, and the endpoint's refusal to
 * be a log amplifier or a privacy leak.
 */

const REPORT_URI_BODY = JSON.stringify({
  "csp-report": {
    "document-uri": "https://scrlpets.com/watch/reel/abc?token=secret",
    referrer: "",
    "violated-directive": "media-src",
    "effective-directive": "media-src",
    "original-policy": "default-src 'self'",
    disposition: "enforce",
    "blocked-uri": "https://irpayabloogarxwtjmrf.supabase.co/storage/v1/object/public/media/a.mov",
    "status-code": 200,
  },
});

const REPORTS_JSON_BODY = JSON.stringify([
  {
    type: "csp-violation",
    age: 0,
    url: "https://scrlpets.com/",
    body: {
      documentURL: "https://scrlpets.com/?utm=x",
      effectiveDirective: "media-src",
      disposition: "enforce",
      blockedURL: "https://example.com/clip.mp4",
      statusCode: 200,
    },
  },
]);

async function productionCsp() {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  const { default: config } = await import("../../next.config");
  const headers = (await config.headers!()).flatMap((rule) => rule.headers);
  return {
    csp: headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "",
    reportingEndpoints: headers.find((h) => h.key === "Reporting-Endpoints")?.value ?? "",
  };
}

function directive(csp: string, name: string) {
  return csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
}

describe("production CSP reporting directives", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("names the endpoint on both channels, because no engine supports both", async () => {
    const { csp } = await productionCsp();
    expect(csp, "production policy").toContain("default-src 'self'");
    // report-uri is what Firefox and Safari still use; report-to is Chrome's.
    expect(directive(csp, "report-uri")).toBe("report-uri /api/csp-report");
    expect(directive(csp, "report-to")).toBe("report-to csp-endpoint");
  });

  it("serves a Reporting-Endpoints header pointing at the same route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://scrlpets.com");
    const { reportingEndpoints } = await productionCsp();
    expect(reportingEndpoints).toBe('csp-endpoint="https://scrlpets.com/api/csp-report"');
  });
});

describe("parseCspReports", () => {
  it("reads the report-uri wire format", () => {
    expect(parseCspReports(REPORT_URI_BODY)).toEqual([
      {
        directive: "media-src",
        blockedUrl: "https://irpayabloogarxwtjmrf.supabase.co",
        documentPath: "/watch/reel/abc",
        disposition: "enforce",
      },
    ]);
  });

  it("reads the Reporting API wire format", () => {
    expect(parseCspReports(REPORTS_JSON_BODY)).toEqual([
      {
        directive: "media-src",
        blockedUrl: "https://example.com",
        documentPath: "/",
        disposition: "enforce",
      },
    ]);
  });

  it("drops the browser-extension noise that makes CSP reporting useless", () => {
    for (const blocked of [
      "chrome-extension://abcdef/inject.js",
      "moz-extension://abcdef/inject.js",
      "safari-web-extension://abcdef/inject.js",
      "about:blank",
    ]) {
      const body = JSON.stringify({
        "csp-report": {
          "document-uri": "https://scrlpets.com/",
          "effective-directive": "script-src",
          "blocked-uri": blocked,
        },
      });
      expect(parseCspReports(body), blocked).toEqual([]);
    }
  });

  it("keeps the path but never the query string, which can carry a token", () => {
    const [violation] = parseCspReports(REPORT_URI_BODY);
    expect(violation.documentPath).toBe("/watch/reel/abc");
    expect(JSON.stringify(violation)).not.toContain("secret");
  });

  it("returns nothing for a body that is not a report", () => {
    for (const body of ["", "not json", "{}", "[]", JSON.stringify({ hello: "world" })]) {
      expect(parseCspReports(body), body).toEqual([]);
    }
  });
});

describe("/api/csp-report", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function post(body: string, contentType = "application/csp-report") {
    vi.resetModules();
    const { POST } = await import("@/app/api/csp-report/route");
    return POST(
      new Request("https://scrlpets.com/api/csp-report", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      }),
    );
  }

  it("answers 204 with no body, so it cannot be used as an oracle", async () => {
    const response = await post(REPORT_URI_BODY);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("ignores a body over the cap instead of parsing it", async () => {
    const response = await post(JSON.stringify({ "csp-report": { x: "y".repeat(MAX_REPORT_BYTES) } }));
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("refuses a declared-oversize body without reading it", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/csp-report/route");
    // A valid report, but the sender claims a body far over the cap: the
    // guard has to fire on the claim, before the body is ever buffered.
    const response = await POST(
      new Request("https://scrlpets.com/api/csp-report", {
        method: "POST",
        headers: {
          "content-type": "application/csp-report",
          "content-length": String(MAX_REPORT_BYTES * 10),
        },
        body: REPORT_URI_BODY,
      }),
    );
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("answers 204 for junk and never throws", async () => {
    for (const body of ["", "not json", "[]"]) {
      const response = await post(body);
      expect(response.status).toBe(204);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("stops logging after the per-instance cap, so one bad directive cannot flood the logs", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/csp-report/route");
    const send = () =>
      POST(
        new Request("https://scrlpets.com/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/csp-report" },
          body: REPORT_URI_BODY,
        }),
      );
    for (let i = 0; i < MAX_LOGGED_PER_INSTANCE + 10; i++) {
      const response = await send();
      expect(response.status).toBe(204);
    }
    expect(warn).toHaveBeenCalledTimes(MAX_LOGGED_PER_INSTANCE);
  }, 20_000);
});

describe("the reporting endpoint is reachable while a session owes its second factor", () => {
  it("is exempt from the challenge, or the reports that matter most are redirected away", () => {
    expect(secondFactorExempt("/api/csp-report")).toBe(true);
  });
});
