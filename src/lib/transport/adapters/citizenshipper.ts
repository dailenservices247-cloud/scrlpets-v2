import type { CarrierAdapter, CarrierDispatchResult, TransportShipmentRequest } from "./types";

export class CitizenShipperAdapter implements CarrierAdapter {
  provider = "citizenshipper" as const;

  async dispatch(req: TransportShipmentRequest): Promise<CarrierDispatchResult> {
    const apiKey = process.env.CITIZENSHIPPER_API_KEY;
    const apiUrl =
      process.env.CITIZENSHIPPER_API_URL ||
      "https://api.citizenshipper.com/v2/shipments";

    if (!apiKey) {
      return {
        ok: true,
        dispatched: false,
        provider: this.provider,
        message: "CitizenShipper adapter ready (awaiting CITIZENSHIPPER_API_KEY in environment).",
      };
    }

    const payload = {
      shipment: {
        category: "pets",
        sub_category: req.pet.species || "dog",
        title: `Animal Transit: ${req.pet.name || req.pet.breed || "Pet"} from ${req.route.pickupRegion || "Origin"} to ${req.route.deliveryRegion || "Destination"}`,
        origin: {
          location_name: req.route.pickupRegion,
          address: req.route.pickupAddress || req.route.pickupRegion,
        },
        destination: {
          location_name: req.route.deliveryRegion,
          address: req.route.deliveryAddress || req.route.deliveryRegion,
        },
        pet_details: {
          name: req.pet.name,
          species: req.pet.species,
          breed: req.pet.breed,
          weight_lbs: req.pet.weightLbs ?? 25,
          health_cert: req.requirements.veterinaryHealthCertRequired ?? true,
        },
        budget: req.budget.amountCents > 0 ? req.budget.amountCents / 100 : null,
        requirements: {
          usda_registered: req.requirements.usdaLicensedOnly ?? true,
          climate_controlled: req.requirements.climateControlled ?? true,
          direct_route: true,
        },
        metadata: {
          scrlpets_order_id: req.orderId,
        },
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
          "User-Agent": "Scrlpets-CitizenShipper-Adapter/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        tracking_url?: string;
        message?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          dispatched: false,
          provider: this.provider,
          message: data.message || `CitizenShipper returned status ${res.status}`,
        };
      }

      return {
        ok: true,
        dispatched: true,
        provider: this.provider,
        externalJobId: data.id ?? null,
        trackingUrl: data.tracking_url ?? null,
        message: "Pet shipment posted successfully to CitizenShipper courier network.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        dispatched: false,
        provider: this.provider,
        message: `Failed to post to CitizenShipper: ${message}`,
      };
    }
  }
}
