# Composer Implementation Notes

This public repository keeps implementation notes intentionally lightweight.

The detailed task plan for the composer build lives in the private project vault because it includes internal workflow, environment, and sequencing details that do not belong in a public code repository.

## Public Summary

Slice 2 added signed-in composition flows for:

- text/photo posts
- listing creation
- creature selection during compose
- basic media upload handling
- English and Spanish UI strings
- accessibility and end-to-end coverage

## Current Source Of Truth

Use the current code and tests as the public source of truth:

- `src/app/compose/page.tsx`
- `src/components/compose/`
- `src/lib/compose/`
- `tests/unit/compose-validation.test.ts`
- `tests/e2e/compose.spec.ts`
- `tests/e2e/a11y.spec.ts`

Private planning docs should not be copied into this public repository unless they have been reviewed for public release.
