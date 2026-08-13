"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrderMessage = {
  id: string;
  senderId: string;
  senderUsername: string | null;
  senderRole: "buyer" | "seller" | "transporter" | "former_party";
  body: string;
  createdAt: string;
};

/**
 * The order's thread. Membership is derived from the order itself — you are in
 * it if you are the buyer, the seller, or the transporter — so a driver booked
 * later can read what was already said, and nobody can add themselves.
 */
export async function getOrderThread(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_thread", { target_order: orderId });
  // An empty thread and an unreadable one look identical to a caller. Say which.
  if (error) throw new Error(`order thread unavailable: ${error.message}`);

  return ((data ?? []) as {
    id: string;
    sender_id: string;
    sender_username: string | null;
    sender_role: OrderMessage["senderRole"];
    body: string;
    created_at: string;
  }[]).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    senderUsername: m.sender_username,
    senderRole: m.sender_role,
    body: m.body,
    createdAt: m.created_at,
  }));
}

export type PostResult = { ok: true } | { ok: false; error: string };

export async function postOrderMessage(orderId: string, body: string): Promise<PostResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_order_message", {
    target_order: orderId,
    body,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
