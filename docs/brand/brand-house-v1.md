---
type: brand-house
version: 1.0
date: 2026-06-10
status: LOCKED v1 (palette swap approved by Dailen 2026-06-10; wine-text nudged +1 shade for WCAG AA, noted §3)
authority: THE single source of truth for visual brand across the portfolio. Every new surface (app, site, deck, thumbnail) styles FROM this doc. Supersedes scattered per-repo token files as the canonical reference (repos consume copies; this doc wins conflicts).
source_palette: SDS brand-v3 "V3 Cursor" register (synapsedynamics.io live tokens, extracted 2026-06-10) + approved wine/gold role swap
companion: brand-tokens-v1.css (same folder — machine-usable)
---

# Brand House v1 — Black Sheep 247 Portfolio

## 1. Brand architecture (the "house")

```
BLACK SHEEP 247 (holding — internal only)
└── SDS / Synapse Dynamics Segmented (consulting + products master brand)
    ├── Scrlpets            (animal-commerce vertical — customer-facing brand)
    ├── Apotheosis          (AI substrate/product)
    ├── BookStack · AWA     (product lines)
    └── Content brands: Day One AI · Allday 24seven · DEVIANT
```

**Model: branded house at the FOUNDATION level, house of brands at the CUSTOMER level.**
- Customers see distinct brands (Scrlpets, Day One AI) — no forced visual sameness.
- Internally, every brand builds on ONE foundation token set (§2) and differentiates via its **expression layer** (§4): accent emphasis, register, imagery. This is the same primitive-reuse discipline as the Synergy trust layer — build the foundation once, express per brand.

## 2. Foundation tokens (canonical, post-swap)

### 2.1 Core palette
| Token | Hex | Role |
|---|---|---|
| `shell` | `#3a3b3d` | primary dark surface (matte gray) |
| `shell-deep` | `#2a2a2d` | recessed/elevated-dark surface |
| `cream` | `#efede5` | primary ink on dark; light-mode surface |
| `cream-deep` | `#e0ddd0` | secondary light surface |
| **`wine`** | **`#7e303a`** | **PRIMARY ACCENT** — fills, badges, primary buttons, borders-accent, gradient endpoint *(was gold's role — swapped 2026-06-10)* |
| **`wine-bright`** | **`#a0414e`** | hover / live indicators *(new tier, derived)* |
| **`wine-text`** | **`#e09aa4`** | links + eyebrow text + accent type on dark *(new tier — see §3)* |
| **`gold`** | **`#c8a23e`** | RESERVE accent — sparse highlight only (loyalty/premium chips, rare emphasis) *(was wine's role — swapped)* |
| `gold-bright` | `#d8b85a` | reserve hover/emphasis |
| `spine` | `#2a6055` | structural emerald — verification/integrity surfaces, secondary borders |
| `spine-bright` | `#347466` | spine hover / gradient mid |
| `ink-strong` | `#ffffff` | max-emphasis text |
| `ink-muted` | `#9b9b96` | secondary text on dark |
| `ink-dim` | `#6c6c69` | tertiary text on dark |
| `border-subtle` | `#4a4b4d` | default border |
| `border-strong` | `#5c5d5f` | emphasized border |

### 2.2 Semantic mapping (what consumes what)
- `accent-primary` / `accent-live` / `link-decoration` → **wine family** (text-level uses take `wine-text`)
- `accent-deep` / `border-accent` → `spine`
- `accent-reserve` → `gold` (use sparingly — if gold appears more than once per screen, it's wrong)
- Gradient "blaze" → `spine → spine-bright → wine` *(endpoint was gold — swapped)*
- Destructive/error → `#e24b4a` (signal red — deliberately brighter than wine so commerce-accent and error never read as the same family; never use wine for errors)
- Shadows: `0 1px 2px rgba(0,0,0,.25)` soft · `0 8px 20px rgba(0,0,0,.32)` mid

### 2.3 Typography
- **Sans:** Geist Sans (SDS site already on it; Scrlpets v2 adopts) — body 400, emphasis 500. Two weights only.
- **Mono:** Geist Mono — eyebrows, labels, metadata, terminal-register elements (`packs --list` pattern).
- Eyebrow recipe: 11px mono, letter-spacing 0.08em, UPPERCASE, `wine-text` on dark.

### 2.4 Spacing / radius / motion (baseline)
- Radius: 6px chips/badges · 8px controls · 12px cards.
- Spacing: 4px base grid (4/8/12/16/24/32).
- Motion: 150ms ease-out micro · 250ms ease standard. No decorative animation in v1.

## 3. Accessibility floor (inherits Scrlpets G4 lock — WCAG 2.1 AA)
- Wine `#7e303a` is a FILL color, never text on dark (≈1.5:1 on shell — illegible).
- Text-level accent on dark surfaces = `wine-text #e09aa4` — measured ≈5.0:1 on shell, ≈6.4:1 on shell-deep, AA-pass.
  - *Note: the approved swatch sheet showed `#d98590`; it measured 4.2:1 on shell (under the locked 4.5 bar) and was nudged one shade lighter. Visual difference is marginal.*
- Text on wine fills: `#f3cdd3` (wine family light) — never white-on-wine for body sizes without checking.
- Gold `#c8a23e` passes as large-text/chip accent on dark; for body-size gold text use `gold-bright`.
- **Amendment 2026-06-11 (caught by the axe gate):** `ink-muted #9b9b96` measures 4.01:1 on `shell #3a3b3d` cards — AA fail. Muted text ON CARDS uses **`ink-muted-card #a9a9a4`** (≈4.6:1). `#9b9b96` remains valid on `shell-deep` (5.1:1).

## 4. Per-brand expression layer
| Brand | Foundation use | Expression |
|---|---|---|
| **SDS** (synapsedynamics.io) | full V3 Cursor register | terminal aesthetic, line-numbered blocks, mono labels, status-bar footer. **Currently still gold-primary on the live site — retrofit to wine-primary is a BANKED task** (unblock: next SDS site session). This doc already records the post-swap target. |
| **Scrlpets v2** | first consumer of post-swap tokens | dark mobile-first; wine = commerce/trust accent (For-sale badges, primary CTAs, links); spine = verification surfaces (provenance badges, escrow states); gold = loyalty tiers ONLY (Top Dog/Alpha chips). Creature-first warmth comes from imagery + cream, not from new colors. |
| **Day One AI / Allday 24seven / DEVIANT** | thumbnails/brand assets pull from foundation | per-channel identity free; when in doubt, shell + cream + one accent. |
| **Apotheosis / future products** | foundation + own accent decision at product design pass | inherit §2–3 floors. |

## 5. Usage rules (do / don't)
- ✅ One accent family per component — wine OR spine OR gold, never stacked.
- ✅ Spine = integrity/verification semantics (matches trust-primitive surfaces in Scrlpets).
- ✅ Eyebrows always mono + wine-text.
- ❌ No new hex values in any repo — extend THIS doc first, then consume.
- ❌ No gradients beyond blaze; no glow/neon.
- ❌ Wine for errors (destructive red exists), gold for CTAs (reserve only).

## 6. Machine consumption
- `brand-tokens-v1.css` (same folder) — two blocks: raw custom properties + a shadcn/Tailwind `:root` HSL mapping ready for **Scrlpets v2 Task 2** (paste into `globals.css`, then restyle = token swap only).
- Slice-1 plan Task 2 references this file. SDS site consumes at retrofit time.

## 6.5 Scrlpets logo — LOCKED v1.1 (2026-06-11, Dailen picked from 4 options)
**The "scroll-tail S":** an S whose terminal curls into a spiral reading as both a scroll (scrl-) and a tail (-pets). Wine `#7e303a` stroke, curl accent `wine-bright #a0414e`, round caps. Lockup = S mark + "crlpets" in Geist 600 (real text, i18n-safe). Standalone S on shell-deep rounded square = app icon/favicon.
- Assets: `Brand/assets/scrlpets-icon.svg` + `scrlpets-wordmark.tsx` (source of truth = `scrlpets-v2/src/components/brand/Wordmark.tsx` + `src/app/icon.svg`).
- Rejected: dot-heritage (kept on marketing site until its refresh), paw (generic), shield-as-logo (shield lives on as the in-product emerald verification badge).

## 7. Banked (named unblocks)
- SDS site wine-retrofit → next SDS-site work session.
- SDS monogram refresh → SDS-site session (Scrlpets mark DONE 2026-06-11, see §6.5).
- Marketing-site wordmark swap to scroll-tail S → next marketing-site touch.
- Light-mode full mapping → when a light surface ships (marketing pages).
- Motion language beyond baseline → slice-2 design pass.

## Cross-references
- `AI Hub/PRDs/scrlpets-v2-rebuild-kickoff-design.md` §2.2 + §2.6 (G4 a11y lock)
- `AI Hub/PRDs/scrlpets-v2-slice1-implementation-plan.md` Task 2
- Decision: Scrlpets = SDS subsidiary (vault `Decisions/black-sheep-247.md`, 2026-04-25)
- Live token source: synapsedynamics.io `/_next/static/css/*` `[data-theme=brand-v3]` block
