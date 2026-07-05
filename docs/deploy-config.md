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
- **Email templates:** for confirmation and recovery links that work when
  opened in a different browser or device than the one that started the flow
  (phone mail apps, in-app browsers), point the templates at the callback with
  a token hash instead of the default PKCE link, e.g.
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
  (and `type=signup` for confirmations). The callback route supports both
  `token_hash` and `code` parameters.

## Behavior notes

- The Content-Security-Policy header is only emitted when
  `NODE_ENV=production`; verify it once against a production build
  (`npm run build && npm start`) before relying on a deploy.
- Supabase requests are bounded at 10 seconds (60 seconds for storage
  uploads) via a shared fetch wrapper.
- Google OAuth consent screen is in testing mode; only listed test users can
  sign in with Google until the app is published.
