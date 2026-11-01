import type { CarrierAdapter, CarrierProvider } from "./types";
import { CitizenShipperAdapter } from "./citizenshipper";
import { UShipAdapter } from "./uship";
import { AirFlightNannyAdapter } from "./air-flight-nanny";
import { GenericWebhookAdapter } from "./webhook";

export * from "./types";
export * from "./citizenshipper";
export * from "./uship";
export * from "./air-flight-nanny";
export * from "./webhook";

export function getCarrierAdapter(provider?: CarrierProvider | string | null): CarrierAdapter {
  const norm = (provider || process.env.TRANSPORT_DEFAULT_PROVIDER || "webhook").toLowerCase();

  switch (norm) {
    case "citizenshipper":
      return new CitizenShipperAdapter();
    case "uship":
      return new UShipAdapter();
    case "flight_nanny":
    case "flightnanny":
      return new AirFlightNannyAdapter();
    case "webhook":
    default:
      return new GenericWebhookAdapter();
  }
}
