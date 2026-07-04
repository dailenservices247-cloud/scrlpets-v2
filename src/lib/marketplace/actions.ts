"use server";

import { createClient } from "@/lib/supabase/server";

export type StartInquiryResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; error: string };

export async function startListingInquiry(
  listingId: string,
): Promise<StartInquiryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (!listingId) return { ok: false, error: "listing_unavailable" };

  const { data, error } = await supabase.rpc("start_listing_inquiry", {
    target_listing_id: listingId,
  });
  if (error) return { ok: false, error: error.message };

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.conversation_id) {
    return { ok: false, error: "inquiry_failed" };
  }

  return {
    ok: true,
    conversationId: result.conversation_id,
    created: Boolean(result.created),
  };
}
