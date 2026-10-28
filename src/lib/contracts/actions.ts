"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationToUser } from "@/lib/support/email";

export type ContractResult = { ok: true; contractId?: string; orderId?: string } | { ok: false; error: string };

export async function sendDealContract(
  conversationId: string,
  listingId: string,
  agreedPriceCents: number,
  depositCents: number,
  goHomeDate: string,
  customNotes?: string,
  sellerSignature?: string,
): Promise<ContractResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_deal_contract", {
    target_conversation: conversationId,
    target_listing: listingId,
    agreed_price: agreedPriceCents,
    deposit_amount: depositCents,
    go_home: goHomeDate || null,
    custom_notes: customNotes ?? null,
    seller_sig: sellerSignature ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/messages/${conversationId}`);

  // Transactional Email notification (silent if not configured)
  try {
    const { data: contract } = await supabase
      .from("deal_contracts")
      .select("buyer_id, seller_id, agreed_price_cents, deposit_cents")
      .eq("id", data)
      .maybeSingle();

    if (contract) {
      await sendNotificationToUser(contract.buyer_id, {
        subject: "New Animal Contract Offer on Scrlpets",
        headline: "You have received a deal contract offer",
        bodyLines: [
          `A seller has drafted a deal contract for $${(contract.agreed_price_cents / 100).toFixed(2)}.`,
          `Deposit required: $${(contract.deposit_cents / 100).toFixed(2)}.`,
          "Review the contract terms, health disclosures, and sign in the Deal Room.",
        ],
        ctaUrl: `https://scrlpets.com/messages/${conversationId}`,
        ctaText: "Review Contract in Deal Room",
      });
    }
  } catch {}

  return { ok: true, contractId: data as string };
}

export async function signDealContract(
  contractId: string,
  buyerSignature: string,
  transportChoice?: {
    serviceId: string;
    pickupRegion: string;
    deliveryRegion: string;
  },
): Promise<ContractResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sign_deal_contract", {
    target_contract: contractId,
    buyer_sig: buyerSignature,
    transport_service: transportChoice?.serviceId ?? null,
    pickup_region: transportChoice?.pickupRegion ?? null,
    delivery_region: transportChoice?.deliveryRegion ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  revalidatePath("/applications");
  revalidatePath("/orders");

  // Transactional Email notification (silent if not configured)
  try {
    const { data: contract } = await supabase
      .from("deal_contracts")
      .select("buyer_id, seller_id, agreed_price_cents, order_id")
      .eq("id", contractId)
      .maybeSingle();

    if (contract) {
      await sendNotificationToUser(contract.seller_id, {
        subject: "Contract Signed & Deal Struck on Scrlpets",
        headline: "Your buyer has signed the contract!",
        bodyLines: [
          `The deal contract has been signed by both parties for $${(contract.agreed_price_cents / 100).toFixed(2)}.`,
          "The order has been created. The buyer has been prompted to fund their escrow deposit.",
        ],
        ctaUrl: `https://scrlpets.com/orders/${data}`,
        ctaText: "View Order & Escrow Status",
      });
    }
  } catch {}

  return { ok: true, orderId: data as string };
}

export async function saveStandingPolicy(
  depositPolicy: string,
  depositBps: number,
  contractTerms: string,
  guaranteeKey?: string,
  brandId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_seller_standing_policy", {
    target_deposit_policy: depositPolicy,
    target_deposit_bps: depositBps,
    target_guarantee_key: guaranteeKey ?? null,
    target_contract_terms: contractTerms,
    target_brand: brandId ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/verification");
  return { ok: true };
}

export async function requestTransportQuote(
  serviceId: string,
  pickupRegion: string,
  deliveryRegion: string,
  targetDate?: string,
  notes?: string,
  orderId?: string,
  conversationId?: string,
): Promise<{ ok: boolean; quoteId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_transport_quote", {
    service_id: serviceId,
    pickup_reg: pickupRegion,
    delivery_reg: deliveryRegion,
    target_date: targetDate ?? null,
    req_notes: notes ?? null,
    target_order: orderId ?? null,
    target_conv: conversationId ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (orderId) revalidatePath(`/orders/${orderId}`);
  return { ok: true, quoteId: data as string };
}

export async function respondTransportQuote(
  quoteId: string,
  quotedPriceCents: number,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_transport_quote", {
    quote_id: quoteId,
    quoted_price: quotedPriceCents,
    response_notes: notes ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acceptTransportQuote(quoteId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_transport_quote", {
    quote_id: quoteId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveComplianceProfile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const legalName = String(formData.get("legalEntityName") ?? "").trim();
  const regNumber = String(formData.get("businessRegistrationNumber") ?? "").trim();
  const stateCode = String(formData.get("jurisdictionState") ?? "").trim();
  const address = String(formData.get("registeredAddress") ?? "").trim();
  const insuranceCo = String(formData.get("insuranceCarrier") ?? "").trim();
  const policyNum = String(formData.get("insurancePolicyNumber") ?? "").trim();
  const dotNum = String(formData.get("dotMcNumber") ?? "").trim();

  const { error } = await supabase.rpc("upsert_seller_compliance_profile", {
    legal_name: legalName,
    reg_num: regNumber || null,
    state_code: stateCode,
    address,
    insurance_co: insuranceCo || null,
    policy_num: policyNum || null,
    dot_num: dotNum || null,
    doc_urls: [],
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/verification");
  return { ok: true };
}
