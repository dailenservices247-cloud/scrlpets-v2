"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAccountLink, createConnectAccount, isStripeConfigured } from "./stripe";

export type PayoutStatus = {
  configured: boolean;
  hasAccount: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
};

/**
 * What the seller's settings page shows. Distinguishes "never started" from
 * "started and still under review" from "was working and Stripe has since asked
 * for more" — three states a seller needs told apart, because the action for
 * each is different and a single "not enabled" would flatten them.
 */
export async function getPayoutStatus(): Promise<PayoutStatus> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_payout_account");
  const row = (data as
    | {
        stripe_account_id: string;
        payouts_enabled: boolean;
        details_submitted: boolean;
        requirements_due: string[];
      }[]
    | null)?.[0];

  return {
    configured: isStripeConfigured(),
    hasAccount: Boolean(row),
    payoutsEnabled: Boolean(row?.payouts_enabled),
    detailsSubmitted: Boolean(row?.details_submitted),
    requirementsDue: row?.requirements_due ?? [],
  };
}

export type OnboardingResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Start or resume Stripe Express onboarding.
 *
 * The account id is recorded BEFORE the seller is redirected. A seller who
 * abandons onboarding halfway otherwise leaves an orphaned Stripe account behind
 * and gets issued a brand new one on their next attempt — so they accumulate
 * accounts, and none of them is the one the platform is watching.
 *
 * Nothing here writes `payouts_enabled`. That arrives from `account.updated`,
 * because whether a seller can be paid is Stripe's finding and not something
 * this process is entitled to assert on their behalf.
 */
export async function startPayoutOnboarding(returnPath = "/settings/payouts"): Promise<OnboardingResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (!isStripeConfigured()) return { ok: false, error: "not_configured" };

  const supabase = await createClient();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data } = await supabase.rpc("my_payout_account");
  const existing = (data as { stripe_account_id: string }[] | null)?.[0];

  let accountId = existing?.stripe_account_id;
  if (!accountId) {
    const created = await createConnectAccount(user.id, user.email ?? undefined);
    if (!created.ok) return { ok: false, error: created.reason };
    accountId = created.data.id;

    // Recorded through the service-role webhook path is not available here, so
    // the account id is written by the definer with the enabled flags left
    // false — the truthful state until Stripe says otherwise.
    const { error } = await supabase.rpc("record_new_payout_account", {
      account_id: accountId,
    });
    if (error) return { ok: false, error: "could_not_record_account" };
  }

  const link = await createAccountLink(
    accountId,
    `${base}${returnPath}?refresh=1`,
    `${base}${returnPath}`,
  );
  if (!link.ok) return { ok: false, error: link.reason };

  revalidatePath(returnPath);
  return { ok: true, url: link.data.url };
}
