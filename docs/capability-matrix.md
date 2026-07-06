# Capability Matrix — LOCKED 2026-07-05

**This document is the capability authority for scrlpets-v2.** SQL (RLS policies +
security-definer functions) is the enforcement layer; TypeScript helpers and UI
affordances mirror this matrix and cite the row they implement (`// matrix row N`).
A ❌→✅ change to any row is a Safety Net event, not a code-review comment.
Full spec + provenance: private vault, `AI Hub/PRDs/scrlpets-v2-entity-authority-spec-2026-07-05.md`.

Roles: `guest` (anon) · `user` (authed, no brand tie) · `contributor` / `admin` / `owner`
(brand roles per `brand_memberships`) · `author` (individual who created the row).

| # | Action | guest | user | author | contributor | admin | owner | Enforced by |
|---|---|---|---|---|---|---|---|---|
| 1 | Read public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | RLS select (live) |
| 2 | Create person-attributed post/listing | ❌ | ✅ | — | ✅ | ✅ | ✅ | RLS insert + server action (live) |
| 3 | Create brand-attributed post/listing | ❌ | ❌ | — | ✅* | ✅ | ✅ | membership check (live). *Default any-member; per-brand setting can restrict to admin+owner (planned — decision 1) |
| 4 | Edit own person-attributed content | ❌ | — | ✅ | — | — | — | RLS author-only (live) |
| 5 | Delete own person-attributed content | ❌ | — | ✅ | — | — | — | RLS author-only (live) |
| 6 | Edit brand-attributed content | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | GAP — slice B (today author-only) |
| 7 | Delete brand-attributed content | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | PARTIAL — listing soft-delete live; post soft-delete = slice B |
| 8 | Edit brand profile / avatar / slug | ❌ | ❌ | — | ❌ | ✅ | ✅ | Brand OS actions (live) |
| 9 | Add/remove contributor | ❌ | ❌ | — | ❌ | ✅ | ✅ | `manage_brand_member` RPC (live) |
| 10 | Add/remove admin; change roles | ❌ | ❌ | — | ❌ | ❌ | ✅ | `manage_brand_member` RPC (live) |
| 11 | Create listing inquiry | ❌ | ✅ | — | ✅ | ✅ | ✅ | phase-8 RPC (live) |
| 12 | View brand membership audit events | ❌ | ❌ | — | ❌ | ✅ | ✅ | phase-7 RLS (live) |

## Locked decisions (2026-07-05, founder interview)

1. **Row 3:** any member posts as brand by default; per-brand owner/admin setting to
   restrict to admin+owner. Contributor draft-for-approval flow BANKED.
2. **Rows 6/7:** author + admin + owner manage brand-attributed content; every
   manager mutation logged to append-only `brand_content_events`.
3. **Post deletion = soft delete** (evidence-spine consistency with listings).
4. **Subject layer:** minimal `litters` + `services` tables planned (kennel +
   service-provider verticals); About picker = none/animal/product/brand/litter/service.
5. **Collaboration:** removed from picker; BANKED behind a dedicated planning
   session (breeder-collaboration differentiator). No placeholder schema.

Implementation gates: slices B/C/D in the vault spec await the identity/social
retrospective audit batch + per-slice Safety Net. Do not implement from this file alone.
