# Domain flip runbook — scrlpets.com

**Status as of 2026-08-26:** PREPARED, NOT FIRED. The domain is attached to the
Vercel project; DNS still points at Lovable. Nothing a visitor sees has changed.

## The gate — do not start until this is true

> A first-time visitor lands on a **populated feed**, not an empty state.

Production content at the time of writing: `listings 0 · creatures 0 · posts 0 ·
brands 0 · litters 0`. The moment DNS propagates, scrlpets.com stops serving the
legacy Lovable app and starts serving whatever v2 has. An empty marketplace is
the one first impression you do not get back.

Check before starting:

```sql
select 'listings' t, count(*) from public.listings
union all select 'creatures', count(*) from public.creatures
union all select 'posts',     count(*) from public.posts
union all select 'brands',    count(*) from public.brands;
```

## Starting state (measured, not assumed)

| Thing | Now |
| --- | --- |
| `scrlpets.com` A | `185.158.133.1` (Lovable, Cloudflare in front) |
| `www.scrlpets.com` | same IP |
| Nameservers | `ns{1..4}*.name.com` — DNS is managed at **name.com** |
| MX / TXT | **none** — nothing to preserve |
| Vercel project | `scrlpets-v2`, domain already added |
| `NEXT_PUBLIC_SITE_URL` | **unset** — 6 surfaces fall back to the vercel.app host |
| Supabase Site URL (prod) | `https://scrlpets-v2.vercel.app` |
| Supabase redirect allow-list | `https://scrlpets-v2.vercel.app/**`, `http://localhost:3000/**` |

## Order matters, and one ordering is wrong

**Do NOT set `NEXT_PUBLIC_SITE_URL` before DNS resolves to Vercel.** Every
confirmation and password-reset email embeds that origin. Set it early and those
links point at scrlpets.com while scrlpets.com still serves the LEGACY app —
users land on the wrong product holding a token the wrong app cannot consume.

DNS first. App config second.

## The steps

### 1. DNS at name.com — Dailen

| Record | From | To |
| --- | --- | --- |
| `A` `@` | `185.158.133.1` | `76.76.21.21` |
| `www` | A → `185.158.133.1` | CNAME → `cname.vercel-dns.com` |

Vercel's own instruction, verbatim: *"Set the following record on your DNS
provider to continue: `A scrlpets.com 76.76.21.21` [recommended]"*. The
alternative — moving nameservers to `ns1.vercel-dns.com` — also works and is
safe here because the domain carries no MX or TXT, but changing one A record is
smaller and reverts instantly.

### 2. Wait for Vercel to verify — either

```bash
npx vercel domains inspect scrlpets.com
```

Proceed when the warning about configuration is gone. Vercel also emails on
completion.

### 3. App + auth config — do these together, after step 2

**Claude:** set `NEXT_PUBLIC_SITE_URL=https://scrlpets.com` on Vercel Production
and redeploy. It is read by `robots.ts`, `sitemap.ts`, `layout.tsx` (canonical
URLs), `settings/referrals` (invite links), `payments/actions` (Stripe return
URLs) and `auth/signup` (confirmation links).

**Dailen**, Supabase → prod → Authentication → URL Configuration:
- **Site URL** → `https://scrlpets.com`
- **Redirect allow-list** → add `https://scrlpets.com/**` (keep the vercel.app
  entry until you are sure nothing depends on it; keep localhost for dev)

### 4. Verify — Claude

```bash
./ship-verify.sh --prod
```

Plus, against the new origin: home renders, `/onboarding/breeder` returns a 307
auth redirect rather than a 404, sitemap and robots cite scrlpets.com, and one
real password reset lands (Resend log → Delivered).

## Rollback

Point the `A` record back to `185.158.133.1`. Everything else is additive: the
Vercel domain attachment, the extra allow-list entry and the env var are all
harmless if DNS is elsewhere. Revert `NEXT_PUBLIC_SITE_URL` too if the rollback
lasts more than a few minutes, or emails will link to a domain serving legacy.

## Known caveat, not a blocker

Auth email sends from `auth@synapsedynamics.io`, not scrlpets.com, because
scrlpets.com has no verified Resend sending domain — the legacy key in
`~/.secret_keys` is explicitly marked dead against a deleted domain. Fine for
seeding people you know. Worth fixing before strangers arrive: verify
scrlpets.com in Resend and move the sender, which is DNS work on the same
domain and easiest to do while you are already in name.com.
