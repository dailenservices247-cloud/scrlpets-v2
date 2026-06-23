# Scrlpets Integration Boundaries

Scrlpets is being built as a pet-first product with clean internal seams for future integrations.

This note is intentionally public-safe. The repository is public for build credibility, deployment workflow, and timestamped progress, but deeper product planning stays in private project docs.

## Why This Document Is Limited

Public code should explain how the app is organized without disclosing unreleased product plans.

This file therefore records only practical engineering boundaries:

- which app areas own current behavior
- which modules should stay easy to integrate later
- which future ideas are out of scope for this repository today

Detailed business planning and unreleased architecture belong in private planning docs, not the public repo.

## Current App Boundaries

Scrlpets currently owns:

- animal-first profiles and creature pages
- feed destinations for posts, short videos, long videos, listings, and product-style promos
- app-native buyer/seller messaging
- lightweight seams for future contextual recommendations
- route contracts that make content destinations predictable

These boundaries let the product grow without mixing feed, profile, commerce, and messaging logic into one-off UI code.

## Integration Seams

### Identity

User identifiers should remain stable and avoid assumptions that would make future account integrations difficult.

### Messaging Context

Messages are app-native today, but thread context should remain explicit enough to connect a conversation to relevant app objects later.

Type seam: `src/lib/messaging/context.ts`.

### Feed Destinations

Feed items should resolve to deterministic destination routes so cards, detail pages, and future previews share the same contract.

Type seam: `src/lib/feed/destinations.ts`.

### Contextual Recommendations

Recommendations should be tied to a clear user context instead of behaving like generic ads.

Type seam: `src/lib/commerce/recommendations.ts`.

## Non-Goals

This repository should not contain private business strategy or unreleased implementation details.

Future platform work should be documented privately until it is intentionally productized for public release.
