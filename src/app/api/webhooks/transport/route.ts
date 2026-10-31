import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface TransportWebhookBody {
  orderId: string;
  event: "driver_assigned" | "picked_up" | "in_transit" | "arrived" | "completed";
  timestamp?: string;
  driver?: {
    name: string;
    phone?: string;
    vehicle?: string;
    usdaNumber?: string;
  };
  location?: string;
  notes?: string;
  estimatedArrival?: string;
}

export async function POST(request: Request) {
  const secret = process.env.TRANSPORT_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("Authorization") || request.headers.get("X-Scrlpets-Transport-Secret");
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: TransportWebhookBody;
  try {
    body = (await request.json()) as TransportWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { orderId, event, driver, location, notes, estimatedArrival } = body;
  if (!orderId || !event) {
    return NextResponse.json({ error: "missing_order_or_event" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);

  // Verify order exists
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status, title_snapshot")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  // Format notification body based on event
  let messageBody = "";
  switch (event) {
    case "driver_assigned":
      messageBody = `🚐 3rd-Party Carrier Assigned: ${driver?.name || "Verified Courier"}${
        driver?.vehicle ? ` (${driver.vehicle})` : ""
      }${driver?.phone ? ` • Contact: ${driver.phone}` : ""}${
        estimatedArrival ? ` • Est. Pickup: ${estimatedArrival}` : ""
      }`;
      break;

    case "picked_up":
      messageBody = `📍 Animal Picked Up: Courier has physically verified the microchip and CVI health certificate at the kennel. Active transit is in progress.${
        notes ? ` Note: "${notes}"` : ""
      }`;
      break;

    case "in_transit":
      messageBody = `🛣️ In-Transit Waypoint Update: ${location || "En route"}${
        notes ? ` — ${notes}` : ""
      }${estimatedArrival ? ` • Est. Delivery: ${estimatedArrival}` : ""}`;
      break;

    case "arrived":
      messageBody = `🏡 Courier Arrived at Delivery Address: Driver is ready for the buyer's 6-digit handover code. Please meet the driver at the door to inspect your pet and complete handover.`;
      break;

    case "completed":
      messageBody = `✅ Delivery Completed: Physical handover confirmed by 3rd-party courier. 48-hour veterinary inspection window is now active.`;
      break;

    default:
      messageBody = `📦 Transport Status Update: ${event} ${notes ? `— ${notes}` : ""}`;
  }

  // Post to order thread
  const { error: postErr } = await supabase.rpc("post_order_message", {
    target_order: orderId,
    body: messageBody,
  });

  if (postErr) {
    return NextResponse.json({ error: "failed_to_post_update", details: postErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: true, event });
}
