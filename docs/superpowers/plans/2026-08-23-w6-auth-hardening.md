# W6 — Auth Hardening

**Shipped 2026-08-23.** Code complete and deliberately inert. Everything below the
"What Dailen has to do" line is what turns it on, and **the order is not optional.**

## Gap analysis outcome

Ran the Safety Net 12-dimension pass first. Three dimensions came back as real gaps and
were resolved before any code:

| Gap | Resolution |
|---|---|
| **Security** — TOTP with no recovery is a permanent-lockout generator | Recovery codes at enrollment: 10 single-use, bcrypt-hashed, shown once |
| **Auth** — should admins be forced onto MFA? | Optional now; **banked**, with `payments_enabled` as the named unblock |
| **Migration** — CAPTCHA enabling is a live-outage risk | Code ships inert; the dashboard toggle is last |

## What shipped

| Piece | State |
|---|---|
| `mfa_recovery_codes` table + 3 definers (migration `20260823161005`) | **Live on dev** |
| `supabase/probes/mfa_recovery.probe.sql` — 8 assertions | **Passing** |
| `src/lib/mfa/actions.ts` — recovery, service-role factor deletion | Live |
| `src/components/account/MfaPanel.tsx` — enroll, verify, codes, disable | Live |
| `src/lib/auth/captcha.ts` + `TurnstileWidget` | **Inert** — no key |
| `captchaToken` on all three auth calls | **Inert** — Supabase ignores it until enabled |
| CSP: `challenges.cloudflare.com` in script-src / connect-src / frame-src | Live |
| Resend SMTP | **Not code** — dashboard + DNS only |

## The three things worth knowing

### A recovery code cannot bypass MFA, and the obvious design doesn't work

Nothing in the app's schema can make Supabase issue an AAL2 session. A verified recovery
code authorises the app to **delete the TOTP factor with the service role**; the member
then signs in with their password alone and re-enrols. The code proves who they are,
Supabase still decides what a session is worth.

That is why `recoverWithCode` needs `SUPABASE_SERVICE_ROLE_KEY`, and why it **refuses
before spending a code** when the key is absent — spending one and then failing to delete
would burn one of ten and leave MFA in place.

### The ordering inside `recoverWithCode` is the security property

Spend the code first; only a `true` reaches the delete. The reverse would let anyone
holding a stolen password session strip the second factor by submitting nonsense. Pinned
by a test that fails when the two are swapped.

### The codes are unreadable by everyone, including admins

`mfa_recovery_codes` has RLS on and **no policy at all** — not an oversight. An admin who
can read recovery codes is an admin who can take any account, and support staff who can
read them will eventually be asked to. Probe assertion 7 pins it.

---

## What Dailen has to do

### 1. Resend SMTP — no code, and safe to do any time

1. Create a Resend account, add the sending domain, complete SPF/DKIM DNS.
2. Supabase → Project → Authentication → SMTP Settings → enable custom SMTP with the
   Resend host, port 465, and the API key as the password.
3. Set the sender name and address to the verified domain.

Until this is done, Supabase's shared SMTP applies, which is **rate-limited and not for
production volume**. It is the reason a signup burst silently stops sending confirmations.

### 2. Turnstile — ORDER MATTERS, and getting it wrong is a total auth outage

Supabase enforces CAPTCHA from its dashboard. The moment it is on, **every** `signUp`,
`signInWithPassword` and `resetPasswordForEmail` without a token is rejected — including
from the build already in production.

```
1. Deploy this branch                          ← inert: no key, no widget, no token
2. Cloudflare → Turnstile → create a site
3. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY (Vercel) ← widget renders, token sent,
                                                  Supabase still ignoring it
4. Redeploy, and confirm sign-in still works
5. Supabase → Auth → enable CAPTCHA (Turnstile), paste the SECRET key
                                               ← token now required, and supplied
```

**Never do 5 before 3 and 4.** A blank value at step 3 counts as unset — a widget with an
empty sitekey never returns a token, which locks out every sign-in exactly like a missing
key, but silently. `captchaEnabled()` treats blank as absent for that reason.

**The e2e suite will break at step 5** unless the test environment uses Cloudflare's
always-pass testing keys (`1x00000000000000000000AA` site / `1x0000000000000000000000000000000AA`
secret). Set those in the e2e environment before enabling production CAPTCHA, or all 184
tests fail at login.

### 3. Banked: MFA for admins

`/admin` can suspend accounts, resolve disputes and settle money, and today a password is
the only thing in front of it. **Named unblock: before `payments_enabled` flips.**

Deliberately not enforced now. Dailen is the only admin, so enforcing today protects one
account he controls while adding a lockout risk to the account that fixes lockouts — the
same one-way-door shape W3 just removed.

## Verification

| Gate | Result |
|---|---|
| typescript | exit 0 |
| lint | exit 0 — 0 errors, 26 pre-existing warnings |
| unit | **296 passed** (was 286) |
| sql probes | **24 probes, 234 assertions, ALL PASS** (was 23/226) |
| prod build | exit 0 |

Inverted-assertion checks, all three reverted after:

```
probe, single use — the assertion the table exists for
  FAIL mfa_recovery — a recovery code was accepted TWICE

recoverWithCode ordering — consume moved after delete
  × spends the code BEFORE deleting the factor
  × deletes NOTHING when the code is wrong

captchaEnabled — blank treated as configured
  (covered by the empty/whitespace cases, which fail on `key !== undefined`)
```

## Not done

No `Accept-Language`-style auto-enrolment prompts, no WebAuthn/passkeys, no SMS factor
(SMS is the weakest common second factor and adds a per-message cost). No enforcement
anywhere — enrolment is entirely opt-in.
