"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/verification/queries";

/**
 * The `shipped` path's last step, and the only place it can be taken.
 *
 * `confirm_shipment_delivered` is revoked from anon, authenticated and public,
 * so it cannot be reached from a user session at all — which is deliberate:
 * `fulfilment_modes.probe.sql` pins that a seller cannot declare their own
 * delivery, because that is the carrier's word and not theirs.
 *
 * There is no carrier integration, so without a caller a shipped order reaches
 * `dispatched` and stops: the buyer can never accept, and the seller is never
 * paid. A human closes it, prompted by `overdue_shipments()`.
 *
 * THE ADMIN CHECK BELOW IS THE ONLY AUTHORIZATION THAT EXISTS. The definer has
 * no uid check of its own; its whole model is the grant, and the service-role
 * client bypasses the grant. Check first, build the client second — the reverse
 * leaves a fully-privileged handle constructed before anyone has been refused.
 *
 * ponytail: human-confirmed delivery; replace with a carrier webhook if a
 * carrier integration ever exists.
 */
export type ShipmentResult = { ok: true } | { ok: false; error: string };

export type OverdueShipment = {
  order_id: string;
  shipped_at: string;
  carrier: string | null;
  tracking_number: string | null;
};

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getOverdueShipments(): Promise<OverdueShipment[]> {
  if (!(await isPlatformAdmin())) return [];
  const { data, error } = await service().rpc("overdue_shipments");
  if (error) return [];
  return (data ?? []) as OverdueShipment[];
}

export async function confirmShipmentDelivered(orderId: string): Promise<ShipmentResult> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "not_admin" };
  const { error } = await service().rpc("confirm_shipment_delivered", {
    target_order: orderId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
