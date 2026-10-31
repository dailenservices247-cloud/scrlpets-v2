import { createAnonClient } from "@/lib/supabase/anon";

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
}

/**
 * Dispatches an animal transportation job to an external 3rd-party courier network
 * (e.g. CitizenShipper, uShip, or certified airline flight nanny dispatch).
 */
export async function dispatchTransportJob(orderId: string): Promise<DispatchResult> {
  const supabase = createAnonClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id,title_snapshot,transport_cents,currency,fulfilment,pickup_region,delivery_region,status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, dispatched: false, message: "Order not found" };
  }

  if (order.fulfilment !== "transported") {
    return { ok: true, dispatched: false, message: "Order is not marked for transport" };
  }

  const webhookUrl =
    process.env.TRANSPORT_DISPATCH_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_TRANSPORT_DISPATCH_WEBHOOK_URL;

  const payload: TransportJobPayload = {
    orderId: order.id,
    event: "job.created",
    timestamp: new Date().toISOString(),
    route: {
      pickupRegion: order.pickup_region,
      deliveryRegion: order.delivery_region,
    },
    details: {
      title: order.title_snapshot,
      transportCents: order.transport_cents ?? 0,
      currency: order.currency ?? "usd",
      fulfilment: order.fulfilment,
    },
  };

  if (!webhookUrl) {
    // Ready for integration; records readiness when webhook is configured in env
    return {
      ok: true,
      dispatched: false,
      message: "Transport dispatch recorded (awaiting carrier webhook configuration in environment).",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Scrlpets-Transport-Dispatcher/1.0",
        ...(process.env.TRANSPORT_DISPATCH_SECRET
          ? { "X-Scrlpets-Transport-Signature": process.env.TRANSPORT_DISPATCH_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      ok: res.ok,
      dispatched: true,
      message: res.ok
        ? "Job successfully dispatched to 3rd-party carrier network."
        : `Carrier endpoint returned status ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      dispatched: false,
      message: `Failed to connect to carrier dispatch network: ${message}`,
    };
  }
}
