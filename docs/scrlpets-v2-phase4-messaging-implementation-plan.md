# Messaging Implementation Notes

This public repository keeps implementation notes intentionally lightweight.

The detailed task plan for messaging lives in the private project vault because it includes internal workflow and sequencing details that do not belong in a public code repository.

## Public Summary

Phase 4 added app-native one-to-one messaging:

- inbox and thread routes
- profile-to-message entry point
- participant-scoped conversation access
- realtime message delivery
- optimistic send behavior
- accessibility and end-to-end coverage

## Current Source Of Truth

Use the current code and tests as the public source of truth:

- `src/app/messages/page.tsx`
- `src/app/messages/[id]/page.tsx`
- `src/components/messages/`
- `src/lib/messaging/`
- `tests/e2e/messaging.spec.ts`
- `tests/e2e/a11y.spec.ts`

Private planning docs should not be copied into this public repository unless they have been reviewed for public release.
