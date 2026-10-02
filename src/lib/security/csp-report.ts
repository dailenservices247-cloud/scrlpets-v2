/** Stub for the RED commit — no parsing yet, so the tests fail on assertions. */
export type CspViolation = {
  directive: string;
  blockedUrl: string;
  documentPath: string;
  disposition: string;
};

export const MAX_REPORT_BYTES = 16_384;
export const MAX_LOGGED_PER_INSTANCE = 50;

export function parseCspReports(_raw: string): CspViolation[] {
  return [];
}
