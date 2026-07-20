# Deploy configuration

Environment and provider settings the app depends on but cannot enforce from
code. Check these when standing up a new environment or rotating projects.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Also feeds the production CSP `connect-src` (https + wss origins). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | |
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | Canonical origin used by robots/sitemap. |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | Analytics stays fully disabled without it; consent banner only renders when present. |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | Defaults to `https://us.i.posthog.com`. |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Error reports plus a 10% performance-trace sample. |

## Supabase Auth settings (dashboard)

- **Site URL** must match the deployed origin (`NEXT_PUBLIC_SITE_URL`).
- **Redirect URL allow-list** must include `<origin>/auth/callback` for every
  deployed origin (production, previews used for auth testing, and
  `http://localhost:3000/auth/callback` for local dev). Email confirmation,
  resend, password recovery, and Google OAuth all redirect through it.
- **Email confirmation** toggle controls whether signup shows the
  check-your-email pending state.
- **Custom SMTP (configured 2026-07-05, dev project):** Resend — host
  `smtp.resend.com`, port 465, username `resend`, password = Resend API key
  scoped to `synapsedynamics.io` (key name `scripets-supabase-smtp` in the SDS
  Resend account). Sender: `Scrlpets <auth@synapsedynamics.io>` — interim until
  scrlpets.com transfers out of Lovable/name.com and gets its own verified
  sending domain. Both templates below are token_hash-based and LIVE.
- **Email templates:** for confirmation and recovery links that work when
  opened in a different browser or device than the one that started the flow
  (phone mail apps, in-app browsers), point the templates at the callback with
  a token hash instead of the default PKCE link, e.g.
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
  (and `type=signup` for confirmations). The callback route supports both
  `token_hash` and `code` parameters.

## Database migrations (Supabase CLI)

Schema is managed through the Supabase CLI as of 2026-07-20 (Slice D). The
`supabase-dev/phase*.sql` files are frozen history under `supabase-dev/history/`;
`schema.sql` and `seed.sql` remain the local-setup/seed reference.

- **Auth:** `export SUPABASE_ACCESS_TOKEN=$(get-secret scrlpets-v2-supabase-token)`
  and `export SUPABASE_DB_PASSWORD=$(get-secret scrlpets-v2-dev-db-password)`
  before any CLI command. The token belongs to the `allday24seven's Org`
  account that owns the dev project — NOT the legacy Keychain
  `supabase-access-token` (different account/org).
- **Baseline:** `supabase/migrations/<ts>_baseline_public.sql` is migration 0,
  dumped directly from the live dev DB (`supabase db dump --linked --schema public`)
  and marked applied in remote history. New schema changes:
  `supabase migration new <name>` → edit → `supabase db push`.
- **Baseline scope = `public` only.** The `storage` schema is excluded.
  The live dev project has a public `media` bucket with one owner-pathed policy
  (`"media owner upload"`, INSERT, `with_check (bucket_id='media' AND
  (storage.foldername(name))[1] = auth.uid()::text)`). A future prod-promote
  MUST recreate the `media` bucket and this policy by hand — it is not in the
  migration baseline. `auth`/`extensions` schemas are Supabase-managed and also
  excluded by design.
- **Zero-diff proof:** the baseline was verified equal to live by dump-source
  equivalence plus object-count parity (11 tables / 22 policies / 12 functions /
  4 triggers / 1 view, confirmed against `pg_catalog`). The shadow-based
  `supabase db diff --linked` is NOT usable on this machine — its throwaway
  Docker Postgres enters a health-check retry loop and never converges; use
  count parity or a re-dump comparison instead.
- **Promote path (dev → a future prod project):** `supabase link --project-ref
  <prod-ref>` → `supabase db push` (replays the baseline + later migrations) →
  recreate the `media` bucket + policy above → set the prod env vars in this doc.

## Behavior notes

- The Content-Security-Policy header is only emitted when
  `NODE_ENV=production`; verify it once against a production build
  (`npm run build && npm start`) before relying on a deploy.
- Supabase requests are bounded at 10 seconds (60 seconds for storage
  uploads) via a shared fetch wrapper.
- Google OAuth consent screen is in testing mode; only listed test users can
  sign in with Google until the app is published.
