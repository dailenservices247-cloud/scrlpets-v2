import { createClient } from "@/lib/supabase/server";

export type DealContract = {
  id: string;
  conversationId: string | null;
  listingId: string;
  creatureId: string | null;
  sellerId: string;
  buyerId: string;
  agreedPriceCents: number;
  depositCents: number;
  depositPolicySnapshot: string;
  guaranteeHeadlineSnapshot: string;
  guaranteeBodySnapshot: string;
  guaranteeRemedySnapshot: string | null;
  goHomeDate: string | null;
  contractTermsSnapshot: string;
  sellerSignature: string;
  sellerSignedAt: string;
  buyerSignature: string | null;
  buyerSignedAt: string | null;
  orderId: string | null;
  status: "sent" | "signed" | "cancelled";
  createdAt: string;
};

export type StandingPolicy = {
  profileId: string;
  brandId: string | null;
  depositRefundablePolicy: string;
  defaultDepositBps: number;
  defaultGuaranteeKey: string | null;
  contractDisclosureTerms: string;
  lockedUntil: string;
  updatedAt: string;
};

export type SellerComplianceProfile = {
  profileId: string;
  legalEntityName: string;
  businessRegistrationNumber: string | null;
  jurisdictionState: string;
  registeredAddress: string;
  insuranceCarrier: string | null;
  insurancePolicyNumber: string | null;
  dotMcNumber: string | null;
  documentUrls: string[];
  attestedLiabilityShieldAt: string;
};

export type CounterpartyDossier = {
  order_id: string;
  status: string;
  title_snapshot: string;
  amount_cents: number;
  deposit_cents: number;
  transport_cents: number;
  transport_surcharge_cents: number;
  currency: string;
  fulfilment: string;
  created_at: string;
  picked_up_at: string | null;
  handover_at: string | null;
  delivered_at: string | null;
  contract: {
    contract_id: string;
    status: string;
    agreed_price_cents: number;
    deposit_cents: number;
    deposit_policy: string;
    guarantee_headline: string;
    guarantee_body: string;
    guarantee_remedy: string | null;
    go_home_date: string | null;
    terms: string;
    seller_signature: string;
    seller_signed_at: string;
    buyer_signature: string | null;
    buyer_signed_at: string | null;
  } | null;
  seller: {
    username: string;
    legal_entity_name: string | null;
    registration_number: string | null;
    state: string | null;
    registered_address: string | null;
    insurance_carrier: string | null;
    insurance_policy_number: string | null;
  };
  buyer: {
    username: string;
  };
  transporter: {
    username: string;
    legal_entity_name: string | null;
    state: string | null;
    dot_mc_number: string | null;
    payout_policy: string;
    credential_number: string | null;
    issuing_authority: string | null;
  } | null;
  creature: {
    id: string;
    name: string;
    species: string | null;
    anchor_type: string | null;
  } | null;
  ledger: {
    due_cents: number;
    captured_cents: number;
    buyer_fee_cents: number;
    seller_fee_cents: number;
    payout_legs_count: number;
  };
  audit: {
    immutable_events_count: number;
  };
};

export async function getDealContractsForConversation(conversationId: string): Promise<DealContract[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_contracts")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as {
    id: string;
    conversation_id: string | null;
    listing_id: string;
    creature_id: string | null;
    seller_id: string;
    buyer_id: string;
    agreed_price_cents: number;
    deposit_cents: number;
    deposit_policy_snapshot: string;
    guarantee_headline_snapshot: string;
    guarantee_body_snapshot: string;
    guarantee_remedy_snapshot: string | null;
    go_home_date: string | null;
    contract_terms_snapshot: string;
    seller_signature: string;
    seller_signed_at: string;
    buyer_signature: string | null;
    buyer_signed_at: string | null;
    order_id: string | null;
    status: "sent" | "signed" | "cancelled";
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    listingId: r.listing_id,
    creatureId: r.creature_id,
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    agreedPriceCents: r.agreed_price_cents,
    depositCents: r.deposit_cents,
    depositPolicySnapshot: r.deposit_policy_snapshot,
    guaranteeHeadlineSnapshot: r.guarantee_headline_snapshot,
    guaranteeBodySnapshot: r.guarantee_body_snapshot,
    guaranteeRemedySnapshot: r.guarantee_remedy_snapshot,
    goHomeDate: r.go_home_date,
    contractTermsSnapshot: r.contract_terms_snapshot,
    sellerSignature: r.seller_signature,
    sellerSignedAt: r.seller_signed_at,
    buyerSignature: r.buyer_signature,
    buyerSignedAt: r.buyer_signed_at,
    orderId: r.order_id,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export type TransportQuoteItem = {
  id: string;
  conversationId: string | null;
  serviceId: string;
  providerId: string;
  providerUsername: string | null;
  requesterId: string;
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

export async function getTransportQuotesForConversation(
  conversationId: string,
): Promise<TransportQuoteItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transport_quotes")
    .select(
      "id,conversation_id,service_id,provider_id,requester_id,pickup_region,delivery_region,quoted_cents,surcharge_cents,payout_policy_snapshot,target_pickup_date,status,notes,created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    id: string;
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
    status: TransportQuoteItem["status"];
    notes: string | null;
    created_at: string;
  }[];

  if (rows.length === 0) return [];
  const providerIds = [...new Set(rows.map((r) => r.provider_id))];
  const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", providerIds);
  const nameMap = new Map(((profiles ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]));

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    serviceId: r.service_id,
    providerId: r.provider_id,
    providerUsername: nameMap.get(r.provider_id) ?? null,
    requesterId: r.requester_id,
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

export async function getStandingPolicy(profileId: string): Promise<StandingPolicy | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_standing_policies")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data) return null;
  const r = data as {
    profile_id: string;
    brand_id: string | null;
    deposit_refundable_policy: string;
    default_deposit_bps: number;
    default_guarantee_key: string | null;
    contract_disclosure_terms: string;
    locked_until: string;
    updated_at: string;
  };
  return {
    profileId: r.profile_id,
    brandId: r.brand_id,
    depositRefundablePolicy: r.deposit_refundable_policy,
    defaultDepositBps: r.default_deposit_bps,
    defaultGuaranteeKey: r.default_guarantee_key,
    contractDisclosureTerms: r.contract_disclosure_terms,
    lockedUntil: r.locked_until,
    updatedAt: r.updated_at,
  };
}

export async function getSellerComplianceProfile(profileId: string): Promise<SellerComplianceProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_compliance_profiles")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data) return null;
  const r = data as {
    profile_id: string;
    legal_entity_name: string;
    business_registration_number: string | null;
    jurisdiction_state: string;
    registered_address: string;
    insurance_carrier: string | null;
    insurance_policy_number: string | null;
    dot_mc_number: string | null;
    document_urls: string[];
    attested_liability_shield_at: string;
  };
  return {
    profileId: r.profile_id,
    legalEntityName: r.legal_entity_name,
    businessRegistrationNumber: r.business_registration_number,
    jurisdictionState: r.jurisdiction_state,
    registeredAddress: r.registered_address,
    insuranceCarrier: r.insurance_carrier,
    insurancePolicyNumber: r.insurance_policy_number,
    dotMcNumber: r.dot_mc_number,
    documentUrls: r.document_urls,
    attestedLiabilityShieldAt: r.attested_liability_shield_at,
  };
}

export async function getOrderCounterpartyDossier(orderId: string): Promise<CounterpartyDossier | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_counterparty_dossier", { target_order: orderId });
  if (error || !data) return null;
  return data as CounterpartyDossier;
}

export type TransportServiceOption = {
  id: string;
  name: string;
  priceCents: number | null;
  area: string | null;
  providerUsername: string | null;
};

export async function getAvailableTransportServices(): Promise<TransportServiceOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id,name,price_cents,area,profiles!services_owner_id_fkey(username)")
    .eq("active", true)
    .eq("category", "transport")
    .limit(20);

  if (!data) return [];
  const rows = data as unknown as Array<{
    id: string;
    name: string;
    price_cents: number | null;
    area: string | null;
    profiles: { username: string } | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    priceCents: r.price_cents,
    area: r.area,
    providerUsername: r.profiles?.username ?? null,
  }));
}

