## Runbook: Member lost their phone AND their recovery codes

**Owner:** Dailen (sole support) | **Frequency:** As needed
**Last Updated:** 2026-09-15 | **Last Run:** never on production

### Purpose

Get a member back into an account that has two-factor on when they have lost the
authenticator app **and** every recovery code. It removes the second factor so they
can sign in with their password and set two-factor up again.

**Do not use it** when they still have any recovery code — they use "Use a recovery
code instead" on the sign-in screen themselves, no support needed.

**Why this is dangerous:** removing someone's second factor is exactly what a person
who has stolen their password wants support to do. The identity check in Step 1 is
the whole safeguard. Never shorten it.

### Prerequisites

- [ ] The request arrived by email **from the address on the account**
- [ ] You can sign in to the Supabase dashboard for **scrlpets-v2-prod** (`qygdixvmxrezhavvnkgc`)
- [ ] 10 minutes without interruption

### Procedure

#### Step 1: Confirm it is really them

```
1. Open https://supabase.com/dashboard/project/qygdixvmxrezhavvnkgc/auth/users
2. Search the email the request came from. Note the address exactly as Supabase shows it.
3. Write a NEW email to that address (type it — do not press Reply, a Reply-To can point elsewhere).
   Subject: Scrlpets two-factor reset
   Body: "Reply to this email with the phrase: <three random words and a number, e.g. blue-otter-lantern-42>.
          If you did not ask to turn off two-factor, ignore this and tell us."
4. Wait for the phrase to come back FROM that same address.
```

**Expected result:** a reply from the account's address containing the exact phrase.
**If it fails:** stop. No reply, a different sender, a wrong phrase, or a request to
change the account's email at the same time → do nothing further. Answer: "For your
security we can only do this for a request from the email on the account."

#### Step 2: Copy the member's user ID

```
In the user list, click the member's row → copy "User UID" (looks like 2bfbcc52-74b4-4da2-8863-e952fa0d9239).
```

**Expected result:** one user, matching the confirmed email.
**If it fails:** no user with that email → the email is not a Scrlpets account; reply and stop.

#### Step 3: Look before you delete

```
Open https://supabase.com/dashboard/project/qygdixvmxrezhavvnkgc/sql/new and run (paste the UID):

select id, factor_type, status, created_at
  from auth.mfa_factors
 where user_id = '<UID>';
```

**Expected result:** one or more rows, `status` = `verified`.
**If it fails:** zero rows → they have no second factor, so something else is wrong (wrong
password, account suspended). Do not continue with this runbook.

#### Step 4: Remove the second factor

```
delete from auth.mfa_factors
 where user_id = '<UID>'
returning factor_type, status;
```

**Expected result:** the same rows Step 3 showed come back as deleted.
**If it fails:** a permission error means you are not in the project's SQL editor as
the owner — check the project name at the top of the page. Do not try other ways in.

#### Step 5: Tell them

```
"Two-factor is off on your Scrlpets account. Sign in with your password, then open
Account settings → Two-factor authentication to set it up again, and keep the new
recovery codes somewhere other than your phone."
```

### Verification

- [ ] Run Step 3's query again → **zero rows**
- [ ] The member confirms they signed in without being asked for a code
- [ ] (Later) they set two-factor up again — optional, their choice

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Member still sees the code screen | They were already on it before Step 4 | Ask them to press "Sign out", then sign in again |
| Member forgot the password too | Normal | They use "Forgot password" first; the reset email arrives and, with the factor gone, the new password saves |
| Member has lost the email account too | This runbook cannot help | There is no other proof of identity — do not remove the factor |
| Step 4 deleted rows for the wrong person | Wrong UID pasted | See Rollback |

### Rollback

A removed factor cannot be put back. If you removed it from the wrong account, email that
account's owner at once (from the address shown in Supabase): tell them two-factor was
turned off by mistake and ask them to set it up again from Account settings.

### Escalation

| Situation | Contact | Method |
|---|---|---|
| Several requests for the same account, or pressure to skip Step 1 | Treat as an account-takeover attempt: do nothing, keep the emails | Note it in the support log |
| The dashboard or SQL editor is unavailable | Supabase support | https://supabase.com/dashboard/support/new |

### History

| Date | Run By | Notes |
|---|---|---|
| 2026-09-15 | Claude (dev only) | Written with the MFA sign-in challenge. The Step 4 delete was checked on dev `irpayabloogarxwtjmrf` inside a rolled-back transaction: permitted, one row deleted, restored by the rollback. Never run on production. |
