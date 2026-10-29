"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePriceCents } from "@/lib/compose/validation";
import { sendMessage, startConversation } from "@/lib/messaging/actions";
import { formatPrice } from "@/lib/shop/format";
import { SERVICE_CATEGORIES } from "./categories";

export type ServiceActionResult = { ok: true } | { ok: false; error: string };

type ServiceFields = {
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number | null;
  area: string | null;
  contact_note: string | null;
  media_url: string | null;
  booking_enabled: boolean;
  deposit_required: boolean;
  deposit_amount_cents: number | null;
  service_tier_rates: unknown[];
  booking_notice: string | null;
};

/**
 * One shape check for create and edit. Price is optional because "contact for
 * a quote" is normal in this trade — empty means null, anything typed must be
 * a real positive amount (parsePriceCents refuses 0 and junk).
 */
function parseServiceFields(formData: FormData): ServiceFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "name" };
  const rawCategory = String(formData.get("category") ?? "");
  const category = (SERVICE_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory
    : null;
  const rawPrice = String(formData.get("price") ?? "").trim();
  let priceCents: number | null = null;
  if (rawPrice !== "") {
    priceCents = parsePriceCents(rawPrice);
    if (priceCents === null) return { error: "price" };
  }
  const bounded = (key: string, max: number) => {
    const value = String(formData.get(key) ?? "").trim();
    return value ? value.slice(0, max) : null;
  };

  const bookingEnabled = formData.get("bookingEnabled") !== "false";
  const depositRequired = formData.get("depositRequired") === "true";
  const rawDeposit = String(formData.get("depositAmount") ?? "").trim();
  let depositAmountCents: number | null = null;
  if (rawDeposit !== "") {
    depositAmountCents = parsePriceCents(rawDeposit);
  }

  let serviceTierRates: unknown[] = [];
  const rawTiers = String(formData.get("serviceTierRates") ?? "").trim();
  if (rawTiers) {
    try {
      const parsed = JSON.parse(rawTiers);
      if (Array.isArray(parsed)) {
        serviceTierRates = parsed;
      }
    } catch {
      // ignore JSON parse error
    }
  }

  return {
    name,
    description: bounded("description", 1000),
    category,
    price_cents: priceCents,
    area: bounded("area", 120),
    contact_note: bounded("contactNote", 300),
    media_url: bounded("mediaUrl", 500),
    booking_enabled: bookingEnabled,
    deposit_required: depositRequired,
    deposit_amount_cents: depositAmountCents,
    service_tier_rates: serviceTierRates,
    booking_notice: bounded("bookingNotice", 500),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

function revalidateServiceSurfaces() {
  revalidatePath("/brand-os");
  // /services is a redirect now; the public providers surface is the market's
  // Services tab, so revalidating the old path would refresh nothing.
  revalidatePath("/market");
}

/** Full marketplace record. RLS enforces owner + brand-manager on the insert. */
export async function createProviderService(
  formData: FormData,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseServiceFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };
  const brandId = (formData.get("brandId") as string) || null;

  const { error } = await ctx.supabase
    .from("services")
    .insert({ owner_id: ctx.user.id, brand_id: brandId, ...fields });
  if (error) return { ok: false, error: error.message };
  revalidateServiceSurfaces();
  return { ok: true };
}

/**
 * Owner-only by RLS ("owner updates services"); a non-owner update matches 0
 * rows and reports not_found rather than pretending it saved.
 */
export async function updateProviderService(
  serviceId: string,
  formData: FormData,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseServiceFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { count, error } = await ctx.supabase
    .from("services")
    .update({ ...fields, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", serviceId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateServiceSurfaces();
  return { ok: true };
}

/** Retire/reactivate. Retiring keeps the row — history beats deletion. */
export async function setServiceActive(
  serviceId: string,
  active: boolean,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { count, error } = await ctx.supabase
    .from("services")
    .update({ active, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", serviceId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateServiceSurfaces();
  return { ok: true };
}

export type ServiceInquiryResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: string };

/**
 * V3-01: mirrors marketplace's start_listing_inquiry shape (create-or-reuse
 * conversation, self-inquiry refused) but stays app-code only — no new table
 * or RPC. The "evidence" listing_inquiries gives for free isn't available
 * here, so the opening message body carries the service reference instead.
 */
export async function startServiceInquiry(serviceId: string): Promise<ServiceInquiryResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { supabase, user } = ctx;

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id,name,category,price_cents,currency,owner_id")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();
  if (serviceError) return { ok: false, error: serviceError.message };
  if (!service) return { ok: false, error: "service_unavailable" };
  if (service.owner_id === user.id) return { ok: false, error: "self_inquiry" };

  const conversation = await startConversation(service.owner_id);
  if ("error" in conversation) return { ok: false, error: conversation.error };

  const category = service.category
    ? service.category.charAt(0).toUpperCase() + service.category.slice(1)
    : null;
  const price =
    service.price_cents && service.price_cents > 0
      ? ` — ${formatPrice(service.price_cents, service.currency)}`
      : "";
  const body = `Hi, I'm interested in your service "${service.name}"${
    category ? ` (${category})` : ""
  }${price}.`;

  // ponytail: always (re)sends the opening line on every click. The spec only
  // requires conversation-level idempotency (no duplicate conversation), and
  // there's no service_inquiries snapshot table to dedupe against without a
  // migration, so a second click resends rather than silently no-op-ing.
  const sent = await sendMessage(conversation.id, body);
  if (!sent.ok) return { ok: false, error: sent.error };

  return { ok: true, conversationId: conversation.id };
}

export type BookingRequestInput = {
  tierName?: string | null;
  tierPriceCents?: number | null;
  preferredDate: string;
  preferredTimeWindow?: string | null;
  creatureName?: string | null;
  clientNotes?: string | null;
};

export async function requestServiceBooking(
  serviceId: string,
  input: BookingRequestInput,
): Promise<ServiceInquiryResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { supabase, user } = ctx;

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id,name,category,price_cents,currency,owner_id,deposit_required,deposit_amount_cents,brands(name)")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();

  if (serviceError) return { ok: false, error: serviceError.message };
  if (!service) return { ok: false, error: "service_unavailable" };
  if (service.owner_id === user.id) return { ok: false, error: "self_booking" };

  const conversation = await startConversation(service.owner_id);
  if ("error" in conversation) return { ok: false, error: conversation.error };

  const providerName = (service.brands as unknown as { name: string } | null)?.name ?? "Provider";
  const selectedPrice = input.tierPriceCents ?? service.price_cents;
  const priceDisplay =
    selectedPrice && selectedPrice > 0 ? formatPrice(selectedPrice, service.currency) : "Custom quote";
  const depositDisplay =
    service.deposit_required && service.deposit_amount_cents && service.deposit_amount_cents > 0
      ? `• Deposit Required: ${formatPrice(service.deposit_amount_cents, service.currency)}`
      : null;

  const lines = [
    `📅 BOOKING REQUEST — ${service.name}`,
    input.tierName ? `• Package: ${input.tierName} (${priceDisplay})` : `• Rate: ${priceDisplay}`,
    `• Preferred Date: ${input.preferredDate}${input.preferredTimeWindow ? ` (${input.preferredTimeWindow})` : ""}`,
    input.creatureName ? `• Animal / Subject: ${input.creatureName}` : null,
    depositDisplay,
    input.clientNotes ? `• Notes: "${input.clientNotes.trim()}"` : null,
    `\nHi ${providerName}, I would like to book this service. Please confirm availability and send a quote or deposit request.`,
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendMessage(conversation.id, lines);
  if (!sent.ok) return { ok: false, error: sent.error };

  return { ok: true, conversationId: conversation.id };
}
