import type { CarrierAdapter, CarrierDispatchResult, TransportShipmentRequest } from "./types";

export class GenericWebhookAdapter implements CarrierAdapter {
  provider = "webhook" as const;

  async dispatch(req: TransportShipmentRequest): Promise<CarrierDispatchResult> {
    const webhookUrl =
      process.env.TRANSPORT_DISPATCH_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_TRANSPORT_DISPATCH_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        ok: true,
        dispatched: false,
        provider: this.provider,
        message: "Transport dispatch recorded (awaiting carrier webhook configuration in environment).",
      };
    }

    const payload = {
      orderId: req.orderId,
      event: "job.created",
      timestamp: new Date().toISOString(),
      route: {
        pickupRegion: req.route.pickupRegion,
        deliveryRegion: req.route.deliveryRegion,
        pickupAddress: req.route.pickupAddress,
        deliveryAddress: req.route.deliveryAddress,
      },
      details: {
        title: req.pet.name ? `${req.pet.name} (${req.pet.breed})` : req.pet.breed,
        species: req.pet.species,
        transportCents: req.budget.amountCents,
        currency: req.budget.currency,
        fulfilment: "transported",
      },
      requirements: req.requirements,
    };

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
        provider: this.provider,
        message: res.ok
          ? "Job successfully dispatched to 3rd-party carrier network."
          : `Carrier endpoint returned status ${res.status}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        dispatched: false,
        provider: this.provider,
        message: `Failed to connect to carrier dispatch network: ${message}`,
      };
    }
  }
}
