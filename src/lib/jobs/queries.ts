import { createClient } from "@/lib/supabase/server";

export type TransportJob = {
  orderId: string;
  status: string;
  title: string | null;
  sellerUsername: string | null;
  buyerUsername: string | null;
  transportCents: number;
  payoutStatus: string | null;
  pickupRegion: string | null;
  deliveryRegion: string | null;
  pickupAddress: string | null;
  pickupContact: string | null;
  deliveryAddress: string | null;
  deliveryContact: string | null;
  /**
   * False until the buyer's money is captured. The job is visible before that —
   * a driver should know work is coming — but where the animal LIVES is not part
   * of "work is coming". People breed at home, and a stranger who can name a
   * booking should not be able to harvest the address.
   */
  addressesVisible: boolean;
  pickedUpAt: string | null;
  handoverAt: string | null;
};

export async function getMyTransportJobs(): Promise<TransportJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_transport_jobs");
  // A driver shown an empty list when the query failed would think they had no
  // work. Better to fail loudly than to quietly cancel someone's day.
  if (error) throw new Error(`transport jobs unavailable: ${error.message}`);

  return ((data ?? []) as {
    order_id: string;
    status: string;
    title_snapshot: string | null;
    seller_username: string | null;
    buyer_username: string | null;
    transport_cents: number;
    payout_status: string | null;
    pickup_region: string | null;
    delivery_region: string | null;
    pickup_address: string | null;
    pickup_contact: string | null;
    delivery_address: string | null;
    delivery_contact: string | null;
    addresses_visible: boolean;
    picked_up_at: string | null;
    handover_at: string | null;
  }[]).map((r) => ({
    orderId: r.order_id,
    status: r.status,
    title: r.title_snapshot,
    sellerUsername: r.seller_username,
    buyerUsername: r.buyer_username,
    transportCents: r.transport_cents,
    payoutStatus: r.payout_status,
    pickupRegion: r.pickup_region,
    deliveryRegion: r.delivery_region,
    pickupAddress: r.pickup_address,
    pickupContact: r.pickup_contact,
    deliveryAddress: r.delivery_address,
    deliveryContact: r.delivery_contact,
    addressesVisible: r.addresses_visible,
    pickedUpAt: r.picked_up_at,
    handoverAt: r.handover_at,
  }));
}

export type InboundTransportQuote = {
  id: string;
  orderId: string | null;
  conversationId: string | null;
  serviceId: string;
  providerId: string;
  requesterId: string;
  requesterUsername: string;
  pickupRegion: string;
  deliveryRegion: string;
  quotedCents: number | null;
  surchargeCents: number;
  payoutPolicySnapshot: string;
  targetPickupDate: string | null;
  status: "requested" | "quoted" | "accepted" | "declined";
  notes: string | null;
  createdAt: string;
};

export async function getInboundTransportQuotes(): Promise<InboundTransportQuote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transport_quotes")
    .select("*, profiles:requester_id (username)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (
    data as unknown as {
      id: string;
      order_id: string | null;
      conversation_id: string | null;
      service_id: string;
      provider_id: string;
      requester_id: string;
      pickup_region: string;
      delivery_region: string;
      quoted_cents: number | null;
      surcharge_cents: number;
      payout_policy_snapshot: string;
      target_pickup_date: string | null;
      status: "requested" | "quoted" | "accepted" | "declined";
      notes: string | null;
      created_at: string;
      profiles: { username: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    conversationId: r.conversation_id,
    serviceId: r.service_id,
    providerId: r.provider_id,
    requesterId: r.requester_id,
    requesterUsername: r.profiles?.username ?? "client",
    pickupRegion: r.pickup_region,
    deliveryRegion: r.delivery_region,
    quotedCents: r.quoted_cents,
    surchargeCents: r.surcharge_cents,
    payoutPolicySnapshot: r.payout_policy_snapshot,
    targetPickupDate: r.target_pickup_date,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}
