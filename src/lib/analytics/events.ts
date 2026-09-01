/**
 * The funnel, named once.
 *
 * These names are a schema: PostHog groups by the literal string, so renaming
 * one after data exists splits a funnel in two and nothing errors. Add names
 * here; never write an event string at a call site.
 */
export const FUNNEL_EVENTS = {
  signupCompleted: "signup_completed",
  onboardingSpeciesSaved: "onboarding_species_saved",
  onboardingSkipped: "onboarding_skipped",
  breederBranchTaken: "breeder_branch_taken",
  breederBranchSkipped: "breeder_branch_skipped",
  firstBrandCreated: "first_brand_created",
} as const;

// Deliberately ABSENT: first_listing_created and first_animal_created.
// `listing_created` already fires (ListingForm.tsx:163) and PostHog derives
// first-occurrence per user from it natively — a server round-trip to compute
// "is this your first" would duplicate the analytics tool's own job. An event
// name with no call site is the exact drift this registry exists to prevent.

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];
