# Profiles Implementation Notes

This public repository keeps implementation notes intentionally lightweight.

The detailed task plan for profile and creature pages lives in the private project vault because it includes internal workflow and sequencing details that do not belong in a public code repository.

## Public Summary

Phase 3 added public profile and creature surfaces:

- user profile pages
- creature profile pages
- profile tabs
- profile editing
- feed links into profile and creature destinations
- accessibility and end-to-end coverage

## Current Source Of Truth

Use the current code and tests as the public source of truth:

- `src/app/u/[username]/page.tsx`
- `src/app/c/[slug]/page.tsx`
- `src/app/settings/profile/page.tsx`
- `src/components/profile/`
- `src/lib/profiles/`
- `tests/e2e/profiles.spec.ts`
- `tests/e2e/a11y.spec.ts`

Private planning docs should not be copied into this public repository unless they have been reviewed for public release.
