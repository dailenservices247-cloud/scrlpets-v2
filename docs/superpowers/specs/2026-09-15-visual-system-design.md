# Scrlpets v2 Visual System — Design

**Date:** 2026-09-15
**Baseline commit:** `2310658`
**Status:** draft — awaiting Dailen's review
**Standard loaded (files, not memory):** `docs/brand/brand-house-v1.md`, `src/app/globals.css`,
`AI Hub/PRDs/scrlpets-v2-ui-redesign-map-2026-06-22.md` §Signature UI principles,
`AI Hub/PRDs/scrlpets-v2-legacy-parity-ledger-2026-07-04.md` §Confirmed strengths / §Unsafe mechanics.

This spec doubles as the PRD for the work. The Eval is the frozen criteria in §8.

## 1. Problem

The app is feature-complete and correct, and it reads as assembled rather than designed.
The tell is not color — the Brand House tokens are live and right. The tell is the
foundation: one uniform bordered panel for every kind of content (`premium-panel`, used in
**93 of 239 components**), body copy at 15px with no real size jumps, photos treated as
attachments inside boxes, a desktop column capped at `max-w-2xl` in a wide empty shell, and
effectively **zero motion** (3 transition/animation utilities in the entire `src` tree).

Every content type — post, listing, reel, long video, and soon products, promotions and
streams — currently renders in the same box, so nothing signals what kind of thing it is or
what happens when you tap it.

## 2. Decisions locked this session

| # | Decision | Consequence |
|---|---|---|
| D1 | **Blast radius = skin + layout.** | Type, color, spacing, depth, motion, and on-screen arrangement may change. No flow, route, schema, capability or copy changes. |
| D2 | **Familiar chassis, signature details.** | Layout stays legible to anyone arriving from Facebook/Instagram. Personality lives in identity, trust and animal-specific detail. |
| D3 | **Feed is one reading surface; every content type owns a realm behind it.** | Tiles are doorways that preview their realm in the realm's own language. |
| D4 | **Foundation first, proven on the feed.** | The system ships and is validated by rebuilding the feed in the same pass. Realms follow. |

## 3. The system

### 3.1 Type scale

Single scale, applied everywhere. Tokens, never raw `text-[Npx]`.

| Role | Size / leading | Use |
|---|---|---|
| `display` | 24 / 1.15, -0.02em | Realm heroes, profile names, section titles |
| `title` | 19 / 1.25, -0.015em | Listing titles, animal names, card headings |
| `body` | 17 / 1.5, -0.011em | Post copy, descriptions, messages |
| `ui` | 15 / 1.4 | Controls, inputs, nav, buttons |
| `meta` | 13 / 1.35 | Timestamps, counts, secondary facts |
| `eyebrow` | 11 mono, uppercase, 0.08em | Context labels — already locked in Brand House |

Body moves 15 → 17. That single change carries most of the "editorial" feel.

**Faces per role (see §9).** `display` and `title` render in **Instrument Serif** when the
string is an identity string — a brand name, an animal name, a realm or section heading.
Every other string at every other size is Geist Sans; `eyebrow` stays Geist Mono.

### 3.2 Spacing rhythm

4px grid. Within a tile: 8 / 12 / 16. Between tiles: 20. Section breaks: 32.
Feed content column widens from `max-w-2xl` (672px) to **720px** on `lg+`. What to do with
the remaining desktop width is **banked** — a right rail is new surface area, which D1 puts
out of scope for this pass.

### 3.3 Three surface registers

Narrative content stops being a box. Transactional content stays one, deliberately. Motion
content gives up the shell entirely.

| Register | Surface treatment | Used by |
|---|---|---|
| **Editorial** | No border, no card background. Hairline separator between items, media edge-to-edge (bleeds past the column padding), 20px rhythm. | post, text+photo, comment threads, profile feeds |
| **Panel** | `premium-panel` upgraded: edge-to-edge media inside the panel, layered top light, status/verification pills, actions as one segmented control. | listing, product, promo, service, order, litter, anything with price or state |
| **Immersive** | Media is the tile. Identity and caption ride a gradient scrim, actions on a right rail. Already the reel realm's language (shipped F6). | reel in-feed, reel realm, and every realm hero |

### 3.4 Photo policy

Native aspect ratio preserved (no forced 4:3 crop). 4px radius in the editorial register,
inherited panel radius in the panel register. Portrait media capped at 4:5 in-feed. Every
image gets an explicit aspect box so nothing reflows on load.

### 3.5 Color

Inherited verbatim from `brand-house-v1.md`; this spec adds no palette tokens.
Wine = primary action. Spine = verification/structure. Gold = reserve, loyalty/premium only.
One accent family per component. No new gradients; the two that exist (`app-surface`,
`premium-panel`) are treated as already-reviewed.

**Dead code found:** the `:root` light block in `globals.css` is the stock shadcn grayscale
palette and never renders — `dark` is hard-coded on `<html>` and no theme toggle exists
anywhere in `src`. It stays dark-only (no theme switching, per standing direction); the dead
block is flagged, not touched, in this pass.

## 4. Tile taxonomy → register

| Content type | Feed register | Realm behind it |
|---|---|---|
| post (text/photo) | Editorial | Post destination (deep links, comments) |
| listing / product / service | Panel | Brand world — the seller's other animals, products, context |
| promo | Panel, gold-eligible | Campaign destination |
| reel (short video) | **Immersive** — inline portrait video, mute on the video, no CTA button | Reel realm: vertical swipe, right action rail |
| long video | Panel with duration + poster | Focus watch realm, no scroll between videos |
| stream (future) | Panel + live indicator (`wine-bright`) | Live realm — **banked** until streaming exists |

New content types inherit by answering one question: does it carry price, state or
verification? If yes it is Panel. If it is something someone said, it is Editorial. If it is
full-bleed motion, it is Immersive.

## 5. The doorway rule (the signature move)

Every tile that opens a realm morphs into it. The tapped media is the same element on both
sides of the navigation — React's `<ViewTransition>` with a matching `name`, enabled by
`experimental.viewTransition` in `next.config.ts`. Next 16.2.9 is already installed and the
guide ships in `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.

No animation library. Browsers without support simply navigate — the app degrades to today's
behavior.

## 6. Motion rules

- Motion communicates continuity or state. Never decoration.
- Durations: 180ms UI feedback, 320ms realm morph. One easing curve, defined once.
- Entry animations only where content genuinely arrives (Suspense reveals), never on static mount.
- `prefers-reduced-motion: reduce` disables morphs and reveals. Non-negotiable.

## 7. Legacy Intent Audit

Required by the Scrlpets legacy-intent gate. Sources: parity ledger §Confirmed strengths and
§Unsafe mechanics, plus the locked redesign map.

| Item | Disposition | Note |
|---|---|---|
| Animal identity first — every card answers which animal, what relationship, what next | **Keep** | Survives into both registers as a required slot |
| Media carries warmth; shell stays restrained and matte | **Keep** | This spec strengthens it (media edge-to-edge, shell quieter) |
| Trust is a UI layer, not a paragraph | **Keep** | Pills and metadata rows in the Panel register |
| Contextual actions beat generic actions | **Keep** | Segmented action control is per-register, not global |
| Accessible mobile-first surfaces, axe + E2E gates | **Keep** | Extended with screenshot baselines (§8) |
| Public-repo / private-strategy boundary | **Keep** | No strategy language enters this repo |
| One uniform card for all content | **Rebuild safely** | Replaced by two registers. Nothing is removed; the box stops being the default answer |
| Badges that overstate what was checked; fabricated metrics or profiles | **Reject — must not return** | A "Verified" pill renders only from a real verification record. "2 of 6 reserved" renders only from real counts. Dev fixtures never reach prod and are visibly fictional |
| Display serif for identity (names, animals, realm headings) | **Add — needs your approval** | See §9. Conflicts with the locked Brand House typography |
| Light mode | **Bank** | Dead `:root` block; unblocks only if theme switching is ever wanted |
| Stream register | **Bank** | Unblocks when streaming exists |

## 8. Frozen acceptance criteria

Written before any code, per design-judge-loop. Each is mechanically checkable. "Mostly
passes" is a fail.

1. Zero raw `text-[Npx]` in touched components; every size comes from the scale in §3.1.
2. Body copy in feed tiles computes to ≥ 16px.
3. Border-radius values in touched components fall in the token set; no ad-hoc radii.
4. No color literal (hex/oklch/rgb) in touched components — tokens only.
5. Every tile that opens a realm declares a `ViewTransition name` matching its destination hero.
6. `prefers-reduced-motion: reduce` produces zero morph animations (measured, not assumed).
7. axe: zero serious/critical on feed, market, listing, profile, reel realm.
8. Muted text on card surfaces ≥ 4.5:1 contrast.
9. Screenshot baselines committed for feed, market, listing, profile at 390px and 1440px; diffs reviewed on every later visual change.
10. `package.json` gains zero runtime dependencies.

## 9. Typography — DECIDED 2026-09-15 (option b)

Dailen approved the display serif and the Brand House amendment that carries it. **Instrument
Serif**, identity only: brand names, animal names, realm and section headings. Never on
controls, buttons, form labels, metadata, timestamps, counts or body copy — those stay Geist
Sans. Geist Mono keeps eyebrows.

Amendment landed in the private Brand House §2.3 (status line updated) and in this repo's
public subset, `docs/brand/brand-house-v1.md`. The face is swappable before first ship: any
substitute must be a display serif, OFL-licensed, and legible at 19px on `shell`.

**Tie-breaker rule, so this does not rot:** if a surface cannot say which of the three faces a
string belongs to and why, the string is Geist Sans.

### Canon conflict found while amending (not fixed here — needs your call)

Private Brand House **§2.2** (amended 2026-07-08) says the action system is the **spine
family** — "every button/pill/live-dot/focus-ring". **§7** (locked 2026-07-22, your sampler
pick, commit `bbb81d2`) says standard actions are **soft wine tint**, with spine demoted to
trust/verification reserve. The code agrees with §7: `--primary` is wine.

So §2.2's line is stale canon, contradicted by a later lock and by the shipped app. This spec
follows §7 and the code. Fixing §2.2 is a canon edit, which is yours to authorize, not mine.

## 10. Prerequisites

1. **Dev content fixtures.** `supabase-dev/seed.sql` is 28 lines / 5 inserts, and prod carries
   no posts or listings. A feed cannot be judged against an empty state. Needs a dev-only
   fixture set: multiple brands, animals with real photos, posts of varying length, listings
   with price and status, one reel, one long video. Dev only, visibly fictional, never prod.
   Separate from the approved seeded soft launch (`docs/superpowers/specs/2026-08-26-seeded-launch-design.md`),
   which is about real breeders in production and is not touched here.
2. **Mobbin MCP authentication** — registered at user scope; needs one interactive sign-in.

## 11. Out of scope

Flows, routes, schema, capabilities, copy, monetization, native packaging, light mode,
video transcode, and the seeded production launch.
