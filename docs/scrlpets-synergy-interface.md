# Scrlpets ↔ Synergy Interface

Scrlpets is the animal-first vertical. Synergy is the future social OS shell.

This app should prove the satellite pattern without becoming the shell.

## What Scrlpets Owns

- Animal-first profiles and creature pages.
- Feed content around posts, reels, long videos, listings, and promos.
- Buyer/seller messaging in animal-commerce context.
- Marketplace trust primitives as they mature: verified media, seller reputation, escrow state, message auditability, records.
- Seller/breeder product recommendations in contexts where they help the buyer care for the animal.

## What Synergy Owns Later

- The OS-like app/widget shell.
- Unified multi-app inbox.
- Cross-vertical posting and fanout.
- Ecosystem app store / module installer.
- Global social graph and transparent ranking controls.

## Shared Seams

### Identity / SSO

Scrlpets user IDs must stay stable and avoid app-specific assumptions that would block future federation into Synergy identity.

### Unified Inbox

Scrlpets DMs remain app-native, but the message model should be able to expose thread summaries and message contexts to Synergy later.

Type seam: `src/lib/messaging/context.ts`.

### Posting / Fanout

Feed items should have deterministic content destinations. Synergy can later route, preview, or fan out content because each item type has a clear destination contract.

Type seam: `src/lib/feed/destinations.ts`.

### Trust Primitive

Marketplace trust should stay extractable. C2PA media, verification, escrow state, reputation, records, and audit logs should not be buried in one-off Scrlpets UI code.

### Seller Recommendations

Breeder/seller recommendations should be contextual rather than generic ads.

Allowed contexts:

- profile
- listing detail
- post-sale message

Type seam: `src/lib/commerce/recommendations.ts`.

## Non-Goal

Do not build the Synergy shell in Scrlpets.

Scrlpets should become clearer, more trustworthy, and more animal-first. The OS shell, unified social surface, app store, and external fanout system belong to Synergy later.

## Source Vision

Vault source: `AI Hub/Vision/scrlpets-synergy-founder-vision-2026-06-22.md`.
