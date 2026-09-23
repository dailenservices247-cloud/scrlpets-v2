# The Expected Litter — a day-one job for a breeder with nothing to sell

**Date:** 2026-09-23
**Baseline:** `main` @ `bd467a3`
**Status:** draft — awaiting Dailen's confirmation (Safety Net step 5)
**Gaps resolved:** 1 → A (expected litter) · 2 → A (`litterPublished` event) · 3 → A (public, with disclosure)

## Problem, measured

Production carries 1 profile, 1 brand (**Danu's Ark**), 2 creatures (**Big Meech**, **Oliver**),
**0 posts, 0 listings, 0 waitlist signups**. The newest signup is 2026-07-28.

The one real user — Dailen — created a brand on 09-04, added two animals on 09-06, and published
nothing. Asked why: *"ran out of time, didn't have anything to list yet."*

That is not a polish problem. The funnel's terminal action is **publish a listing**, and a breeder
between litters has no inventory to list. Dog breeders have litters a few times a year; the app
currently has no job for the other ten months.

## The finding: the loop already exists and one prop is never passed

| Capability | State |
|---|---|
| `litters` table independent of listings (`expected_date`, `sire_id`, `dam_id`, `status`) | **Ships** |
| `LitterWizard` + `createLitter`, status defaults to `"expecting"` | **Ships** |
| Waitlist = a `buyer_applications` row with `listing_id` null (`queries.ts:61`) | **Ships** |
| `ApplyPanel` renders waitlist mode when `listingId` is null (`ApplyPanel.tsx:53`) | **Ships** |
| `waitlistTitle` / `waitlistHelp` copy, English **and** Spanish (`messages/*.json:837,839`) | **Ships** |
| Any page that passes `listingId={null}` | **Does not exist** |
| Any prompt telling a breeder the expected-litter path exists | **Does not exist** |

`ApplyPanel` is mounted in exactly one place — `src/app/listing/[id]/page.tsx` — always with a
listing id. The waitlist half of a component that was built to have two halves has never rendered
in production.

So the build is wiring, not construction: publish an expecting litter → a visitor raises a hand →
the breeder has a waiting list before the animals exist. That is how breeding actually works, and
it is the direct answer to "nothing to list yet."

## Scope decision

### In scope

1. **Waitlist affordance on the litter detail page.** Mount `ApplyPanel` with `listingId={null}`
   and the litter's seller identity on `src/app/litters/[id]/page.tsx`.
2. **One entry point for the breeder**, on the surface a *returning* user actually lands on: the
   empty feed. Shown only to a viewer who manages a brand, has at least one creature, and has no
   litter — the exact state Dailen has been in since 09-06.
3. **`litterPublished` in the existing event registry**, fired on successful `createLitter`.
4. **A visibility line in `LitterWizard`**, at the point of save: an expecting litter is readable
   by anyone, including signed-out visitors.

### Banked, with named unblocks

- **First-run checklist** (Mobbin pattern 4) — unblock: three breeders have walked the funnel and
  we know the real steps, rather than guessing them from one user.
- **Follow suggestions + profile suggestion rail** (Mobbin patterns 7/8) — unblock: more than one
  account exists to suggest. Suggesting accounts on a one-user network is theatre. *This corrects
  my own earlier call that these were the "cheapest wins" — they are cheap and currently pointless.*
- **Draft / private litter state** — unblock: the first breeder who asks for one.
- **Import from an existing platform** (Mobbin pattern 2) — unblock: the first breeder who says
  "it's all on Facebook already."
- **Litters in the main menu** — unblock: the feed prompt ships and underperforms.

### Declined

- Any redesign or restructure. Already declined 2026-09-23; the visual foundation stands.
- Refactoring `litters` or `applications` code while touching it. Surgical edits only.
- A new waitlist table. One exists; it is a `buyer_applications` row with a null listing.

## Legacy Intent Audit

Required by the Scrlpets legacy-intent gate. Legacy read-only at
`~/black-sheep-247/products/scrlpets/scrlpets-beta-magic`.

| Legacy intent | Disposition | Note |
|---|---|---|
| `CreateLitterForm` / `CreateLitter` page | **Keep** | v2's `LitterWizard` supersedes it and is richer (sire/dam links, statuses) |
| `WaitlistDialog` — buyers join a waiting list | **Rebuild safely** | v2's equivalent exists as null-listing `buyer_applications`; this spec finally mounts it |
| `AvailableLittersSection` on the breeder profile | **Bank** | Real discovery intent v2 dropped. Unblock: after the litter path has any traffic |
| `AddPupToLitterSheet` | **Keep** | v2 links young animals to litters already |
| Legacy marketing-kit / collaboration surfaces | **Reject** | Out of scope, and collaboration is separately banked |

Nothing useful is being dropped silently; nothing unsafe is being copied.

## Acceptance criteria — frozen before code

1. A signed-out visitor on a litter detail page sees the waitlist panel with the existing
   `waitlistTitle` copy, in both locales.
2. Submitting it as a signed-in buyer inserts one `buyer_applications` row with `listing_id` null
   and the litter's seller as `seller_id`.
3. A second submission by the same buyer for the same seller surfaces the existing
   `already_applied` error rather than a duplicate row.
4. The feed prompt renders **only** for a viewer who manages a brand, has ≥1 creature and 0
   litters; it does not render for a buyer, a signed-out visitor, or a breeder who already has a
   litter.
5. `litterPublished` appears exactly once in the event registry and the registry test still proves
   names are collision-free.
6. The wizard states who can see the litter, in both locales, before the save control.
7. axe: zero serious or critical violations on the litter detail page.
8. `./ship-verify.sh` → RESULT: ALL GATES PASS.

## Verification notes

- Confirm `litterQueries` selects the owner/brand **id** and not just slug and username —
  `ApplyPanel` needs a `sellerId`. If it does not, that select is the one change to the query layer.
- New testids must be grepped before use. `post-body` collided with the composer on 2026-09-16.
- The e2e suite runs a production build and takes a shared lock; budget one run, not three.

## Out of scope

Realm morphs (spec §5/§6 of the visual system), listing price pills, onboarding restructure,
anything requiring a schema change.
