"use server";

import { getRouteTransporters, type CheckoutTransporter } from "./queries";

/**
 * Called when the buyer names their route. Kept as an action rather than
 * fetching every transporter up front: coverage is a function of the route, and
 * a list rendered before the route is known would advertise drivers who cannot
 * complete the journey.
 */
export async function findTransporters(
  fromRegion: string,
  toRegion: string,
  recommendedServiceId: string | null,
): Promise<CheckoutTransporter[]> {
  return getRouteTransporters(fromRegion, toRegion, recommendedServiceId);
}
