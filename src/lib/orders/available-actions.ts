/**
 * Which controls an order shows, and to whom.
 *
 * Pure on purpose. Every rule below mirrors a guard that already exists in a
 * security-definer function, and the database remains the authority — this only
 * decides what to RENDER. When the two disagree the database is right, which is
 * why the panel shows the database's refusal verbatim rather than hiding it.
 *
 * Kept out of the component so it can be tested against the guards exhaustively
 * without a browser, a session, or a row.
 */

export type Fulfilment = "in_person" | "transported" | "shipped";

export type OrderView = {
  status: string;
  fulfilment: Fulfilment;
  buyerId: string;
  sellerId: string;
  transporterId: string | null;
  pickedUpAt: string | null;
  animalReturnedAt: string | null;
};

export type OrderActionKind =
  | "set_pickup_address"
  | "set_delivery_address"
  | "mark_dispatched"
  | "record_shipment"
  | "confirm_pickup"
  | "confirm_handover"
  | "show_handover_code"
  | "accept_delivery"
  | "dispute"
  | "confirm_animal_returned"
  | "cancel";

/** `set_order_addresses` raises `order_closed` on exactly these three. */
const CLOSED = new Set(["released", "refunded", "cancelled"]);

/** The statuses `dispute_order` accepts — anything with money actually held. */
const DISPUTABLE = new Set(["deposit_held", "funds_held", "dispatched", "inspection"]);

/** `advance_order` permits cancellation from these two, by either party. */
const CANCELLABLE = new Set(["draft", "awaiting_payment"]);

export function availableActions(order: OrderView, viewerId: string): OrderActionKind[] {
  const isBuyer = viewerId === order.buyerId;
  const isSeller = viewerId === order.sellerId;
  // A transporter drives their leg from /jobs, not from here: the order page
  // would have to reveal both parties to them to be useful, and the address
  // reveal is deliberately narrower than that.
  if (!isBuyer && !isSeller) return [];
  if (CLOSED.has(order.status)) return [];

  const actions: OrderActionKind[] = [];

  if (isSeller) actions.push("set_pickup_address");
  if (isBuyer) actions.push("set_delivery_address");

  if (isSeller && order.status === "funds_held") {
    if (order.fulfilment === "in_person") actions.push("mark_dispatched");
    if (order.fulfilment === "shipped") actions.push("record_shipment");
    if (order.fulfilment === "transported") actions.push("confirm_pickup");
  }

  // Only in_person ends at a meeting the SELLER attends. On a transported order
  // the driver enters the code at the door; on a shipped one nobody meets.
  if (isSeller && order.status === "dispatched" && order.fulfilment === "in_person") {
    actions.push("confirm_handover");
  }

  if (isBuyer && order.status === "dispatched" && order.fulfilment !== "shipped") {
    actions.push("show_handover_code");
  }

  if (isBuyer && order.status === "inspection") actions.push("accept_delivery");

  if (DISPUTABLE.has(order.status)) actions.push("dispute");

  // The definer has no status guard here, only "seller, and not twice". The UI
  // is narrower deliberately: outside a dispute there is nothing being returned.
  if (isSeller && order.status === "disputed" && order.animalReturnedAt === null) {
    actions.push("confirm_animal_returned");
  }

  if (CANCELLABLE.has(order.status)) actions.push("cancel");

  return actions;
}
