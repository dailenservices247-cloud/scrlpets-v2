# MFA Sign-in Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member with two-factor on cannot use their account — through the website or straight through Supabase — until they enter their authenticator code or a recovery code.

**Architecture:** One pure function decides whether a session still owes its second factor, from the factor list `getUser()` returns and the `aal` claim of the validated token. `proxy.ts` uses it to send every owing request to a new `/two-factor` page. In the database, one SECURITY DEFINER helper holds the same condition and is enforced by a PostgREST pre-request hook (every table and definer function), a restrictive `messages` read policy (Realtime) and a restrictive upload policy (Storage). Recovery codes can only be minted at aal2.

**Tech Stack:** Next.js 16.2.9 (`src/proxy.ts`), `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.108.1, next-intl (en/es), Vitest 4, Playwright 1.60 (production build), Supabase Postgres + PostgREST v14.5, SQL probes via `./run-probes.sh`.

**Approved inputs (read these, not this summary, when in doubt):**
- PRD: `~/TAOO-Vault/AI Hub/PRDs/scrlpets-v2-mfa-signin-challenge-prd.md` (copy: `docs/superpowers/specs/2026-09-15-mfa-signin-challenge-design.md`)
- Eval: `~/TAOO-Vault/AI Hub/Evals/scrlpets-v2-mfa-signin-challenge-eval.md`
- Evidence: `~/TAOO-Vault/AI Hub/PRDs/scrlpets-v2-mfa-signin-challenge-safety-net-2026-09-14.md`

---

## Ground rules for this build

- **Dev only** until Task 9: Supabase dev is `irpayabloogarxwtjmrf`. Never run anything against prod `qygdixvmxrezhavvnkgc` without Dailen's explicit go-ahead in chat.
- **TDD evidence (AGENTS.md):** a RED commit contains only the failing test and states the failure it produced; a GREEN commit contains the fix and states the passing run. Both on this branch, reachable from `HEAD`.
- **Commit before long verification.** Gates read the worktree, not `HEAD`. Never chain `git commit` behind a long run.
- **Never put a verified factor on a shared fixture account.** Specs create and delete their own `@example.com` members.
- **e2e port:** `playwright.config.ts` builds and serves on :3000. Check first: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. If another worktree holds it, do not kill it — use the scratch config in Appendix A.
- **Load:** run `uptime` before `./ship-verify.sh`; read its `RESULT:` line, never its exit code through a pipe.
- **Scratch files** (spike script, alternate Playwright config, logs) live outside the repo:
  `SCRATCH=/private/tmp/claude-501/-Users-dailenhuntley-dev-scrlpets-v2--claude-worktrees-modest-keller-074ece/a1aa281f-2bfe-4ef7-b0b3-2dad69f44f70/scratchpad`

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/lib/auth/second-factor.ts` (new) | `owesSecondFactor()`, `secondFactorExempt()`, `SECOND_FACTOR_PATH` | 1 |
| `tests/unit/second-factor.test.ts` (new) | pins the gate decision | 1 |
| `supabase/migrations/<ts>_mfa_recovery_codes_need_aal2.sql` (new) | minting requires aal2 | 2 |
| `supabase/probes/mfa_recovery.probe.sql` | aal1 cannot mint; aal2 claims where minting | 2 |
| `src/lib/supabase/middleware.ts` | `updateSession` also returns `secondFactorOwed` | 3 |
| `src/proxy.ts` | redirect owing sessions to the challenge | 3 |
| `src/app/two-factor/page.tsx` (new) | re-check, pick the TOTP factor | 3 |
| `src/components/auth/TwoFactorChallenge.tsx` (new) | code entry (T3), recovery entry (T4), sign out | 3, 4 |
| `src/components/auth/LoginForm.tsx` | `export` the existing `AuthShell` | 3 |
| `src/lib/analytics/events.ts` | two event names | 3, 4 |
| `messages/en.json`, `messages/es.json` | copy | 3, 4, 5 |
| `tests/e2e/two-factor.spec.ts` (new) | end-to-end and Data API checks | 3–6 |
| `src/lib/auth/errors.ts` | `second_factor_required` key | 5 |
| `src/components/account/AccountSettings.tsx` | show it | 5 |
| `src/components/account/MfaPanel.tsx` | "Turn off" reports failure | 5 |
| `supabase/migrations/<ts>_second_factor_database_gate.sql` (new) | helper, pre-request hook, two restrictive policies | 6 |
| `supabase/probes/second_factor_gate.probe.sql` (new) | pins the database gate | 6 |
| `docs/mfa-lost-device-runbook.md` (new) | Pick 2B | 7 |

---

### Task 0: Branch, plan and spec committed

**Files:**
- Create: `docs/superpowers/plans/2026-09-15-mfa-signin-challenge.md` (this file)
- Create: `docs/superpowers/specs/2026-09-15-mfa-signin-challenge-design.md`

- [ ] **Step 1: Confirm the branch starts at `main`**

Run: `git log --oneline -1 && git ls-remote --heads origin main`
Expected: both show `b8312d0` (branch `claude/mfa-signin-challenge`).

- [ ] **Step 2: Copy the approved PRD into the repo as the spec**

```bash
{ printf '<!-- Copy of the approved PRD. Source of truth: ~/TAOO-Vault/AI Hub/PRDs/scrlpets-v2-mfa-signin-challenge-prd.md -->\n\n'; cat "$HOME/TAOO-Vault/AI Hub/PRDs/scrlpets-v2-mfa-signin-challenge-prd.md"; } > docs/superpowers/specs/2026-09-15-mfa-signin-challenge-design.md
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-15-mfa-signin-challenge.md docs/superpowers/specs/2026-09-15-mfa-signin-challenge-design.md
git commit -m "Plan the MFA sign-in challenge"
```

---

### Task 1: The gate decision, as a pure function

**Files:**
- Create: `src/lib/auth/second-factor.ts`
- Test: `tests/unit/second-factor.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/second-factor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { owesSecondFactor, secondFactorExempt } from "@/lib/auth/second-factor";

/**
 * The website half of the sign-in challenge is decided here, so it is a pure
 * function with its own tests — including the case that shaped it: the SDK's
 * no-argument assurance call trusts a factor list the browser can edit.
 */
function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.signature`;
}

const VERIFIED = [{ status: "verified" }];

describe("owesSecondFactor", () => {
  it("is owed when a verified factor exists and the session is aal1", () => {
    expect(owesSecondFactor(VERIFIED, token({ aal: "aal1" }))).toBe(true);
  });

  it("is settled once the session is aal2", () => {
    expect(owesSecondFactor(VERIFIED, token({ aal: "aal2" }))).toBe(false);
  });

  it("is never owed without a verified factor", () => {
    expect(owesSecondFactor(undefined, token({ aal: "aal1" }))).toBe(false);
    expect(owesSecondFactor([], token({ aal: "aal1" }))).toBe(false);
    // A half-finished enrolment must not trap anyone behind a code they never set up.
    expect(owesSecondFactor([{ status: "unverified" }], token({ aal: "aal1" }))).toBe(false);
  });

  it("fails closed when the token cannot be read", () => {
    expect(owesSecondFactor(VERIFIED, undefined)).toBe(true);
    expect(owesSecondFactor(VERIFIED, "not-a-jwt")).toBe(true);
    expect(owesSecondFactor(VERIFIED, "header.%%%.signature")).toBe(true);
    expect(owesSecondFactor(VERIFIED, token({ sub: "no aal claim" }))).toBe(true);
  });

  it("reads tokens whose claims carry non-ASCII text", () => {
    expect(
      owesSecondFactor(VERIFIED, token({ aal: "aal2", user_metadata: { name: "Zoë" } })),
    ).toBe(false);
  });
});

describe("secondFactorExempt", () => {
  it("lets an owing session reach only the challenge, the callback, sign-out and two static files", () => {
    for (const path of [
      "/two-factor",
      "/auth/callback",
      "/auth/signout",
      "/manifest.webmanifest",
      "/sw.js",
    ]) {
      expect(secondFactorExempt(path), path).toBe(true);
    }
    for (const path of [
      "/",
      "/settings/account",
      "/login",
      "/reset-password",
      "/two-factor/extra",
      "/auth/callback/extra",
    ]) {
      expect(secondFactorExempt(path), path).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm RED**

Run: `npx vitest run tests/unit/second-factor.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/second-factor"`.

- [ ] **Step 3: Commit RED with its evidence**

```bash
git add tests/unit/second-factor.test.ts
git commit -m "RED: nothing decides whether a session still owes its second factor

tests/unit/second-factor.test.ts: 1 failed file — Failed to resolve import
\"@/lib/auth/second-factor\" (npx vitest run tests/unit/second-factor.test.ts)."
```

- [ ] **Step 4: Write the implementation**

`src/lib/auth/second-factor.ts`:

```ts
/**
 * Whether a signed-in session still owes its second factor.
 *
 * `factors` MUST be the list `supabase.auth.getUser()` returned — Supabase's own
 * answer. The SDK's no-argument `getAuthenticatorAssuranceLevel()` reads the copy
 * stored inside the session cookie instead, and the browser controls that
 * cookie: blank the list and the challenge never appears (auth-js 2.108.1).
 *
 * `accessToken` is the token `getUser()` just validated, so its `aal` claim can
 * be trusted. A token that cannot be read counts as owing — fail closed.
 */
export const SECOND_FACTOR_PATH = "/two-factor";

// The only requests an owing session may make. The two static files are linked
// from every page (manifest) or fetched by old service workers (sw.js); sending
// them to the challenge only produces console errors.
const EXEMPT_PATHS: ReadonlySet<string> = new Set([
  SECOND_FACTOR_PATH,
  "/auth/callback",
  "/auth/signout",
  "/manifest.webmanifest",
  "/sw.js",
]);

export function owesSecondFactor(
  factors: ReadonlyArray<{ status: string }> | undefined,
  accessToken: string | undefined,
): boolean {
  if (!factors?.some((factor) => factor.status === "verified")) return false;
  return tokenAssuranceLevel(accessToken) !== "aal2";
}

export function secondFactorExempt(pathname: string): boolean {
  return EXEMPT_PATHS.has(pathname);
}

function tokenAssuranceLevel(accessToken: string | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run it and confirm GREEN**

Run: `npx vitest run tests/unit/second-factor.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit GREEN with its evidence**

```bash
git add src/lib/auth/second-factor.ts
git commit -m "GREEN: one pure function decides whether a session owes its second factor

tests/unit/second-factor.test.ts: 6 passed (npx vitest run
tests/unit/second-factor.test.ts). Reads factors from getUser(), never the
cookie copy; unreadable tokens count as owing."
```

---

### Task 2: Recovery codes can only be minted at aal2

**Files:**
- Modify: `supabase/probes/mfa_recovery.probe.sql` (whole file below)
- Create: `supabase/migrations/<ts>_mfa_recovery_codes_need_aal2.sql`

- [ ] **Step 1: Write the failing probe**

Replace `supabase/probes/mfa_recovery.probe.sql` with:

```sql
-- Recovery codes, rolled back.
-- 4 is the one that matters for replay: a code must work exactly ONCE, ever.
-- 0 is the one that matters for the sign-in challenge: a password alone must not
-- be able to mint codes, or it can spend one and delete the second factor.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  member   uuid := '00000000-0000-0000-0000-000000000001';
  other    uuid;
  codes    text[];
  first    text;
  n        integer;
  ok       boolean;
  results  text := '';
begin
  perform set_config('role', 'postgres', true);
  select id into other from public.profiles where id <> member limit 1;
  delete from public.mfa_recovery_codes where profile_id in (member, other);

  ------------------------------------------ 0. a password alone cannot mint
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.generate_mfa_recovery_codes();
    raise exception 'PROBE FAILED: an aal1 session minted recovery codes';
  exception when others then
    if sqlerrm <> 'aal2_required' then raise; end if;
  end;
  results := results || E'0a an aal1 session cannot mint recovery codes\n';

  --------------------------------------------------- 1. ten codes, once
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
  select array_agg(code) into codes from public.generate_mfa_recovery_codes();
  if array_length(codes, 1) <> 10 then
    raise exception 'PROBE FAILED: expected 10 codes, got %', array_length(codes, 1);
  end if;
  results := results || E'1a generate returns exactly ten codes\n';

  --------------------------------------- 2. stored HASHED, never in plaintext
  perform set_config('role', 'postgres', true);
  first := codes[1];
  select count(*) into n from public.mfa_recovery_codes
   where profile_id = member and code_hash = first;
  if n <> 0 then
    raise exception 'PROBE FAILED: a recovery code is stored in plaintext';
  end if;
  select count(*) into n from public.mfa_recovery_codes
   where profile_id = member and code_hash like '$2%';
  if n <> 10 then raise exception 'PROBE FAILED: codes are not bcrypt hashes'; end if;
  results := results || E'2a codes are stored as bcrypt hashes, never plaintext\n';

  ------------------------------------------------------ 3. a good code works
  -- Spending stays open at aal1: it is the way back in after a lost phone.
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.consume_mfa_recovery_code(first);
  if not ok then raise exception 'PROBE FAILED: a freshly issued code was refused'; end if;
  results := results || E'3a a freshly issued code is accepted at aal1\n';

  ------------------------------------------- 4. and works exactly ONCE, ever
  ok := public.consume_mfa_recovery_code(first);
  if ok then
    raise exception 'PROBE FAILED: a recovery code was accepted TWICE — it is a reusable password';
  end if;
  results := results || E'4a a spent code is refused on every later attempt\n';

  ------------------------------------------------- 5. a wrong code is refused
  ok := public.consume_mfa_recovery_code('00000-00000');
  if ok then raise exception 'PROBE FAILED: an unissued code was accepted'; end if;
  results := results || E'5a an unissued code is refused\n';

  ------------------------- 6. one member's code does nothing for another
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.consume_mfa_recovery_code(codes[2]);
  if ok then
    raise exception 'PROBE FAILED: a code issued to one member unlocked another';
  end if;
  results := results || E'6a a code is useless to anyone but the member it was issued to\n';

  ------------------------------------ 7. nobody can READ the codes back
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', member, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mfa_recovery_codes;
    if n > 0 then
      raise exception 'PROBE FAILED: an authenticated member can read recovery code rows';
    end if;
  exception when insufficient_privilege then
    null; -- refused outright, which is stronger than returning zero rows
  end;
  results := results || E'7a recovery code rows are unreadable by any client role\n';

  ------------------------------- 8. regenerating invalidates what came before
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.generate_mfa_recovery_codes();
  ok := public.consume_mfa_recovery_code(codes[3]);
  if ok then
    raise exception 'PROBE FAILED: a code from the previous set still works after regeneration';
  end if;
  if public.mfa_recovery_codes_remaining() <> 10 then
    raise exception 'PROBE FAILED: remaining count is wrong after regeneration';
  end if;
  results := results || E'8a regenerating invalidates every earlier code, and the count resets\n';

  perform set_config('role','postgres',true);
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
```

- [ ] **Step 2: Run the one probe and confirm RED**

```bash
TOKEN=$(security find-generic-password -s scrlpets-v2-supabase-token -a dailenhuntley -w)
curl -sS --max-time 180 -X POST "https://api.supabase.com/v1/projects/irpayabloogarxwtjmrf/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' supabase/probes/mfa_recovery.probe.sql)"
```

Expected: a JSON object whose `message` contains `PROBE FAILED: an aal1 session minted recovery codes`.

- [ ] **Step 3: Commit RED with its evidence**

```bash
git add supabase/probes/mfa_recovery.probe.sql
git commit -m "RED: a password alone can mint recovery codes

supabase/probes/mfa_recovery.probe.sql step 0 on dev: \"PROBE FAILED: an aal1
session minted recovery codes\". With a recovery screen, that is password ->
mint -> spend -> factor deleted. Found empirically 2026-09-14."
```

- [ ] **Step 4: Create the migration**

Run: `npx --yes supabase@latest migration new mfa_recovery_codes_need_aal2`
Expected: `Created new migration at supabase/migrations/<ts>_mfa_recovery_codes_need_aal2.sql`.

Write into that file:

```sql
-- Minting recovery codes now requires a session that has passed its second factor.
--
-- Found 2026-09-14 on dev: an aal1 session — a password alone — minted ten codes
-- and spent one. `consume_mfa_recovery_code` stays callable at aal1 on purpose
-- (it is the way back in after a lost phone), and a spent code lets
-- `recoverWithCode` delete the factor with the service role. So while minting
-- was open at aal1, someone holding only the password could mint, spend and
-- strip the second factor, and no sign-in challenge could stop it.
--
-- Enrolment is unaffected: MfaPanel mints codes straight after
-- challengeAndVerify, which has just made the session aal2.
--
-- `create or replace` keeps the existing grants: authenticated only.

create or replace function public.generate_mfa_recovery_codes()
returns table (code text)
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); raw text; i integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2_required';
  end if;

  -- Regenerating invalidates everything previously issued, used or not.
  delete from public.mfa_recovery_codes where profile_id = uid;

  for i in 1..10 loop
    -- 10 hex characters, grouped for transcription by someone reading them off
    -- paper under stress.
    raw := substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5)
        || '-' ||
           substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5);
    insert into public.mfa_recovery_codes (profile_id, code_hash)
    values (uid, extensions.crypt(raw, extensions.gen_salt('bf')));
    code := raw;
    return next;
  end loop;
end; $fn$;
```

- [ ] **Step 5: Apply it to dev**

```bash
DEV_PW=$(security find-generic-password -s scrlpets-v2-dev-db-password -a dailenhuntley -w)
DEV_URL="postgresql://postgres.irpayabloogarxwtjmrf:$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$DEV_PW")@aws-1-us-west-1.pooler.supabase.com:5432/postgres"
npx --yes supabase@latest db push --db-url "$DEV_URL" --dry-run
```

Expected: the dry run lists exactly `<ts>_mfa_recovery_codes_need_aal2.sql`. Then:

```bash
npx --yes supabase@latest db push --db-url "$DEV_URL" --yes
```

**If the dry run lists anything else, errors with "Remote migration versions not found in local migrations directory", or the permission classifier blocks `db push`:** do NOT run `migration repair` (other worktrees share dev). Apply with the Supabase connector's `apply_migration` (project `irpayabloogarxwtjmrf`, name `mfa_recovery_codes_need_aal2`, query = the file's contents), then run `select version, name from supabase_migrations.schema_migrations order by version desc limit 3` through the connector's `execute_sql` and `git mv` the file to the recorded version.

- [ ] **Step 6: Run the probe and confirm GREEN**

Run the same curl as Step 2.
Expected: a JSON array of 9 rows, the first `{"msg":"0a an aal1 session cannot mint recovery codes"}`.

- [ ] **Step 7: Commit GREEN with its evidence**

```bash
git add supabase/migrations/*_mfa_recovery_codes_need_aal2.sql
git commit -m "GREEN: recovery codes can only be minted after the second factor

Migration applied to dev irpayabloogarxwtjmrf. mfa_recovery.probe.sql on dev:
9 assertions pass, including 0a (aal1 refused with aal2_required) and 3a
(spending still works at aal1)."
```

---

### Task 3: The website sends an owing session to the challenge

**Files:**
- Test: `tests/e2e/two-factor.spec.ts` (new), `tests/unit/analytics-events.test.ts`
- Modify: `src/lib/supabase/middleware.ts`, `src/proxy.ts`, `src/components/auth/LoginForm.tsx:533`, `src/lib/analytics/events.ts`, `messages/en.json`, `messages/es.json`
- Create: `src/app/two-factor/page.tsx`, `src/components/auth/TwoFactorChallenge.tsx`

- [ ] **Step 1: Write the failing e2e spec**

`tests/e2e/two-factor.spec.ts`:

```ts
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The second factor, end to end.
 *
 * Every test owns a throwaway @example.com member, created and deleted here. A
 * verified factor on a shared fixture account would put every other spec — and
 * every other worktree's suite on the same dev database — behind the challenge.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

test.skip(!SERVICE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to create throwaway members");

type Member = { id: string; email: string; password: string };
type Enrolment = { factorId: string; secret: string; codes: string[] };

const created: string[] = [];
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY!, NO_SESSION);
const client = () => createClient(SUPABASE_URL, ANON_KEY, NO_SESSION);

test.afterAll(async () => {
  for (const id of created) {
    const { error } = await admin().auth.admin.deleteUser(id);
    // Not swallowed: a member that outlives its test leaves a verified factor on dev.
    if (error) console.warn(`two-factor.spec: could not delete ${id}: ${error.message}`);
  }
});

async function createMember(): Promise<Member> {
  const email = `e2e-2fa-${crypto.randomBytes(5).toString("hex")}@example.com`;
  const password = crypto.randomBytes(18).toString("base64url");
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

/**
 * RFC 6238 — the arithmetic every authenticator app runs. Supabase accepts a
 * code for any fresh challenge within ±30s and keeps no replay list
 * (supabase/auth internal/api/mfa.go), so tests never wait for a new window.
 */
function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function wrongCode(secret: string): string {
  return totp(secret) === "000000" ? "111111" : "000000";
}

/** Enrols the way the account page does: enroll → verify (aal2) → mint codes. */
async function enrol(member: Member): Promise<Enrolment> {
  const db = client();
  const signIn = await db.auth.signInWithPassword({ email: member.email, password: member.password });
  if (signIn.error) throw signIn.error;
  const enrolled = await db.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw enrolled.error;
  const verified = await db.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) throw verified.error;
  const minted = await db.rpc("generate_mfa_recovery_codes");
  if (minted.error) throw minted.error;
  return {
    factorId: enrolled.data.id,
    secret: enrolled.data.totp.secret,
    codes: (minted.data as { code: string }[]).map((row) => row.code),
  };
}

async function verifiedFactors(member: Member): Promise<number> {
  const { data, error } = await admin().auth.admin.mfa.listFactors({ userId: member.id });
  if (error) throw error;
  return data.factors.filter((factor) => factor.status === "verified").length;
}

async function signInWithPassword(page: Page, member: Member) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByTestId("auth-submit").click();
}

test("a member with two-factor on is asked for the code before anything else", async ({ page }) => {
  const member = await createMember();

  // Enrol through the account page itself. This also proves codes are still
  // issued now that minting needs aal2: the browser challenge has just upgraded
  // the session the server action reads.
  await signInWithPassword(page, member);
  await page.waitForURL((url) => url.pathname !== "/login");
  await page.goto("/settings/account");
  await page.getByTestId("mfa-start").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByTestId("mfa-code-input").fill(totp(secret));
  await page.getByTestId("mfa-verify").click();
  await expect(page.getByTestId("mfa-code")).toHaveCount(10);
  await page.getByTestId("mfa-codes-confirm").click();

  // A fresh sign-in has proved one factor.
  await page.context().clearCookies();
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");

  // Every page, not just the one the sign-in was headed for.
  await page.goto("/settings/account");
  await expect(page).toHaveURL("/two-factor?next=%2Fsettings%2Faccount");

  await page.getByTestId("two-factor-code-input").fill(wrongCode(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page.getByTestId("two-factor-error")).toHaveAttribute("data-error", "code");
  await expect(page).toHaveURL("/two-factor?next=%2Fsettings%2Faccount");

  await page.getByTestId("two-factor-code-input").fill(totp(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page).toHaveURL("/settings/account");
  await expect(page.getByTestId("mfa-enrolled")).toBeVisible();

  // Having passed, the challenge steps aside.
  await page.goto("/two-factor?next=%2Fsaved");
  await expect(page).toHaveURL("/saved");
});

test("a password-reset link is challenged too, and the new password saves after the code", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });

  const member = await createMember();
  const { secret } = await enrol(member);
  const { data, error } = await admin().auth.admin.generateLink({
    type: "recovery",
    email: member.email,
  });
  if (error) throw error;

  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery`);
  await expect(page).toHaveURL("/two-factor?next=%2Freset-password");

  await page.getByTestId("two-factor-code-input").fill(totp(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page).toHaveURL("/reset-password");

  const newPassword = crypto.randomBytes(18).toString("base64url");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/login?notice=password_updated");

  expect(problems).toEqual([]);
});

test("the challenge can be left by signing out, and is closed to signed-out visitors", async ({ page }) => {
  await page.goto("/two-factor?next=%2Fsaved");
  await expect(page).toHaveURL("/login?next=%2Fsaved");

  const member = await createMember();
  await enrol(member);
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");
  await page.getByTestId("two-factor-signout").click();
  await expect(page).toHaveURL("/login");

  await page.goto("/settings/account");
  await expect(page).toHaveURL("/login?next=%2Fsettings%2Faccount");
});

test("a member without two-factor is never challenged", async ({ page }) => {
  const member = await createMember();
  await signInWithPassword(page, member);
  await page.waitForURL((url) => url.pathname !== "/login");
  await page.goto("/settings/account");
  await expect(page).toHaveURL("/settings/account");
  await expect(page.getByTestId("mfa-start")).toBeVisible();
});
```

Add to `tests/unit/analytics-events.test.ts`, inside the `describe` block:

```ts
  it("names the two-factor sign-in events", () => {
    expect(FUNNEL_EVENTS.mfaChallengePassed).toBe("mfa_challenge_passed");
    expect(FUNNEL_EVENTS.mfaRecoveryCodeUsed).toBe("mfa_recovery_code_used");
  });
```

- [ ] **Step 2: Run both and confirm RED**

Run: `lsof -nP -iTCP:3000 -sTCP:LISTEN` (empty, or use Appendix A), then
`npx vitest run tests/unit/analytics-events.test.ts` and
`npx playwright test tests/e2e/two-factor.spec.ts --workers=1`
Expected: vitest — 1 failed (`expected undefined to be 'mfa_challenge_passed'`). Playwright — the first three tests FAIL at their first `/two-factor` URL assertion (the member lands on `/`, `/reset-password`, or the login page renders for `/two-factor`); the fourth passes.

- [ ] **Step 3: Commit RED with its evidence**

```bash
git add tests/e2e/two-factor.spec.ts tests/unit/analytics-events.test.ts
git commit -m "RED: a member with two-factor on walks straight in with a password

tests/e2e/two-factor.spec.ts (--workers=1): 3 failed, 1 passed — password
sign-in lands on /, the reset link lands on /reset-password, /two-factor does
not exist. tests/unit/analytics-events.test.ts: 1 failed, the two-factor event
names are missing."
```

- [ ] **Step 3b: Read the vendored Next docs before touching the proxy (AGENTS.md)**

Run: `ls node_modules/next/dist/docs/ && grep -rl "proxy" node_modules/next/dist/docs | head` and read the proxy guide it names — confirm `NextResponse.redirect` and `response.cookies` behave as used below in 16.2.9. If the guide contradicts Step 5, follow the guide and note it in the GREEN commit.

- [ ] **Step 4: `updateSession` reports whether the second factor is owed**

Replace `src/lib/supabase/middleware.ts` with:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { owesSecondFactor } from "@/lib/auth/second-factor";
import { fetchWithTimeout } from "./fetch";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { response, user: null, secondFactorOwed: false };
    // The token getUser() just validated — only its aal claim is read. Factors
    // come from getUser() itself, never from this stored session.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      response,
      user,
      secondFactorOwed: owesSecondFactor(user.factors, session?.access_token),
    };
  } catch {
    // ponytail: a failed getUser() keeps the existing signed-out handling; the
    // database gate refuses an owing session even if this one request slips by.
    return { response, user: null, secondFactorOwed: false };
  }
}
```

- [ ] **Step 5: The proxy redirects owing sessions first**

Replace `src/proxy.ts` with:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth/access";
import { safeNextPath } from "@/lib/auth/redirect";
import { SECOND_FACTOR_PATH, secondFactorExempt } from "@/lib/auth/second-factor";
import { updateSession } from "@/lib/supabase/middleware";

// Discovery is public. Authentication begins only when a visitor moves from
// browsing into creating, messaging, or account/brand administration.
export async function proxy(request: NextRequest) {
  const { response, user, secondFactorOwed } = await updateSession(request);
  const path = request.nextUrl.pathname;
  // Before anything else: a session that has proved only one factor sees the
  // challenge and nothing more — public pages included, and any server action
  // posted from them. Covers every way in (password, email code, Google, magic
  // link, reset link, email-change link) because all of them arrive here.
  if (secondFactorOwed && !secondFactorExempt(path)) {
    const challenge = new URL(SECOND_FACTOR_PATH, request.url);
    challenge.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(challenge);
    // Carry any refresh getUser() just did, or the rotated refresh token is lost
    // and the member is signed out on the next request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(
      new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url),
    );
  }
  if (!user && isProtectedPath(path)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Share the existing auth shell**

In `src/components/auth/LoginForm.tsx`, change line 533 from `function AuthShell({ children }: { children: React.ReactNode }) {` to:

```tsx
export function AuthShell({ children }: { children: React.ReactNode }) {
```

- [ ] **Step 7: The challenge page**

`src/app/two-factor/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";
import { owesSecondFactor } from "@/lib/auth/second-factor";
import { createClient } from "@/lib/supabase/server";

/**
 * The one page a session that owes its second factor can open (proxy.ts).
 *
 * Re-checks rather than trusting the redirect: a member who already passed goes
 * straight on, and a visitor with no session is sent to sign in.
 */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginHrefFor(nextPath));
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!owesSecondFactor(user.factors, session?.access_token)) redirect(nextPath);

  const factor = user.factors?.find(
    (candidate) => candidate.factor_type === "totp" && candidate.status === "verified",
  );
  return <TwoFactorChallenge nextPath={nextPath} factorId={factor?.id ?? null} />;
}
```

- [ ] **Step 8: The challenge component (code entry)**

`src/components/auth/TwoFactorChallenge.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { capture, FUNNEL_EVENTS } from "@/lib/analytics";
import { authErrorKey } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

type Failure = "code" | "rate_limited";

/**
 * The second factor, asked for after any sign-in — proxy.ts sends every session
 * that still owes it here, however it signed in.
 *
 * The exchange runs in the browser because challenge/verify upgrades the session
 * making the call; a server action would upgrade the wrong thing.
 */
export function TwoFactorChallenge({
  nextPath,
  factorId,
}: {
  nextPath: string;
  factorId: string | null;
}) {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setFailure(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      // authErrorKey files anything mentioning "otp" — so "Invalid TOTP code" —
      // under an expired link. A rate limit is still a rate limit.
      setFailure(authErrorKey(error.message) === "rate_limited" ? "rate_limited" : "code");
      setCode("");
      return;
    }
    capture(FUNNEL_EVENTS.mfaChallengePassed);
    router.push(nextPath);
    router.refresh();
  }

  return (
    <AuthShell>
      <section
        className="rounded-2xl border border-secondary/35 bg-secondary/10 p-5"
        data-testid="two-factor"
      >
        <h1 className="text-center text-2xl font-semibold">{t("title")}</h1>
        <form onSubmit={submitCode} className="mt-5 flex flex-col gap-3">
          <p className="text-center text-sm leading-6 text-muted-foreground">{t("body")}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("codeLabel")}
            <input
              className="min-h-11 rounded border border-input bg-transparent p-2 text-center text-lg tracking-[0.4em]"
              type="text"
              name="one-time-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              data-testid="two-factor-code-input"
            />
          </label>
          {failure && <ChallengeError failure={failure} />}
          <Button
            className="min-h-11"
            type="submit"
            disabled={busy || code.length < 6}
            data-testid="two-factor-submit"
          >
            {busy ? t("working") : t("submit")}
          </Button>
        </form>
        <form action="/auth/signout" method="post" className="mt-2">
          <Button
            className="min-h-11 w-full"
            variant="ghost"
            type="submit"
            data-testid="two-factor-signout"
          >
            {t("signOut")}
          </Button>
        </form>
      </section>
    </AuthShell>
  );
}

function ChallengeError({ failure }: { failure: Failure }) {
  const t = useTranslations("auth.twoFactor");
  return (
    <p
      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
      data-testid="two-factor-error"
      data-error={failure}
    >
      {t(`errors.${failure}`)}
    </p>
  );
}
```

- [ ] **Step 9: Event names**

In `src/lib/analytics/events.ts`, change the object's last entry and add the note below the existing `signed_in` comment:

```ts
  firstBrandCreated: "first_brand_created",
  mfaChallengePassed: "mfa_challenge_passed",
  mfaRecoveryCodeUsed: "mfa_recovery_code_used",
} as const;
```

```ts
// `mfa_challenge_passed` and `mfa_recovery_code_used` fire from /two-factor
// (TwoFactorChallenge), consent-gated like everything else. No properties: they
// answer whether two-factor is used, and whether members fall back to recovery.
```

- [ ] **Step 10: Copy, en and es**

```bash
python3 - <<'EOF'
import json
COPY = {
  "en": {
    "title": "Two-factor authentication",
    "body": "Enter the 6-digit code from your authenticator app to finish signing in.",
    "codeLabel": "6-digit code",
    "submit": "Continue",
    "working": "Checking…",
    "signOut": "Sign out",
    "errors": {
      "code": "That code is not right. Check your authenticator app and try again.",
      "rate_limited": "Too many attempts were made. Wait a moment and try again.",
    },
  },
  "es": {
    "title": "Verificación en dos pasos",
    "body": "Ingresa el código de 6 dígitos de tu app de autenticación para terminar de iniciar sesión.",
    "codeLabel": "Código de 6 dígitos",
    "submit": "Continuar",
    "working": "Verificando…",
    "signOut": "Cerrar sesión",
    "errors": {
      "code": "Ese código no es correcto. Revísalo en tu app de autenticación e inténtalo de nuevo.",
      "rate_limited": "Hubo demasiados intentos. Espera un momento e inténtalo de nuevo.",
    },
  },
}
for locale, copy in COPY.items():
    path = f"messages/{locale}.json"
    data = json.load(open(path, encoding="utf-8"))
    data["auth"]["twoFactor"] = copy
    open(path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print("ok")
EOF
```

- [ ] **Step 11: Typecheck, then run both and confirm GREEN**

Run: `./node_modules/.bin/tsc --noEmit` — expected: no output.
Run: `npx vitest run tests/unit/analytics-events.test.ts tests/unit/second-factor.test.ts` — expected: PASS.
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1` — expected: 4 passed.

- [ ] **Step 12: Commit GREEN with its evidence**

```bash
git add src/lib/supabase/middleware.ts src/proxy.ts src/components/auth/LoginForm.tsx \
  src/app/two-factor/page.tsx src/components/auth/TwoFactorChallenge.tsx \
  src/lib/analytics/events.ts messages/en.json messages/es.json
git commit -m "GREEN: every sign-in with two-factor on stops at /two-factor

tests/e2e/two-factor.spec.ts (--workers=1): 4 passed — password sign-in and the
reset link both land on the challenge, a wrong code stays, the right code goes
on, the reset password saves after the code, no console errors, members without
two-factor are untouched. analytics-events.test.ts: pass. tsc clean."
```

---

### Task 4: A recovery code gets a member back in

**Files:**
- Test: `tests/e2e/two-factor.spec.ts`
- Modify: `src/components/auth/TwoFactorChallenge.tsx` (whole file), `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Append the failing test**

Append to `tests/e2e/two-factor.spec.ts`:

```ts
test("a recovery code gets a member in and switches two-factor off", async ({ page }) => {
  const member = await createMember();
  const { codes } = await enrol(member);
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");

  await page.getByTestId("two-factor-use-recovery").click();
  await page.getByTestId("two-factor-recovery-input").fill("00000-00000");
  await page.getByTestId("two-factor-recovery-submit").click();
  await expect(page.getByTestId("two-factor-error")).toHaveAttribute("data-error", "recovery");
  expect(await verifiedFactors(member)).toBe(1);

  await page.getByTestId("two-factor-recovery-input").fill(codes[0]);
  await page.getByTestId("two-factor-recovery-submit").click();
  await expect(page).toHaveURL("/settings/account");
  await expect(page.getByTestId("mfa-start")).toBeVisible();
  expect(await verifiedFactors(member)).toBe(0);
});
```

- [ ] **Step 2: Run it and confirm RED**

Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1 -g "recovery code"`
Expected: FAIL — `getByTestId('two-factor-use-recovery')` not found (timeout).

- [ ] **Step 3: Commit RED with its evidence**

```bash
git add tests/e2e/two-factor.spec.ts
git commit -m "RED: a member who lost their phone has no way to use a recovery code

tests/e2e/two-factor.spec.ts -g \"recovery code\": 1 failed — no
two-factor-use-recovery control. recoverWithCode has had no caller since it
shipped (only tests/unit/mfa-recovery.test.ts imports it)."
```

- [ ] **Step 4: Add recovery entry to the component**

Replace `src/components/auth/TwoFactorChallenge.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { capture, FUNNEL_EVENTS } from "@/lib/analytics";
import { authErrorKey } from "@/lib/auth/errors";
import { recoverWithCode } from "@/lib/mfa/actions";
import { createClient } from "@/lib/supabase/client";

type Failure = "code" | "recovery" | "rate_limited" | "generic";

/**
 * The second factor, asked for after any sign-in — proxy.ts sends every session
 * that still owes it here, however it signed in.
 *
 * The code exchange runs in the browser because challenge/verify upgrades the
 * session making the call. A recovery code goes through `recoverWithCode`, which
 * spends it and removes the factor — so the screen says that before anyone uses
 * one.
 */
export function TwoFactorChallenge({
  nextPath,
  factorId,
}: {
  nextPath: string;
  factorId: string | null;
}) {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const supabase = createClient();
  // No authenticator factor to challenge (e.g. only a phone factor): recovery is
  // the only way through, so start there.
  const [useRecovery, setUseRecovery] = useState(factorId === null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setFailure(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      // authErrorKey files anything mentioning "otp" — so "Invalid TOTP code" —
      // under an expired link. A rate limit is still a rate limit.
      setFailure(authErrorKey(error.message) === "rate_limited" ? "rate_limited" : "code");
      setCode("");
      return;
    }
    capture(FUNNEL_EVENTS.mfaChallengePassed);
    router.push(nextPath);
    router.refresh();
  }

  async function submitRecovery(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    const result = await recoverWithCode(recoveryCode.trim());
    setBusy(false);
    if (!result.ok) {
      setFailure(result.error === "invalid_code" ? "recovery" : "generic");
      return;
    }
    capture(FUNNEL_EVENTS.mfaRecoveryCodeUsed);
    // Two-factor is off now; the account page is where it is switched back on.
    router.push("/settings/account");
    router.refresh();
  }

  function switchTo(recovery: boolean) {
    setUseRecovery(recovery);
    setFailure(null);
  }

  return (
    <AuthShell>
      <section
        className="rounded-2xl border border-secondary/35 bg-secondary/10 p-5"
        data-testid="two-factor"
      >
        <h1 className="text-center text-2xl font-semibold">{t("title")}</h1>
        {useRecovery ? (
          <form onSubmit={submitRecovery} className="mt-5 flex flex-col gap-3">
            <p className="text-center text-sm leading-6 text-muted-foreground">
              {t("recoveryBody")}
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("recoveryLabel")}
              <input
                className="min-h-11 rounded border border-input bg-transparent p-2 text-center font-mono text-lg"
                type="text"
                name="recovery-code"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                data-testid="two-factor-recovery-input"
              />
            </label>
            {failure && <ChallengeError failure={failure} />}
            <Button
              className="min-h-11"
              type="submit"
              disabled={busy || recoveryCode.trim() === ""}
              data-testid="two-factor-recovery-submit"
            >
              {busy ? t("working") : t("recoverySubmit")}
            </Button>
            {factorId && (
              <Button
                className="min-h-11"
                variant="ghost"
                type="button"
                onClick={() => switchTo(false)}
              >
                {t("useCode")}
              </Button>
            )}
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-5 flex flex-col gap-3">
            <p className="text-center text-sm leading-6 text-muted-foreground">{t("body")}</p>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("codeLabel")}
              <input
                className="min-h-11 rounded border border-input bg-transparent p-2 text-center text-lg tracking-[0.4em]"
                type="text"
                name="one-time-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                data-testid="two-factor-code-input"
              />
            </label>
            {failure && <ChallengeError failure={failure} />}
            <Button
              className="min-h-11"
              type="submit"
              disabled={busy || code.length < 6}
              data-testid="two-factor-submit"
            >
              {busy ? t("working") : t("submit")}
            </Button>
            <Button
              className="min-h-11"
              variant="ghost"
              type="button"
              onClick={() => switchTo(true)}
              data-testid="two-factor-use-recovery"
            >
              {t("useRecovery")}
            </Button>
          </form>
        )}
        <form action="/auth/signout" method="post" className="mt-2">
          <Button
            className="min-h-11 w-full"
            variant="ghost"
            type="submit"
            data-testid="two-factor-signout"
          >
            {t("signOut")}
          </Button>
        </form>
      </section>
    </AuthShell>
  );
}

function ChallengeError({ failure }: { failure: Failure }) {
  const t = useTranslations("auth.twoFactor");
  return (
    <p
      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
      data-testid="two-factor-error"
      data-error={failure}
    >
      {t(`errors.${failure}`)}
    </p>
  );
}
```

- [ ] **Step 5: Copy, en and es**

```bash
python3 - <<'EOF'
import json
COPY = {
  "en": {
    "useRecovery": "Use a recovery code instead",
    "recoveryBody": "Enter one of the recovery codes you saved. Using one turns two-factor off, so set it up again from your account page straight after.",
    "recoveryLabel": "Recovery code",
    "recoverySubmit": "Use recovery code",
    "useCode": "Use my authenticator app instead",
    "errors": {
      "recovery": "That recovery code is not right, or it has already been used.",
      "generic": "We could not complete that request. Please try again.",
    },
  },
  "es": {
    "useRecovery": "Usar un código de recuperación",
    "recoveryBody": "Ingresa uno de los códigos de recuperación que guardaste. Al usarlo se desactiva la verificación en dos pasos; vuelve a activarla desde tu cuenta enseguida.",
    "recoveryLabel": "Código de recuperación",
    "recoverySubmit": "Usar código de recuperación",
    "useCode": "Usar mi app de autenticación",
    "errors": {
      "recovery": "Ese código de recuperación no es correcto o ya se usó.",
      "generic": "No pudimos completar la solicitud. Inténtalo de nuevo.",
    },
  },
}
for locale, copy in COPY.items():
    path = f"messages/{locale}.json"
    data = json.load(open(path, encoding="utf-8"))
    block = data["auth"]["twoFactor"]
    errors = copy.pop("errors")
    block.update(copy)
    block["errors"].update(errors)
    open(path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print("ok")
EOF
```

- [ ] **Step 6: Typecheck, run, confirm GREEN**

Run: `./node_modules/.bin/tsc --noEmit` — expected: no output.
Run: `npx vitest run tests/unit/mfa-recovery.test.ts` — expected: PASS (unchanged ordering guarantees).
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1` — expected: 5 passed.

- [ ] **Step 7: Commit GREEN with its evidence**

```bash
git add src/components/auth/TwoFactorChallenge.tsx messages/en.json messages/es.json
git commit -m "GREEN: /two-factor takes a recovery code and says it turns two-factor off

tests/e2e/two-factor.spec.ts (--workers=1): 5 passed — a wrong recovery code is
refused with the factor intact, a saved code lands on /settings/account with
two-factor off. mfa-recovery.test.ts: pass (code spent before the factor is
deleted). tsc clean."
```

---

### Task 5: Two failures stop being silent (Pick 3A)

**Files:**
- Test: `tests/unit/auth-errors.test.ts`, `tests/e2e/two-factor.spec.ts`
- Modify: `src/lib/auth/errors.ts`, `src/components/account/AccountSettings.tsx`, `src/components/account/MfaPanel.tsx`, `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/auth-errors.test.ts`, inside `describe("auth errors", …)`:

```ts
  it("names a missing second factor instead of a generic failure", () => {
    // Supabase's refusal once a factor is verified and the session is aal1.
    expect(
      authErrorKey("AAL2 session is required to update email or password when MFA is enabled."),
    ).toBe("second_factor_required");
    expect(authErrorKey("AAL2 required to unenroll verified factor")).toBe("second_factor_required");
    // The database gate and the recovery-code mint.
    expect(authErrorKey("second_factor_required")).toBe("second_factor_required");
    expect(authErrorKey("aal2_required")).toBe("second_factor_required");
    expect(safeAuthErrorKey("second_factor_required")).toBe("second_factor_required");
  });
```

Append to `tests/e2e/two-factor.spec.ts`:

```ts
test("turning two-factor off says so when it fails", async ({ page }) => {
  const member = await createMember();
  const { secret } = await enrol(member);
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");
  await page.getByTestId("two-factor-code-input").fill(totp(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page).toHaveURL("/");

  await page.goto("/settings/account");
  const refuseUnenrol = (route: import("@playwright/test").Route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ code: 500, error_code: "unexpected_failure", msg: "E2E refused unenrol" }),
        })
      : route.fallback();
  await page.route("**/auth/v1/factors/**", refuseUnenrol);
  await page.getByTestId("mfa-disable").click();
  await expect(page.getByTestId("mfa-error")).toBeVisible();
  await expect(page.getByTestId("mfa-enrolled")).toBeVisible();
  expect(await verifiedFactors(member)).toBe(1);

  await page.unroute("**/auth/v1/factors/**", refuseUnenrol);
  await page.getByTestId("mfa-disable").click();
  await expect(page.getByTestId("mfa-start")).toBeVisible();
  expect(await verifiedFactors(member)).toBe(0);
});
```

- [ ] **Step 2: Run both and confirm RED**

Run: `npx vitest run tests/unit/auth-errors.test.ts`
Expected: 1 failed — `expected 'unknown' to be 'second_factor_required'`.
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1 -g "turning two-factor off"`
Expected: FAIL — `getByTestId('mfa-error')` never visible (the refusal is swallowed and the panel refreshes).

- [ ] **Step 3: Commit RED with its evidence**

```bash
git add tests/unit/auth-errors.test.ts tests/e2e/two-factor.spec.ts
git commit -m "RED: two-factor failures surface as nothing, or as 'could not complete'

auth-errors.test.ts: 1 failed — Supabase's AAL2 refusal maps to 'unknown'.
two-factor.spec.ts -g \"turning two-factor off\": 1 failed — a refused unenrol
shows no mfa-error; MfaPanel.disable ignores the error and refreshes."
```

- [ ] **Step 4: The error key**

In `src/lib/auth/errors.ts`:

1. Add `| "second_factor_required"` to the `AuthErrorKey` union, after `"rate_limited"`.
2. Add `"second_factor_required",` to `AUTH_ERROR_KEYS`, after `"rate_limited",`.
3. Make these the first lines of `authErrorKey`, right after `const normalized = message.toLowerCase();`:

```ts
  // Supabase refuses email/password changes and factor removal at aal1 once a
  // factor is verified ("AAL2 session is required…"); the database gate and the
  // recovery-code mint say it in their own words. Checked first: Supabase's
  // sentence also mentions "password".
  if (normalized.includes("aal2") || normalized.includes("second_factor_required")) {
    return "second_factor_required";
  }
```

- [ ] **Step 5: Account settings shows it**

In `src/components/account/AccountSettings.tsx`, add the import below the actions import:

```tsx
import { authErrorKey } from "@/lib/auth/errors";
```

and replace the last line of `run()` — `else setError(t("error.generic"));` — with:

```tsx
    else
      setError(
        t(
          authErrorKey(result.error ?? "") === "second_factor_required"
            ? "error.secondFactorRequired"
            : "error.generic",
        ),
      );
```

- [ ] **Step 6: "Turn off two-factor" reports failure**

In `src/components/account/MfaPanel.tsx`, add the import:

```tsx
import { authErrorKey } from "@/lib/auth/errors";
```

In `explain()`, add before `return t("mfaErrorGeneric");`:

```tsx
    if (authErrorKey(raw) === "second_factor_required") return t("mfaErrorSecondFactorRequired");
```

Replace `disable()` with:

```tsx
  async function disable() {
    setBusy(true);
    setError(null);
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    // Every failure is shown. This used to ignore them and refresh, so a refused
    // unenrol looked like success while two-factor stayed on.
    let failure: string | null = listError ? listError.message : null;
    for (const factor of data?.totp ?? []) {
      if (failure !== null) break;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) failure = unenrollError.message;
    }
    setBusy(false);
    if (failure !== null) {
      setError(explain(failure));
      return;
    }
    router.refresh();
  }
```

- [ ] **Step 7: Copy, en and es**

```bash
python3 - <<'EOF'
import json
COPY = {
  "en": {
    "auth": "Enter your two-factor code first, then try again.",
    "account": "Enter your two-factor code first, then try again.",
    "panel": "Sign in again with your two-factor code, then try again.",
  },
  "es": {
    "auth": "Primero ingresa tu código de verificación en dos pasos y luego inténtalo de nuevo.",
    "account": "Primero ingresa tu código de verificación en dos pasos y luego inténtalo de nuevo.",
    "panel": "Vuelve a iniciar sesión con tu código de verificación en dos pasos e inténtalo de nuevo.",
  },
}
for locale, copy in COPY.items():
    path = f"messages/{locale}.json"
    data = json.load(open(path, encoding="utf-8"))
    data["auth"]["errors"]["second_factor_required"] = copy["auth"]
    data["account"]["error"]["secondFactorRequired"] = copy["account"]
    data["account"]["mfaErrorSecondFactorRequired"] = copy["panel"]
    open(path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print("ok")
EOF
```

- [ ] **Step 8: Typecheck, run, confirm GREEN**

Run: `./node_modules/.bin/tsc --noEmit` — expected: no output.
Run: `npx vitest run tests/unit/auth-errors.test.ts` — expected: PASS.
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1` — expected: 6 passed.

- [ ] **Step 9: Commit GREEN with its evidence**

```bash
git add src/lib/auth/errors.ts src/components/account/AccountSettings.tsx \
  src/components/account/MfaPanel.tsx messages/en.json messages/es.json
git commit -m "GREEN: a refused unenrol is shown, and 'code required' gets its own words

auth-errors.test.ts: pass. two-factor.spec.ts (--workers=1): 6 passed — a 500 on
unenrol shows mfa-error with two-factor still on; retried, it turns off. tsc
clean."
```

---

### Task 6: The database refuses a session that owes its code

**Files:**
- Test: `supabase/probes/second_factor_gate.probe.sql` (new), `tests/e2e/two-factor.spec.ts`
- Create: `supabase/migrations/<ts>_second_factor_database_gate.sql`

- [ ] **Step 1: Spike the hook on dev, scoped to one throwaway member**

Purpose: prove on this hosted project that `pgrst.db_pre_request` takes effect and what `request.path` holds — before the real gate can affect anyone. The spike refuses ONLY the 2026-09-14 probe fixture; everyone else passes. Save as `$SCRATCH/pre-request-spike.mjs` (scratchpad, not committed) and run with `node`:

```js
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const ROOT = "/Users/dailenhuntley/dev/scrlpets-v2/.claude/worktrees/modest-keller-074ece";
const require = createRequire(`${ROOT}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")
  .filter((l) => /^[A-Z0-9_]+=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("irpayabloogarxwtjmrf")) process.exit(2);
const TOKEN = execSync("security find-generic-password -s scrlpets-v2-supabase-token -a dailenhuntley -w").toString().trim();
const sql = (query) => fetch("https://api.supabase.com/v1/projects/irpayabloogarxwtjmrf/database/query", {
  method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }) }).then((r) => r.json());
const FIXTURE = "2bfbcc52-74b4-4da2-8863-e952fa0d9239"; // mfa-aal-probe-f7a9bf1d@example.com
const np = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, np);
async function sessionFor(email) {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, np);
  await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  return c;
}
try {
  console.log("install:", JSON.stringify(await sql(`
    create or replace function public.spike_pre_request() returns void
    language plpgsql security definer set search_path = '' as $$
    begin
      if auth.uid() = '${FIXTURE}'::uuid then
        raise sqlstate 'PT403' using message = 'spike ' || coalesce(current_setting('request.path', true), '<null>');
      end if;
    end $$;
    grant execute on function public.spike_pre_request() to anon, authenticated, service_role;
    alter role authenticator set pgrst.db_pre_request = 'public.spike_pre_request';
    notify pgrst, 'reload config';`)));
  await new Promise((r) => setTimeout(r, 3000));
  const fixture = await sessionFor("mfa-aal-probe-f7a9bf1d@example.com");
  const t = await fixture.from("saved_searches").select("id");
  const r = await fixture.rpc("mfa_recovery_codes_remaining");
  const anon = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, np).from("guides").select("id").limit(1);
  console.log(JSON.stringify({
    table: { status: t.status, code: t.error?.code, message: t.error?.message },
    rpc: { status: r.status, code: r.error?.code, message: r.error?.message },
    anon: { status: anon.status, error: anon.error?.message ?? null },
  }, null, 2));
} finally {
  console.log("reset:", JSON.stringify(await sql(`
    alter role authenticator reset pgrst.db_pre_request;
    notify pgrst, 'reload config';
    drop function if exists public.spike_pre_request();`)));
}
```

Expected: `table` → status 403, code `PT403`, message `spike /saved_searches`; `rpc` → 403, message `spike /rpc/mfa_recovery_codes_remaining`; `anon` → 200, error null; the reset line prints without error. **If any expectation fails, STOP and report to Dailen** (PRD: no silent fallback to per-table policies).

- [ ] **Step 2: Write the failing probe**

`supabase/probes/second_factor_gate.probe.sql`:

```sql
-- The second-factor database gate, rolled back.
-- 1, 2 and 6 are the outage checks: a gate that refuses signed-out visitors,
-- members without two-factor or server jobs takes down the whole Data API.
begin;

create temp table probe_out (msg text) on commit drop;

do $probe$
declare
  member   uuid := '00000000-0000-0000-0000-000000000001';
  results  text := '';
  cfg      text[];
  n        integer;
  refused  boolean;
begin
  perform set_config('role', 'postgres', true);
  delete from auth.mfa_factors where user_id = member;

  ------------------------------------- 0. registered as the pre-request hook
  select rolconfig into cfg from pg_roles where rolname = 'authenticator';
  if cfg is null or not ('pgrst.db_pre_request=public.enforce_second_factor' = any(cfg)) then
    raise exception 'PROBE FAILED: enforce_second_factor is not the PostgREST pre-request hook';
  end if;
  results := results || E'0a enforce_second_factor is the PostgREST pre-request hook\n';

  ------------------------------------------------ 1. signed-out requests pass
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.path', '/guides', true);
  perform set_config('role', 'anon', true);
  perform public.enforce_second_factor();
  results := results || E'1a a signed-out request passes\n';

  ------------------------------------ 2. a member without two-factor passes
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.enforce_second_factor();
  results := results || E'2a a member without two-factor passes at aal1\n';

  ----------------- 3. the same member with a verified factor is refused at aal1
  perform set_config('role', 'postgres', true);
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), member, 'probe', 'totp', 'verified', now(), now(), 'probe-secret');
  perform set_config('role', 'authenticated', true);
  refused := false;
  begin
    perform public.enforce_second_factor();
  exception when others then
    if sqlstate <> 'PT403' or sqlerrm <> 'second_factor_required' then raise; end if;
    refused := true;
  end;
  if not refused then
    raise exception 'PROBE FAILED: an aal1 session with a verified factor passed the gate';
  end if;
  results := results || E'3a an aal1 session with a verified factor is refused (PT403)\n';

  -------------------------------------------- 4. the ways back in stay open
  perform set_config('request.path', '/rpc/consume_mfa_recovery_code', true);
  perform public.enforce_second_factor();
  perform set_config('request.path', '/rpc/clear_login_failures', true);
  perform public.enforce_second_factor();
  results := results || E'4a recovery-code and lockout-reset RPCs stay open while the code is owed\n';

  ------------------------------------------------- 5. aal2 passes everywhere
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.path', '/saved_searches', true);
  perform set_config('role', 'authenticated', true);
  perform public.enforce_second_factor();
  results := results || E'5a an aal2 session passes\n';

  -------------------------------------------- 6. server-side jobs pass
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
  perform public.enforce_second_factor();
  results := results || E'6a a service-role request passes\n';

  ------------- 7. Realtime and Storage carry the same condition, restrictively
  perform set_config('role', 'postgres', true);
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'messages' and cmd = 'SELECT'
     and permissive = 'RESTRICTIVE' and qual like '%session_owes_second_factor%';
  if n <> 1 then
    raise exception 'PROBE FAILED: messages has no restrictive second-factor read policy';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
     and permissive = 'RESTRICTIVE' and with_check like '%session_owes_second_factor%';
  if n <> 1 then
    raise exception 'PROBE FAILED: storage.objects has no restrictive second-factor upload policy';
  end if;
  results := results || E'7a message reads and uploads are restricted by the same condition\n';

  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;

select msg from probe_out;

rollback;
```

Append to `tests/e2e/two-factor.spec.ts`:

```ts
test("the database refuses a session that still owes its code", async () => {
  const member = await createMember();
  const { factorId, secret } = await enrol(member);

  // The password alone, straight at the Data API — no website involved.
  const owing = client();
  const signIn = await owing.auth.signInWithPassword({ email: member.email, password: member.password });
  if (signIn.error) throw signIn.error;
  const refused = await owing.from("saved_searches").select("id");
  expect(refused.error?.code).toBe("PT403");
  expect(refused.error?.message).toBe("second_factor_required");

  // The way back in stays open.
  const recovery = await owing.rpc("consume_mfa_recovery_code", { candidate: "00000-00000" });
  expect(recovery.error).toBeNull();
  expect(recovery.data).toBe(false);

  // Nobody else is touched: signed-out visitors, members without two-factor.
  expect((await client().from("guides").select("id").limit(1)).error).toBeNull();
  const plain = await createMember();
  const plainDb = client();
  const plainSignIn = await plainDb.auth.signInWithPassword({ email: plain.email, password: plain.password });
  if (plainSignIn.error) throw plainSignIn.error;
  expect((await plainDb.from("saved_searches").select("id")).error).toBeNull();

  // And the code opens it.
  const passed = await owing.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  expect(passed.error).toBeNull();
  expect((await owing.from("saved_searches").select("id")).error).toBeNull();
});
```

- [ ] **Step 3: Run both and confirm RED**

Run the probe (Task 2 Step 2's curl, with `supabase/probes/second_factor_gate.probe.sql`).
Expected: `message` contains `PROBE FAILED: enforce_second_factor is not the PostgREST pre-request hook`.
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1 -g "database refuses"`
Expected: FAIL — `expected undefined to be "PT403"` (the owing session reads its rows).

- [ ] **Step 4: Commit RED with its evidence**

```bash
git add supabase/probes/second_factor_gate.probe.sql tests/e2e/two-factor.spec.ts
git commit -m "RED: a password alone reads everything through the Data API

second_factor_gate.probe.sql on dev: PROBE FAILED, no pre-request hook.
two-factor.spec.ts -g \"database refuses\": 1 failed — an aal1 session of a
two-factor member reads saved_searches with no error."
```

- [ ] **Step 5: Create the migration**

Run: `npx --yes supabase@latest migration new second_factor_database_gate`

Write into the created file:

```sql
-- The database half of the sign-in challenge.
--
-- proxy.ts sends a session that still owes its second factor to /two-factor,
-- but the project URL and public key ship in every browser: someone holding
-- only the password can skip the website and call the Data API directly. This
-- refuses them there too.
--
-- ONE condition, defined once, used by every enforcement point:
--   * PostgREST pre-request hook — every table AND every SECURITY DEFINER
--     function reached through the Data API. RLS alone cannot cover definers.
--   * messages SELECT — Realtime evaluates RLS, not the pre-request hook.
--   * storage.objects INSERT — Storage does not run the hook either.
--
-- DEPLOY ORDER: the website gate ships first. Without /two-factor, a
-- two-factor member is refused every API call with no screen to pass.
--
-- ROLLBACK:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

create or replace function public.session_owes_second_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (
       select 1
         from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
     );
$fn$;

-- Policies call it as the member; `authenticated` cannot read auth.mfa_factors,
-- which is why the helper is a definer.
revoke execute on function public.session_owes_second_factor() from public, anon;
grant execute on function public.session_owes_second_factor() to authenticated, service_role;

create or replace function public.enforce_second_factor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if auth.role() is distinct from 'authenticated' then
    return;
  end if;

  -- The ways back in stay open while the code is owed: spending a recovery
  -- code, and the lockout reset LoginForm runs right after a good password.
  if current_setting('request.path', true) in (
    '/rpc/consume_mfa_recovery_code',
    '/rpc/clear_login_failures'
  ) then
    return;
  end if;

  if public.session_owes_second_factor() then
    raise sqlstate 'PT403'
      using message = 'second_factor_required',
            hint = 'Enter the code from your authenticator app to continue.';
  end if;
end;
$fn$;

-- PostgREST runs the hook as the REQUEST role on every request. A missing grant
-- here is not a two-factor bug — it is every Data API call failing.
revoke execute on function public.enforce_second_factor() from public;
grant execute on function public.enforce_second_factor() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_second_factor';
notify pgrst, 'reload config';

-- Restrictive, so each narrows the existing permissive policies instead of
-- adding another way in.
drop policy if exists "second factor gate on message read" on public.messages;
create policy "second factor gate on message read" on public.messages
as restrictive for select to authenticated
using (not (select public.session_owes_second_factor()));

drop policy if exists "second factor gate on uploads" on storage.objects;
create policy "second factor gate on uploads" on storage.objects
as restrictive for insert to authenticated
with check (not (select public.session_owes_second_factor()));
```

- [ ] **Step 6: Apply it to dev**

Same commands and fallback as Task 2 Step 5. The dry run must list exactly `<ts>_second_factor_database_gate.sql`.

Then immediately smoke the outage cases (not a test — a tripwire):

```bash
curl -sS -o /dev/null -w "anon guides: %{http_code}\n" "$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)/rest/v1/guides?select=id&limit=1" \
  -H "apikey: $(grep ^NEXT_PUBLIC_SUPABASE_ANON_KEY= .env.local | cut -d= -f2-)"
```

Expected: `anon guides: 200`. **Anything else: run the rollback in the migration header through `execute_sql` immediately, then diagnose.**

- [ ] **Step 7: Run both and confirm GREEN**

Run the probe — expected: JSON array of 8 rows (`0a` … `7a`).
Run: `npx playwright test tests/e2e/two-factor.spec.ts --workers=1` — expected: 7 passed (the challenge flows still pass through the gate: `clear_login_failures` is allowlisted and `/two-factor` makes no Data API calls).

- [ ] **Step 8: Commit GREEN with its evidence**

```bash
git add supabase/migrations/*_second_factor_database_gate.sql
git commit -m "GREEN: the database refuses a session that still owes its code

Migration applied to dev irpayabloogarxwtjmrf; anon Data API smoke 200.
second_factor_gate.probe.sql: 8 assertions pass (hook registered; anon,
non-2FA, aal2, service role pass; owing refused PT403; recovery + lockout reset
open; restrictive messages/uploads policies). two-factor.spec.ts
(--workers=1): 7 passed."
```

---

### Task 7: Lost phone and lost codes runbook (Pick 2B)

**Files:**
- Create: `docs/mfa-lost-device-runbook.md`

- [ ] **Step 1: Invoke the `operations:runbook` skill**, then write the runbook with this content as its spine:

```markdown
# Runbook — member lost their phone AND their recovery codes

Use only when a member can sign in with their password (or an emailed code) but
has neither their authenticator app nor a single saved recovery code. If they have
any recovery code, they use "Use a recovery code instead" on the sign-in screen —
no support needed.

## Before touching anything: confirm it is them

Removing two-factor is exactly what someone who stole a password wants support to
do. The only proof that counts is control of the account's email address.

1. Only act on a request that arrived FROM the account's email address. A request
   from any other address, a DM, or a phone call gets the same answer: "Email us
   from the address on the account."
2. Reply to that address (type it; don't trust Reply-To) with a one-time phrase,
   e.g. `blue-otter-42`. Ask them to send it back.
3. Wait for the phrase to come back from that same address. No exceptions for
   urgency — urgency is the most common pressure in account-takeover attempts.

## Remove the factor

1. Supabase dashboard → project **scrlpets-v2-prod** (`qygdixvmxrezhavvnkgc`) →
   Authentication → Users → search the email → copy the user's UID.
2. SQL Editor, replacing the UID:
   `delete from auth.mfa_factors where user_id = '<uid>';`
3. Confirm it returned `DELETE 1` (or the number of factors they had).

## Tell them

"Two-factor is off on your account. Sign in with your password, then go to
Account settings → Two-factor authentication to set it up again, and save the new
recovery codes somewhere other than your phone."

## Log it

Date, the account email, and the phrase you exchanged — in your support notes.
```

- [ ] **Step 2: Verify the SQL step's permission on dev without changing anything**

Through the connector's `execute_sql` on `irpayabloogarxwtjmrf`:

```sql
begin;
delete from auth.mfa_factors where user_id = '2bfbcc52-74b4-4da2-8863-e952fa0d9239';
select count(*) as remaining from auth.mfa_factors where user_id = '2bfbcc52-74b4-4da2-8863-e952fa0d9239';
rollback;
```

Expected: `[{"remaining":0}]` and no permission error (the rollback leaves the fixture's factor in place).

- [ ] **Step 3: Commit**

```bash
git add docs/mfa-lost-device-runbook.md
git commit -m "Runbook for a member who lost their phone and their recovery codes"
```

---

### Task 8: Whole-branch verification on dev

- [ ] **Step 1:** `uptime` — if the 1-minute load is above ~6, wait for it to settle before Step 2.
- [ ] **Step 2:** `lsof -nP -iTCP:3000 -sTCP:LISTEN` — must be empty (ship-verify's e2e uses :3000).
- [ ] **Step 3:** `./ship-verify.sh > "$SCRATCH/ship-verify.log" 2>&1; grep -E "^(PASS|FAIL)|RESULT" "$SCRATCH/ship-verify.log"` — expected: `RESULT: ALL GATES PASS`. Paste the SUMMARY block into the session log. On FAIL: rerun only the failing spec; do not raise timeouts.
- [ ] **Step 4:** Invoke `security-review` on the branch. Fix Critical/High findings test-first (new RED/GREEN pair).
- [ ] **Step 5:** Mark eval scenarios with their result and update the PRD status to "In Progress — dev verified".

---

### Task 9: Production rollout — every step needs Dailen's go-ahead in chat

- [ ] **Step 1: Ask Dailen** to allow two read-only prod queries (the classifier blocked prod reads on 2026-09-11): TOTP verify setting (`GET /v1/projects/qygdixvmxrezhavvnkgc/config/auth` → `mfa_totp_verify_enabled`) and `select count(*) from auth.mfa_factors where status = 'verified'`. If TOTP verify is off, stop: enabling it is Dailen's call.
- [ ] **Step 2: Ask Dailen** to approve merging to `main` (Vercel deploys `main`). Use `superpowers:finishing-a-development-branch`. Wait for the deployment to be READY.
- [ ] **Step 3: Ask Dailen** how to see the challenge on prod: he enrols his own account and signs in again, or approves a throwaway prod member created and deleted through the admin API.
- [ ] **Step 4: Ask Dailen** to approve pushing both migrations to prod, then build the URL and push:

```bash
TOKEN=$(security find-generic-password -s scrlpets-v2-supabase-token -a dailenhuntley -w)
PROD_PW=$(security find-generic-password -s scrlpets-v2-prod-db-password -w)   # account field is "scrlpets"
POOLER=$(curl -sS "https://api.supabase.com/v1/projects/qygdixvmxrezhavvnkgc/config/database/pooler" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; print(next(p for p in json.load(sys.stdin) if p.get("pool_mode")=="session")["connection_string"])')
PROD_URL=$(python3 -c 'import sys,urllib.parse; print(sys.argv[1].replace("[YOUR-PASSWORD]", urllib.parse.quote(sys.argv[2], safe="")))' "$POOLER" "$PROD_PW")
npx --yes supabase@latest db push --db-url "$PROD_URL" --dry-run
```

Expect exactly the two migrations, then push with `--yes`. Run the anon smoke from Task 6 Step 6 against prod's URL and anon key (from Vercel env or the dashboard; expect 200). Run `PROBE_PROJECT_REF=qygdixvmxrezhavvnkgc ./run-probes.sh` only if Dailen approves probes on prod. If `pool_mode` has no `session` entry, stop and ask Dailen for the session-pooler string from the dashboard's Connect panel.
- [ ] **Step 5:** `./ship-verify.sh --prod`, read RESULT.
- [ ] **Step 6:** Update the parity ledger (`last_reviewed_commit`), `~/.claude/handoffs/scrlpets.md`, relay, eval, session log, Active-Work-Log. Offer to delete the two dev probe fixtures (`mfa-aal-probe-f7a9bf1d@example.com`, `mfa-gap-probe-mtx7qw72@example.com`) — only on a yes.

---

## Appendix A — e2e on another port when :3000 is taken

Save as `$SCRATCH/pw-3300.config.ts` and run `npx playwright test --config "$SCRATCH/pw-3300.config.ts" tests/e2e/two-factor.spec.ts --workers=1`. The spec's URL assertions are relative, so they follow `baseURL`.

```ts
import { defineConfig } from "@playwright/test";
import base from "/Users/dailenhuntley/dev/scrlpets-v2/.claude/worktrees/modest-keller-074ece/playwright.config";

const ROOT = "/Users/dailenhuntley/dev/scrlpets-v2/.claude/worktrees/modest-keller-074ece";
const ORIGIN = "http://localhost:3300";

export default defineConfig({
  ...base,
  testDir: `${ROOT}/tests/e2e`,
  globalSetup: `${ROOT}/tests/e2e/global-setup.ts`,
  use: {
    ...base.use,
    baseURL: ORIGIN,
    storageState: {
      cookies: [],
      origins: [{ origin: ORIGIN, localStorage: [{ name: "scrlpets_analytics_consent", value: "declined" }] }],
    },
  },
  webServer: {
    ...(base.webServer as object),
    command: "npm run build && npm run start -- -p 3300",
    url: ORIGIN,
    cwd: ROOT,
  },
});
```
