import type { CarrierAdapter, CarrierDispatchResult, TransportShipmentRequest } from "./types";

export class AirFlightNannyAdapter implements CarrierAdapter {
  provider = "flight_nanny" as const;

  async dispatch(req: TransportShipmentRequest): Promise<CarrierDispatchResult> {
    const nannyEndpoint =
      process.env.FLIGHT_NANNY_DISPATCH_URL ||
      process.env.TRANSPORT_FLIGHT_NANNY_URL;
    const nannyApiKey = process.env.FLIGHT_NANNY_API_KEY;

    if (!nannyEndpoint) {
      return {
        ok: true,
        dispatched: false,
        provider: this.provider,
        message: "Air Flight Nanny adapter ready (awaiting FLIGHT_NANNY_DISPATCH_URL in environment).",
      };
    }

    const payload = {
      orderId: req.orderId,
      transitType: "in_cabin_flight_nanny",
      pet: {
        name: req.pet.name,
        breed: req.pet.breed,
        species: req.pet.species,
        weightLbs: req.pet.weightLbs ?? 15,
        crateTrained: true,
      },
      airports: {
        departureState: req.route.pickupRegion,
        destinationState: req.route.deliveryRegion,
      },
      compensation: {
        budgetCents: req.budget.amountCents,
        currency: req.budget.currency,
      },
      requirements: {
        inCabinOnly: true,
        cviRequired: true,
      },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(nannyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(nannyApiKey ? { Authorization: `Bearer ${nannyApiKey}` } : {}),
          "User-Agent": "Scrlpets-FlightNanny-Adapter/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = (await res.json().catch(() => ({}))) as {
        flightJobId?: string;
        message?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          dispatched: false,
          provider: this.provider,
          message: data.message || `Flight nanny dispatcher returned status ${res.status}`,
        };
      }

      return {
        ok: true,
        dispatched: true,
        provider: this.provider,
        externalJobId: data.flightJobId ?? null,
        message: "Flight nanny transit request routed to flight courier network.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        dispatched: false,
        provider: this.provider,
        message: `Failed to dispatch flight nanny: ${message}`,
      };
    }
  }
}
