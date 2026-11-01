import { createAnonClient } from "@/lib/supabase/anon";
import {
  getCarrierAdapter,
  type CarrierProvider,
  type TransportShipmentRequest,
} from "./adapters";

export interface TransportJobPayload {
  orderId: string;
  event: "job.created";
  timestamp: string;
  route: {
    pickupRegion: string | null;
    deliveryRegion: string | null;
  };
  details: {
    title: string | null;
    transportCents: number;
    currency: string;
    fulfilment: string;
  };
}

export interface DispatchResult {
  ok: boolean;
  dispatched: boolean;
  message: string;
  provider?: CarrierProvider;
  externalJobId?: string | null;
  trackingUrl?: string | null;
}

/**
 * Dispatches an animal transportation job to an external 3rd-party courier network
 * (CitizenShipper, uShip, certified airline flight nanny dispatch, or custom webhook).
 *
 * Neither Scrlpets nor individual sellers operate transport vans or carry transport liability;
 * all transport routes directly to licensed, insured independent couriers.
 */
export async function dispatchTransportJob(
  orderId: string,
  provider?: CarrierProvider,
): Promise<DispatchResult> {
  const supabase = createAnonClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,title_snapshot,transport_cents,currency,fulfilment,pickup_region,delivery_region,status,transport_service_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, dispatched: false, message: "Order not found" };
  }

  if (order.fulfilment !== "transported") {
    return { ok: true, dispatched: false, message: "Order is not marked for transport" };
  }

  const selectedProvider: CarrierProvider =
    provider ||
    (process.env.TRANSPORT_DEFAULT_PROVIDER as CarrierProvider) ||
    "webhook";

  const adapter = getCarrierAdapter(selectedProvider);

  const request: TransportShipmentRequest = {
    orderId: order.id,
    provider: adapter.provider,
    pet: {
      name: order.title_snapshot,
      species: "dog",
      breed: order.title_snapshot,
      weightLbs: 35,
    },
    route: {
      pickupRegion: order.pickup_region,
      deliveryRegion: order.delivery_region,
    },
    budget: {
      amountCents: order.transport_cents ?? 0,
      currency: order.currency ?? "usd",
    },
    requirements: {
      climateControlled: true,
      usdaLicensedOnly: true,
      cabinFlightNanny: adapter.provider === "flight_nanny",
      veterinaryHealthCertRequired: true,
    },
  };

  const result = await adapter.dispatch(request);

  return {
    ok: result.ok,
    dispatched: result.dispatched,
    message: result.message,
    provider: result.provider,
    externalJobId: result.externalJobId,
    trackingUrl: result.trackingUrl,
  };
}
