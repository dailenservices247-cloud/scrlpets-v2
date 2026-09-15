<!-- Copy of the approved PRD. Source of truth: ~/TAOO-Vault/AI Hub/PRDs/scrlpets-v2-mfa-signin-challenge-prd.md -->

# PRD: Scrlpets v2 — MFA sign-in challenge

**Date:** 2026-09-15
**Requested by:** Dailen
**Status:** Approved 2026-09-15 — build plan: `docs/superpowers/plans/2026-09-15-mfa-signin-challenge.md` (scrlpets-v2 repo)
**Safety Net (evidence, gap analysis, legacy audit):** [[scrlpets-v2-mfa-signin-challenge-safety-net-2026-09-14]]
**Eval:** [[scrlpets-v2-mfa-signin-challenge-eval]]
**Picks (2026-09-15):** 1A website + database · 2B written runbook · 3A fix both error messages · 4B two analytics events

This PRD adds only what the Safety Net does not already hold: the concrete build,
its order, and how each piece is proven. Evidence and rationale stay in the Safety
Net.

---

## Problem Statement

Members can switch 2FA on, but nothing ever asks for the second factor. On dev
(2026-09-14) a password alone — or an email code alone — gave full access to an
account with 2FA on, and the settings page still said "Two-factor authentication is
on." Production runs the same code; it has 0 enrolled members today, so nobody is
exposed yet.

## Target Users / Personas

- **Members with 2FA on** — asked for their authenticator code once per sign-in per
  device.
- **Members without 2FA** — no visible change.
- **Dailen, as support** — handles the rare member who lost both phone and codes,
  from a written runbook.

## User Stories

- As a member with 2FA on, after I sign in any way, I enter my 6-digit code before I
  can see or change anything.
- As a member who lost my phone, I can use one of my recovery codes to get back in,
  and I'm told this turns 2FA off so I can set it up again.
- As a member stuck on the code screen, I can sign out.
- As a member, if something about 2FA fails, I'm told — not silently ignored.

## Scope

### In Scope

1. **Website gate** — `src/proxy.ts` sends every request from a session that owes
   its second factor to `/two-factor?next=…`. Exempt: `/two-factor`,
   `/auth/callback`, `/auth/signout`, and two static files every page pulls in
   (`/manifest.webmanifest`, `/sw.js`) — redirecting those only produces console errors. Decided by a pure function over the factor
   list from `getUser()` and the `aal` claim of the validated token (never the
   cookie's copy of the factors). The redirect carries any refreshed auth cookies.
2. **Challenge page** `/two-factor` — 6-digit code (numeric keypad,
   `autocomplete="one-time-code"`), "Use a recovery code instead" (existing
   `recoverWithCode`, with a warning that it turns 2FA off), sign out. en + es.
   After a code → `next`. After a recovery code → `/settings/account`.
3. **Recovery codes need aal2 to mint** — migration on
   `generate_mfa_recovery_codes()`; `mfa_recovery.probe.sql` updated.
4. **Database gate** — helper `session_owes_second_factor()`; PostgREST pre-request
   `enforce_second_factor()` refusing owing sessions with 403
   `second_factor_required`, except `/rpc/consume_mfa_recovery_code` and
   `/rpc/clear_login_failures`; restrictive policies on `messages` SELECT (Realtime)
   and `storage.objects` INSERT (uploads). Explicit EXECUTE for `anon`,
   `authenticated`, `service_role` on the pre-request function.
5. **Error messages (3A)** — `second_factor_required` error key and copy (password
   reset, change email/password); "Turn off two-factor" reports failure.
6. **Analytics (4B)** — `mfa_challenge_passed`, `mfa_recovery_code_used` in
   `FUNNEL_EVENTS`, fired through consent-gated `capture()`.
7. **Runbook (2B)** — `docs/mfa-lost-device-runbook.md`.
8. **Tests** — unit, SQL probes, e2e (see eval).

### Out of Scope

- **Banked:** Supabase-native recovery codes (unblock: both projects serve
  `/factors/recovery-codes` with the feature on + supabase-js methods) · throttling
  recovery-code guesses (unblock: before admin MFA enforcement) · admin "remove 2FA"
  button (unblock: someone other than Dailen handles support) · email when 2FA is
  removed (unblock: scrlpets.com sender verified and inbox delivery confirmed) ·
  admins must enrol (unblock: before `payments_enabled` flips) · cookie loss on the
  existing `/login` → `next` redirect in `proxy.ts` (latent, pre-existing; unblock:
  any report of unexpected sign-outs).
- **Declined:** "remember this device", auto-submit at 6 digits, a separate
  post-recovery banner, analytics for challenge shown / wrong code, refactors of
  neighbouring code.

## Technical Approach

| Piece | Where |
|---|---|
| `owesSecondFactor(factors, accessToken)` + `secondFactorExempt(path)` | new `src/lib/auth/second-factor.ts` |
| Proxy reads the flag | `src/lib/supabase/middleware.ts` (`updateSession` also returns `secondFactorOwed`), `src/proxy.ts` |
| Challenge page | new `src/app/two-factor/page.tsx` (server: re-checks, picks the verified TOTP factor) + `src/components/auth/TwoFactorChallenge.tsx` (client) |
| Shared auth shell | export the existing `AuthShell` from `LoginForm.tsx` (no behaviour change) |
| Codes need aal2 | new migration `…_mfa_recovery_codes_need_aal2.sql` |
| Database gate | new migration `…_second_factor_database_gate.sql` |
| Errors | `src/lib/auth/errors.ts`, `AccountSettings.tsx`, `MfaPanel.tsx` (`disable`, `explain`) |
| Events | `src/lib/analytics/events.ts` |
| Copy | `messages/en.json`, `messages/es.json` (`auth.twoFactor.*`, `auth.errors.second_factor_required`, `account.error.secondFactorRequired`, `account.mfaErrorSecondFactorRequired`) |

**Build order (TDD, separate RED and GREEN commits):**

1. Pure gate function (unit).
2. Codes need aal2 (probe → migration on dev).
3. Website gate + challenge page (e2e: password sign-in → challenge → code → next; password-reset link (callback) → challenge → new password saves; enrol through the UI still shows codes).
4. Recovery path (e2e: recovery code → factor gone → settings).
5. Error messages (unit mapping; e2e: failed "Turn off" shows an error).
6. **Dev spike, then database gate** (e2e at the API: owing session refused, allowlisted RPC allowed, signed-out and non-2FA sessions unaffected, aal2 allowed).
7. Runbook.
8. `./ship-verify.sh` → merge → deploy → prod checks → prod migrations.

## Dependencies & Integrations

- Supabase Auth TOTP (dev enroll + verify ON, verified). **Prod verify setting must
  be read before rollout.** Factor challenge/verify take no captcha token.
- PostgREST pre-request hook — Supabase-documented for hosted projects; first use
  here, so a dev spike gates step 6. **Fallback if the spike fails:** stop and bring
  it back to Dailen (restrictive policies on every table leave the 116 definer
  functions open, which is not the security Pick 1A bought).
- No new packages. supabase-js 2.108.1 already has `mfa.challengeAndVerify`.

## Platform & Environment

- Web, mobile web first (390px e2e viewport). No native app.
- Dev `irpayabloogarxwtjmrf` for all build steps; prod `qygdixvmxrezhavvnkgc` only
  after merge and with Dailen's go-ahead.

## Auth & Permissions

- Owing session = has a verified factor AND token `aal` ≠ `aal2`.
- Owing sessions may reach only: `/two-factor`, `/auth/callback`, `/auth/signout`,
  `/manifest.webmanifest`, `/sw.js` (website); `consume_mfa_recovery_code`, `clear_login_failures` (database).
- Minting recovery codes requires aal2. Consuming stays aal1 (it is the way back in).
- Signed-out visitors and members without 2FA: unchanged.

## Error Handling & Edge Cases

- Wrong or expired code → "That code is not right. Check your authenticator app and
  try again." (own copy: the existing `code_invalid` says "Request a new one", which
  fits an emailed code, not an app), box cleared, stay on page. Rate-limited →
  existing rate-limit message.
- Recovery code wrong or already used → its own message; not configured / anything
  else → generic.
- No verified TOTP factor but still owing (e.g. a phone factor) → recovery option
  only.
- Session without a readable token → treated as owing (fail closed).
- `getUser()` network failure in the proxy → existing signed-out handling; the
  database gate is the backstop for the rare race.
- Recovery removes every factor and downgrades the member's sessions to aal1 (read in
  Supabase Auth source) — they stay signed in and land on settings.
- Member enrolled on another device while this session was open → next request is
  challenged (factors come from `getUser()`).

## Security & Privacy

- Closes the bypass found 2026-09-14 (mint codes at aal1 → recover → factor gone).
- The pre-request function sits on EVERY Data API request: a bug there is a site-wide
  outage. Explicit EXECUTE grants, a no-session read and a non-2FA read in the e2e,
  dev first, rollback command ready.
- No new PII; no recovery-code plaintext stored or logged; probe scripts print no
  secrets.

## Performance & Scale

- Website gate: no extra network call (reuses the proxy's `getUser()`), one base64
  decode.
- Database gate: returns immediately for signed-out, service-role and aal2 requests;
  one indexed lookup on `auth.mfa_factors` for aal1 sessions (most member traffic).

## Monetization Impact

None.

## Analytics & Tracking

`mfa_challenge_passed` (on successful code) and `mfa_recovery_code_used` (on
successful recovery), consent-gated like `signed_in`. No properties.

## Migration / Rollback Plan

- **Order:** app (gate + page + both migrations' app-side code) deploys first; prod
  database migrations are pushed only after the Vercel deploy is READY and the
  challenge is seen working. Prod has 0 enrolled members, so either order harms no
  one — the order is insurance.
- **Pre-push prod checks (need Dailen's OK):** TOTP verify enabled; recount
  `auth.mfa_factors`.
- **Rollback, database gate:** `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`
- **Rollback, app:** revert the merge; redeploy.
- **Shared dev hazard:** migrations applied to dev from this branch appear as unknown
  remote versions to other worktrees until merged — merge promptly, note in relay.

## Success Criteria

- On dev and prod, a member with 2FA on who signs in with only a password, email
  code, magic link or reset link cannot load any page except the challenge, and gets
  403 from the Data API for their own rows.
- After the code, everything works as before; members without 2FA see no change.
- A recovery code gets a member in; a password alone can no longer mint codes.
- `./ship-verify.sh` RESULT: ALL GATES PASS; `--prod` smoke passes after deploy.

## Open Questions

- None blocking the build. Prod TOTP-verify setting is checked at rollout.
