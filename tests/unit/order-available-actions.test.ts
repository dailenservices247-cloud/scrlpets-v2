import { describe, expect, it } from "vitest";
import { availableActions, type OrderView } from "@/lib/orders/available-actions";

const BUYER = "11111111-1111-1111-1111-111111111111";
const SELLER = "22222222-2222-2222-2222-222222222222";
const DRIVER = "33333333-3333-3333-3333-333333333333";
const STRANGER = "44444444-4444-4444-4444-444444444444";

function order(over: Partial<OrderView> = {}): OrderView {
  return {
    status: "funds_held",
    fulfilment: "in_person",
    buyerId: BUYER,
    sellerId: SELLER,
    transporterId: null,
    pickedUpAt: null,
    animalReturnedAt: null,
    ...over,
  };
}

describe("availableActions", () => {
  it("gives a non-party nothing at all", () => {
    // RLS already 404s a non-party, but a panel that would have rendered
    // controls for one is a panel that trusts the page instead of the row.
    expect(availableActions(order(), STRANGER)).toEqual([]);
    expect(availableActions(order({ transporterId: DRIVER }), DRIVER)).toEqual([]);
  });

  it("lets the seller dispatch an in-person order only once funds are held", () => {
    expect(availableActions(order({ status: "funds_held" }), SELLER)).toContain("mark_dispatched");
    expect(availableActions(order({ status: "deposit_held" }), SELLER)).not.toContain(
      "mark_dispatched",
    );
  });

  it("routes funds_held to a different seller action per fulfilment mode", () => {
    // The whole reason this function exists. A flat list would offer
    // mark_dispatched on a shipped order, which the database refuses.
    const s = (f: OrderView["fulfilment"]) =>
      availableActions(order({ status: "funds_held", fulfilment: f }), SELLER);
    expect(s("in_person")).toContain("mark_dispatched");
    expect(s("in_person")).not.toContain("record_shipment");
    expect(s("shipped")).toContain("record_shipment");
    expect(s("shipped")).not.toContain("mark_dispatched");
    expect(s("transported")).toContain("confirm_pickup");
    expect(s("transported")).not.toContain("mark_dispatched");
  });

  it("only offers the code-and-anchor handover on an in-person order", () => {
    // On a transported order the driver holds that step; on a shipped one
    // nobody meets at all.
    const s = (f: OrderView["fulfilment"]) =>
      availableActions(order({ status: "dispatched", fulfilment: f }), SELLER);
    expect(s("in_person")).toContain("confirm_handover");
    expect(s("transported")).not.toContain("confirm_handover");
    expect(s("shipped")).not.toContain("confirm_handover");
  });

  it("shows the buyer their code only when someone is about to ask for it", () => {
    const b = (f: OrderView["fulfilment"], status: string) =>
      availableActions(order({ status, fulfilment: f }), BUYER);
    expect(b("in_person", "dispatched")).toContain("show_handover_code");
    expect(b("transported", "dispatched")).toContain("show_handover_code");
    // A shipped order has no handover meeting, so there is no code to read.
    expect(b("shipped", "dispatched")).not.toContain("show_handover_code");
    expect(b("in_person", "funds_held")).not.toContain("show_handover_code");
  });

  it("lets the buyer accept only during inspection", () => {
    expect(availableActions(order({ status: "inspection" }), BUYER)).toContain("accept_delivery");
    expect(availableActions(order({ status: "dispatched" }), BUYER)).not.toContain(
      "accept_delivery",
    );
    // Acceptance is the buyer's word. The seller cannot give it for them.
    expect(availableActions(order({ status: "inspection" }), SELLER)).not.toContain(
      "accept_delivery",
    );
  });

  it("lets EITHER party dispute, across all four held statuses", () => {
    // dispute_order accepts buyer or seller. An earlier reading of this had it
    // buyer-only at inspection, which would have hidden the control from a
    // seller whose buyer had vanished.
    for (const status of ["deposit_held", "funds_held", "dispatched", "inspection"]) {
      expect(availableActions(order({ status }), BUYER)).toContain("dispute");
      expect(availableActions(order({ status }), SELLER)).toContain("dispute");
    }
    for (const status of ["draft", "awaiting_payment", "released", "refunded", "cancelled"]) {
      expect(availableActions(order({ status }), BUYER)).not.toContain("dispute");
    }
  });

  it("asks the SELLER to confirm the animal is back, once, during a dispute", () => {
    expect(availableActions(order({ status: "disputed" }), SELLER)).toContain(
      "confirm_animal_returned",
    );
    expect(availableActions(order({ status: "disputed" }), BUYER)).not.toContain(
      "confirm_animal_returned",
    );
    expect(
      availableActions(
        order({ status: "disputed", animalReturnedAt: "2026-08-01T00:00:00Z" }),
        SELLER,
      ),
    ).not.toContain("confirm_animal_returned");
  });

  it("collects each address from the party who actually knows it", () => {
    expect(availableActions(order(), SELLER)).toContain("set_pickup_address");
    expect(availableActions(order(), SELLER)).not.toContain("set_delivery_address");
    expect(availableActions(order(), BUYER)).toContain("set_delivery_address");
    expect(availableActions(order(), BUYER)).not.toContain("set_pickup_address");
  });

  it("offers nothing on a closed order", () => {
    // set_order_addresses raises `order_closed` on these three, and every other
    // action has a status guard that excludes them.
    for (const status of ["released", "refunded", "cancelled"]) {
      expect(availableActions(order({ status }), SELLER)).toEqual([]);
      expect(availableActions(order({ status }), BUYER)).toEqual([]);
    }
  });

  it("offers cancel only where advance_order actually permits it", () => {
    for (const status of ["draft", "awaiting_payment"]) {
      expect(availableActions(order({ status }), BUYER)).toContain("cancel");
      expect(availableActions(order({ status }), SELLER)).toContain("cancel");
    }
    expect(availableActions(order({ status: "funds_held" }), BUYER)).not.toContain("cancel");
  });
});
