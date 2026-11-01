export type CarrierProvider = "citizenshipper" | "uship" | "flight_nanny" | "webhook";

export interface TransportShipmentRequest {
  orderId: string;
  provider: CarrierProvider;
  pet: {
    name: string | null;
    species: string;
    breed: string | null;
    weightLbs?: number | null;
    healthNotes?: string | null;
  };
  route: {
    pickupRegion: string | null;
    deliveryRegion: string | null;
    pickupAddress?: string | null;
    deliveryAddress?: string | null;
  };
  budget: {
    amountCents: number;
    currency: string;
  };
  requirements: {
    climateControlled?: boolean;
    usdaLicensedOnly?: boolean;
    cabinFlightNanny?: boolean;
    veterinaryHealthCertRequired?: boolean;
  };
}

export interface CarrierDispatchResult {
  ok: boolean;
  dispatched: boolean;
  provider: CarrierProvider;
  externalJobId?: string | null;
  trackingUrl?: string | null;
  message: string;
}

export interface CarrierAdapter {
  provider: CarrierProvider;
  dispatch(request: TransportShipmentRequest): Promise<CarrierDispatchResult>;
}
