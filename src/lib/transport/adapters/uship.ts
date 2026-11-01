import type { CarrierAdapter, CarrierDispatchResult, TransportShipmentRequest } from "./types";

export class UShipAdapter implements CarrierAdapter {
  provider = "uship" as const;

  async dispatch(req: TransportShipmentRequest): Promise<CarrierDispatchResult> {
    const apiKey = process.env.USHIP_API_KEY;
    const apiUrl =
      process.env.USHIP_API_URL ||
      "https://api.uship.com/v2/listings";

    if (!apiKey) {
      return {
        ok: true,
        dispatched: false,
        provider: this.provider,
        message: "uShip adapter ready (awaiting USHIP_API_KEY in environment).",
      };
    }

    const payload = {
      listing: {
        commodityCategory: "Animals & Pets",
        title: `Pet Transportation: ${req.pet.name || req.pet.breed || "Dog"} (${req.route.pickupRegion} -> ${req.route.deliveryRegion})`,
        route: {
          origin: {
            stateOrProvince: req.route.pickupRegion,
            formattedAddress: req.route.pickupAddress || req.route.pickupRegion,
          },
          destination: {
            stateOrProvince: req.route.deliveryRegion,
            formattedAddress: req.route.deliveryAddress || req.route.deliveryRegion,
          },
        },
        items: [
          {
            description: `${req.pet.breed || "Live Pet"} (${req.pet.species})`,
            weightPounds: req.pet.weightLbs ?? 30,
            specialCare: "USDA Registered Pet Transporter Only. Live dog in-transit.",
          },
        ],
        targetPriceCents: req.budget.amountCents > 0 ? req.budget.amountCents : null,
        referenceId: req.orderId,
      },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "Scrlpets-uShip-Adapter/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = (await res.json().catch(() => ({}))) as {
        listingNumber?: string;
        publicUrl?: string;
        error?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          dispatched: false,
          provider: this.provider,
          message: data.error || `uShip API returned status ${res.status}`,
        };
      }

      return {
        ok: true,
        dispatched: true,
        provider: this.provider,
        externalJobId: data.listingNumber ?? null,
        trackingUrl: data.publicUrl ?? null,
        message: "Listing successfully created on uShip transport network.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        dispatched: false,
        provider: this.provider,
        message: `Failed to connect to uShip: ${message}`,
      };
    }
  }
}
