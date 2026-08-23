# W1 — Order Lifecycle UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/orders/[id]` the place an order is actually driven — every lifecycle action a buyer or seller holds gets a caller, across all three fulfilment modes.

**Architecture:** The decision of *which actions a viewer may take right now* is extracted into a pure function (`src/lib/orders/available-actions.ts`) with no React and no network, so it can be unit-tested exhaustively against the database's own guards. `OrderActions.tsx` is a dumb renderer over that function's output. Four new server actions wrap existing RPCs in the established one-call-one-wrapper style. No migrations — the database layer is complete and already probed by `supabase/probes/fulfilment_modes.probe.sql`.

**Tech Stack:** Next.js App Router (server components + `"use server"` actions), Supabase RPC via `@/lib/supabase/server`, next-intl, vitest (unit), Playwright (e2e), shadcn `Button`.

---

## Background the engineer needs

**`payments_enabled` is FALSE and stays false.** Every RPC in this plan except `confirm_animal_returned` and `my_handover_code` begins with `if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'`. So in dev, clicking any of these buttons returns the string `payments_disabled`. That is correct and expected. The UI must render an honest message for it, and the e2e tests assert exactly that. Do **not** add a client-side flag check as the gate — the database is the gate.

**Three fulfilment modes reach `inspection` by three different routes.** `orders.fulfilment` is `in_person`, `transported`, or `shipped`.

| Mode | Step | Actor | Required status | Result |
|---|---|---|---|---|
| `in_person` | `mark_dispatched` | seller | `funds_held` | → `dispatched` |
| `in_person` | `confirm_handover_and_hold` | seller | `dispatched` | → `inspection` |
| `transported` | `confirm_pickup` | seller | `funds_held` | → `dispatched` |
| `transported` | `confirm_delivery_with_code` | transporter | `dispatched` | → `inspection` |
| `shipped` | `record_shipment` | seller | `funds_held` | → `dispatched` |
| `shipped` | `confirm_shipment_delivered` | *service role* | `dispatched` | → `inspection` |

Then the buyer's `accept_delivery` at `inspection` → `released`.

**The driver's surface is already complete** — `src/components/jobs/JobList.tsx` calls `confirmDelivery`, which is the driver's only action by design. This plan does not touch `/jobs`.

**`confirm_shipment_delivered` is revoked from `authenticated`.** It is not in this plan. It is handled in W2.

**Order statuses:** `draft`, `awaiting_payment`, `deposit_held`, `funds_held`, `dispatched`, `inspection`, `released`, `refunded`, `cancelled`, `disputed`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/orders/available-actions.ts` — **create** | Pure. Given an order and a viewer id, returns the action kinds that viewer may take. No React, no I/O. Mirrors the DB guards. |
| `tests/unit/order-available-actions.test.ts` — **create** | Exhaustive table-driven tests for the above. This is where the real coverage lives. |
| `src/lib/orders/actions.ts` — **modify** | Add four thin RPC wrappers: `setOrderAddresses`, `recordShipment`, `confirmPickup`, `confirmAnimalReturned`. |
| `src/components/orders/OrderActions.tsx` — **create** | Client component. Renders the available actions, owns busy/error state, translates DB refusal reasons. |
| `src/app/orders/[id]/page.tsx` — **modify** | Widen the order select to the columns the panel needs; render `OrderActions` above `OrderThread`. |
| `messages/en.json`, `messages/es.json` — **modify** | New `orderActions` namespace. |
| `tests/e2e/order-actions.spec.ts` — **create** | Proves role-correct rendering and honest refusal against a real order. |

---

## Task 1: The pure action-availability function

**Files:**
- Create: `src/lib/orders/available-actions.ts`
- Test: `tests/unit/order-available-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-available-actions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
npx vitest run tests/unit/order-available-actions.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/orders/available-actions"`. If it fails with anything else, stop and read the error; the file must not already exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/orders/available-actions.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run tests/unit/order-available-actions.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Prove the tests can actually fail (inverted-assertion check)**

Per `AGENTS.md`, a green test is not evidence until it has been seen red. Temporarily change `if (isBuyer && order.status === "inspection")` to `if (isBuyer)` and re-run.

Expected: the "lets the buyer accept only during inspection" test FAILS. Revert the change and re-run to confirm PASS again.

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders/available-actions.ts tests/unit/order-available-actions.test.ts
git commit -m "Which controls an order shows, and to whom

RED then GREEN: 11 table-driven cases over the pure function, each mirroring a
guard that already exists in a definer. Inverted the inspection guard to confirm
the suite goes red before trusting its green.

Extracted from the component so the three fulfilment modes can be tested
exhaustively without a browser. A flat action list would offer mark_dispatched
on a shipped order, which the database refuses."
```

---

## Task 2: The four missing server actions

**Files:**
- Modify: `src/lib/orders/actions.ts` (append; the file is ~170 lines and each addition follows the existing one-call-one-wrapper shape)

- [ ] **Step 1: Add the wrappers**

Append to `src/lib/orders/actions.ts`:

```ts
/**
 * Each party supplies the address they actually know: the seller where the
 * animal is, the buyer where it is going. The definer decides which column your
 * uid may write, so passing both from one caller cannot cross the wires.
 */
export async function setOrderAddresses(
  orderId: string,
  fields: { pickup?: string; pickupPhone?: string; delivery?: string; deliveryPhone?: string },
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_addresses", {
    target_order: orderId,
    pickup: fields.pickup ?? null,
    pickup_phone: fields.pickupPhone ?? null,
    delivery: fields.delivery ?? null,
    delivery_phone: fields.deliveryPhone ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

/** The shipped path's dispatch. Tracking is mandatory — the definer refuses without it. */
export async function recordShipment(
  orderId: string,
  carrier: string,
  tracking: string,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_shipment", {
    target_order: orderId,
    ship_carrier: carrier,
    tracking,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/applications");
  return { ok: true };
}

/**
 * The SELLER's step, not the driver's, and the split is the point: the seller
 * proves the right animal got in the van, the buyer's code proves it reached the
 * right person, and neither can fake the chain alone. `anchor_mismatch` means
 * the animal presented was not the animal listed — a §3 dispute, not a typo.
 */
export async function confirmPickup(orderId: string, scannedAnchor: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_pickup", {
    target_order: orderId,
    scanned_anchor: scannedAnchor,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

/**
 * The return leg of a refund-on-return remedy. Idempotent in the definer — a
 * second call returns without writing — so a double click cannot restate it.
 */
export async function confirmAnimalReturned(orderId: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_animal_returned", { target_order: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no output, exit 0. (Note: `tsc --noEmit | tail -3 && echo clean` is the shape that lied for a whole session — read the exit status, not a printed label.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/orders/actions.ts
git commit -m "Four RPCs that existed with nowhere to be called from

set_order_addresses, record_shipment, confirm_pickup, confirm_animal_returned
have been in the database since 20260812092140 and had no caller anywhere in
src. Without set_order_addresses in particular the transporter address reveal
had nothing to reveal."
```

---

## Task 3: Translation keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add the `orderActions` namespace to `messages/en.json`**

Insert as a top-level key, alphabetically adjacent to `orderThread`:

```json
"orderActions": {
  "title": "What happens next",
  "noneTitle": "Nothing to do right now",
  "noneBody": "This order is waiting on the other party or on the clock.",
  "setPickupAddress": "Set pickup address",
  "setDeliveryAddress": "Set delivery address",
  "addressLine": "Street address",
  "addressPhone": "Contact phone",
  "addressSave": "Save address",
  "addressSaved": "Saved. The driver sees it only after pickup is confirmed.",
  "markDispatched": "Mark dispatched",
  "recordShipment": "Record shipment",
  "carrier": "Carrier",
  "tracking": "Tracking number",
  "confirmPickup": "Confirm pickup",
  "anchorPrompt": "Scan or enter the animal's microchip",
  "confirmHandover": "Confirm handover",
  "codePrompt": "Enter the buyer's handover code",
  "showHandoverCode": "Show my handover code",
  "yourCode": "Your handover code",
  "codeHelp": "Read this out at handover. Never send it before you have the animal.",
  "acceptDelivery": "Accept delivery",
  "acceptHelp": "This releases the funds. Do it only once you are satisfied.",
  "dispute": "Open a dispute",
  "disputeReason": "What went wrong?",
  "disputeSubmit": "Open dispute",
  "confirmAnimalReturned": "Confirm the animal is back",
  "cancel": "Cancel this order",
  "working": "Working…",
  "errorPaymentsOff": "Payments are not live yet, so this cannot run.",
  "errorNotTheSeller": "Only the seller can do that.",
  "errorNotTheBuyer": "Only the buyer can do that.",
  "errorNotAParty": "You are not part of this order.",
  "errorCodeMismatch": "That code does not match.",
  "errorAnchorMismatch": "That is not the animal on this listing. Do not hand it over — open a dispute.",
  "errorTrackingRequired": "A tracking number is required.",
  "errorReasonRequired": "Say what went wrong.",
  "errorOrderClosed": "This order is closed.",
  "errorInvalidTransition": "That is not possible from the order's current state.",
  "errorGeneric": "That did not work. Try again."
}
```

- [ ] **Step 2: Add the same namespace to `messages/es.json`**

```json
"orderActions": {
  "title": "Qué pasa ahora",
  "noneTitle": "Nada que hacer por ahora",
  "noneBody": "Este pedido espera a la otra parte o al reloj.",
  "setPickupAddress": "Indicar dirección de recogida",
  "setDeliveryAddress": "Indicar dirección de entrega",
  "addressLine": "Dirección",
  "addressPhone": "Teléfono de contacto",
  "addressSave": "Guardar dirección",
  "addressSaved": "Guardada. El transportista la ve solo tras confirmarse la recogida.",
  "markDispatched": "Marcar como enviado",
  "recordShipment": "Registrar el envío",
  "carrier": "Transportista",
  "tracking": "Número de seguimiento",
  "confirmPickup": "Confirmar recogida",
  "anchorPrompt": "Escanea o introduce el microchip del animal",
  "confirmHandover": "Confirmar entrega en mano",
  "codePrompt": "Introduce el código de entrega del comprador",
  "showHandoverCode": "Ver mi código de entrega",
  "yourCode": "Tu código de entrega",
  "codeHelp": "Léelo en voz alta en la entrega. Nunca lo envíes antes de tener el animal.",
  "acceptDelivery": "Aceptar la entrega",
  "acceptHelp": "Esto libera los fondos. Hazlo solo cuando estés conforme.",
  "dispute": "Abrir una disputa",
  "disputeReason": "¿Qué ha ido mal?",
  "disputeSubmit": "Abrir disputa",
  "confirmAnimalReturned": "Confirmar que el animal ha vuelto",
  "cancel": "Cancelar este pedido",
  "working": "Procesando…",
  "errorPaymentsOff": "Los pagos aún no están activos, así que esto no puede ejecutarse.",
  "errorNotTheSeller": "Solo el vendedor puede hacer eso.",
  "errorNotTheBuyer": "Solo el comprador puede hacer eso.",
  "errorNotAParty": "No formas parte de este pedido.",
  "errorCodeMismatch": "Ese código no coincide.",
  "errorAnchorMismatch": "Ese no es el animal del anuncio. No lo entregues: abre una disputa.",
  "errorTrackingRequired": "Hace falta un número de seguimiento.",
  "errorReasonRequired": "Explica qué ha ido mal.",
  "errorOrderClosed": "Este pedido está cerrado.",
  "errorInvalidTransition": "Eso no es posible en el estado actual del pedido.",
  "errorGeneric": "No ha funcionado. Inténtalo de nuevo."
}
```

- [ ] **Step 3: Verify both files are valid JSON with identical key sets**

```bash
node -e "const a=require('./messages/en.json').orderActions,b=require('./messages/es.json').orderActions;const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();if(JSON.stringify(ka)!==JSON.stringify(kb)){console.error('MISMATCH');console.error('en only:',ka.filter(k=>!kb.includes(k)));console.error('es only:',kb.filter(k=>!ka.includes(k)));process.exit(1)}console.log('OK',ka.length,'keys match')"
```

Expected: `OK 38 keys match`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "Words for the order controls, in both dictionaries

errorAnchorMismatch says what to DO — do not hand it over, open a dispute —
because a generic failure there reads as a scanner problem when it means the
animal presented is not the animal listed."
```

---

## Task 4: The `OrderActions` component

**Files:**
- Create: `src/components/orders/OrderActions.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/orders/OrderActions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { availableActions, type OrderView } from "@/lib/orders/available-actions";
import {
  acceptDelivery,
  advanceOrder,
  confirmAnimalReturned,
  confirmHandover,
  confirmPickup,
  disputeOrder,
  getHandoverCode,
  markDispatched,
  recordShipment,
  setOrderAddresses,
  type OrderResult,
} from "@/lib/orders/actions";

/**
 * The order's controls.
 *
 * Which controls exist is decided by `availableActions`, which mirrors the
 * database's own guards. This component decides nothing about permission — it
 * renders what that function returns, calls the definer, and shows the
 * definer's refusal verbatim when the two disagree. A hidden button and a
 * refused call must agree; when they do not, the database is right and the page
 * revalidates on the refusal.
 */
export function OrderActions({ order, viewerId }: { order: OrderView & { id: string }; viewerId: string }) {
  const t = useTranslations("orderActions");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [anchor, setAnchor] = useState("");
  const [handoverCode, setHandoverCode] = useState("");
  const [reason, setReason] = useState("");

  const kinds = availableActions(order, viewerId);

  /** The database's refusal reasons, said plainly. Anything unmapped falls through. */
  function explain(raw: string): string {
    const map: Record<string, string> = {
      payments_disabled: "errorPaymentsOff",
      not_the_seller: "errorNotTheSeller",
      not_the_buyer: "errorNotTheBuyer",
      not_a_party: "errorNotAParty",
      code_mismatch: "errorCodeMismatch",
      anchor_mismatch: "errorAnchorMismatch",
      tracking_required: "errorTrackingRequired",
      reason_required: "errorReasonRequired",
      order_closed: "errorOrderClosed",
      invalid_transition: "errorInvalidTransition",
    };
    const hit = Object.keys(map).find((k) => raw.includes(k));
    return t(hit ? map[hit] : "errorGeneric");
  }

  async function run(fn: () => Promise<OrderResult>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(explain(result.error));
      // Refresh even on refusal: the most likely cause is that this page's idea
      // of the order is stale.
      router.refresh();
      return;
    }
    router.refresh();
  }

  if (kinds.length === 0) {
    return (
      <section className="premium-panel rounded-2xl p-4" data-testid="order-actions-none">
        <h2 className="text-sm font-semibold">{t("noneTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("noneBody")}</p>
      </section>
    );
  }

  return (
    <section className="premium-panel flex flex-col gap-3 rounded-2xl p-4" data-testid="order-actions">
      <h2 className="text-sm font-semibold">{t("title")}</h2>

      {kinds.includes("set_pickup_address") || kinds.includes("set_delivery_address") ? (
        <div className="flex flex-col gap-2" data-testid="order-action-address">
          <label className="text-xs text-muted-foreground" htmlFor="oa-address">
            {kinds.includes("set_pickup_address") ? t("setPickupAddress") : t("setDeliveryAddress")}
          </label>
          <input
            id="oa-address"
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("addressLine")}
            aria-label={t("addressLine")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="order-address-line"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("addressPhone")}
            aria-label={t("addressPhone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="order-address-phone"
          />
          <Button
            type="button"
            disabled={busy || address.trim() === ""}
            data-testid="order-address-save"
            onClick={() =>
              run(() =>
                setOrderAddresses(
                  order.id,
                  kinds.includes("set_pickup_address")
                    ? { pickup: address, pickupPhone: phone }
                    : { delivery: address, deliveryPhone: phone },
                ),
              )
            }
          >
            {busy ? t("working") : t("addressSave")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("addressSaved")}</p>
        </div>
      ) : null}

      {kinds.includes("mark_dispatched") && (
        <Button
          type="button"
          disabled={busy}
          data-testid="order-mark-dispatched"
          onClick={() => run(() => markDispatched(order.id))}
        >
          {busy ? t("working") : t("markDispatched")}
        </Button>
      )}

      {kinds.includes("record_shipment") && (
        <div className="flex flex-col gap-2" data-testid="order-action-shipment">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("carrier")}
            aria-label={t("carrier")}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            data-testid="order-carrier"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("tracking")}
            aria-label={t("tracking")}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            data-testid="order-tracking"
          />
          <Button
            type="button"
            disabled={busy || tracking.trim() === ""}
            data-testid="order-record-shipment"
            onClick={() => run(() => recordShipment(order.id, carrier, tracking))}
          >
            {busy ? t("working") : t("recordShipment")}
          </Button>
        </div>
      )}

      {kinds.includes("confirm_pickup") && (
        <div className="flex flex-col gap-2" data-testid="order-action-pickup">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("anchorPrompt")}
            aria-label={t("anchorPrompt")}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            data-testid="order-anchor"
          />
          <Button
            type="button"
            disabled={busy || anchor.trim() === ""}
            data-testid="order-confirm-pickup"
            onClick={() => run(() => confirmPickup(order.id, anchor.trim()))}
          >
            {busy ? t("working") : t("confirmPickup")}
          </Button>
        </div>
      )}

      {kinds.includes("confirm_handover") && (
        <div className="flex flex-col gap-2" data-testid="order-action-handover">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("codePrompt")}
            aria-label={t("codePrompt")}
            value={handoverCode}
            onChange={(e) => setHandoverCode(e.target.value)}
            data-testid="order-handover-code-input"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("anchorPrompt")}
            aria-label={t("anchorPrompt")}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            data-testid="order-handover-anchor"
          />
          <Button
            type="button"
            disabled={busy || handoverCode.trim() === "" || anchor.trim() === ""}
            data-testid="order-confirm-handover"
            onClick={() => run(() => confirmHandover(order.id, handoverCode.trim(), anchor.trim()))}
          >
            {busy ? t("working") : t("confirmHandover")}
          </Button>
        </div>
      )}

      {kinds.includes("show_handover_code") && (
        <div className="flex flex-col gap-2" data-testid="order-action-code">
          {code === null ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              data-testid="order-show-code"
              onClick={async () => {
                setBusy(true);
                setCode((await getHandoverCode(order.id)) ?? "");
                setBusy(false);
              }}
            >
              {busy ? t("working") : t("showHandoverCode")}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("yourCode")}</p>
              <p className="font-mono text-lg" data-testid="order-handover-code">
                {code}
              </p>
              <p className="text-xs text-muted-foreground">{t("codeHelp")}</p>
            </>
          )}
        </div>
      )}

      {kinds.includes("accept_delivery") && (
        <div className="flex flex-col gap-2" data-testid="order-action-accept">
          <Button
            type="button"
            disabled={busy}
            data-testid="order-accept-delivery"
            onClick={() => run(() => acceptDelivery(order.id))}
          >
            {busy ? t("working") : t("acceptDelivery")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("acceptHelp")}</p>
        </div>
      )}

      {kinds.includes("confirm_animal_returned") && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          data-testid="order-confirm-returned"
          onClick={() => run(() => confirmAnimalReturned(order.id))}
        >
          {busy ? t("working") : t("confirmAnimalReturned")}
        </Button>
      )}

      {kinds.includes("dispute") && (
        <div className="flex flex-col gap-2" data-testid="order-action-dispute">
          <textarea
            className="min-h-16 rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("disputeReason")}
            aria-label={t("disputeReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            data-testid="order-dispute-reason"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={busy || reason.trim() === ""}
            data-testid="order-dispute"
            onClick={() => run(() => disputeOrder(order.id, reason.trim()))}
          >
            {busy ? t("working") : t("disputeSubmit")}
          </Button>
        </div>
      )}

      {kinds.includes("cancel") && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          data-testid="order-cancel"
          onClick={() => run(() => advanceOrder(order.id, "cancelled"))}
        >
          {busy ? t("working") : t("cancel")}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive" data-testid="order-actions-error">
          {error}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify types and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: exit 0 from both.

- [ ] **Step 3: Commit**

```bash
git add src/components/orders/OrderActions.tsx
git commit -m "The order page gets controls

Renders what availableActions returns and decides nothing itself. Refusals are
shown verbatim rather than swallowed, and the page revalidates on one, because
the most likely cause of a refused call is that the page's idea of the order is
stale."
```

---

## Task 5: Wire it into the order page

**Files:**
- Modify: `src/app/orders/[id]/page.tsx:26-38` (the select and the render)

- [ ] **Step 1: Widen the select and render the panel**

In `src/app/orders/[id]/page.tsx`, replace the `.select(...)` string and the `order` type with:

```tsx
  const { data } = await supabase
    .from("orders")
    .select(
      "id,title_snapshot,status,fulfilment,buyer_id,seller_id,transporter_id,picked_up_at,animal_returned_at",
    )
    .eq("id", id)
    .maybeSingle();
  const order = data as {
    id: string;
    title_snapshot: string | null;
    status: string;
    fulfilment: "in_person" | "transported" | "shipped";
    buyer_id: string;
    seller_id: string;
    transporter_id: string | null;
    picked_up_at: string | null;
    animal_returned_at: string | null;
  } | null;
```

Add the import at the top, beside the `OrderThread` import:

```tsx
import { OrderActions } from "@/components/orders/OrderActions";
```

Then render the panel above the thread, inside the existing `<div className="px-3 pb-10">`:

```tsx
      <div className="flex flex-col gap-4 px-3 pb-10">
        <OrderActions
          order={{
            id: order.id,
            status: order.status,
            fulfilment: order.fulfilment,
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            transporterId: order.transporter_id,
            pickedUpAt: order.picked_up_at,
            animalReturnedAt: order.animal_returned_at,
          }}
          viewerId={user.id}
        />
        <OrderThread
          orderId={id}
          messages={messages}
          viewerId={user.id}
          hasTransporter={Boolean(order.transporter_id)}
        />
      </div>
```

- [ ] **Step 2: Verify types, lint, and the full unit suite**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: exit 0; unit suite green.

- [ ] **Step 3: Commit**

```bash
git add src/app/orders/[id]/page.tsx
git commit -m "An order you can act on, not only read

The page was a status label and a chat thread. A buyer could pay and then the
order froze: nobody could dispatch, accept, read a handover code, or open the
dispute the admin queue was already built to resolve."
```

---

## Task 6: End-to-end proof

**Files:**
- Create: `tests/e2e/order-actions.spec.ts`

Read `tests/e2e/order-thread.spec.ts` first — it creates an order with the service role for exactly this reason, and this spec follows its setup.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/order-actions.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, MEMBER_EMAIL, signInCached } from "./fixtures";

/**
 * The order page's controls, against a real order.
 *
 * `payments_enabled` is FALSE, so every definer here refuses with
 * `payments_disabled`. That refusal IS the assertion: it proves the button
 * reached the database rather than being swallowed in the client, and it proves
 * the flag is what stops it.
 */
async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test.describe("order actions", () => {
  test.describe.configure({ timeout: 120_000 });

  test("a seller sees seller controls and a buyer sees buyer controls", async ({ page }) => {
    test.skip(
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "needs SUPABASE_SERVICE_ROLE_KEY; orders are definer-written by design",
    );
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const seller = await signInCached(SELLER_EMAIL);
    const buyer = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    const listing = await seller.db
      .from("listings")
      .insert({ seller_id: seller.userId, title: `E2E actions ${stamp}`, price_cents: 50000 })
      .select("id")
      .single();

    const order = await asService
      .from("orders")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: listing.data!.id,
        title_snapshot: `E2E actions ${stamp}`,
        amount_cents: 50000,
        status: "funds_held",
        fulfilment: "in_person",
      })
      .select("id")
      .single();
    // Without this the whole test passes vacuously on a null order id.
    expect(order.error, "fixture order must exist or this proves nothing").toBeNull();
    const orderId = order.data!.id as string;

    // Seller at funds_held on an in-person order: dispatch, not shipment.
    await loginViaUi(page, SELLER_EMAIL);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-mark-dispatched")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("order-record-shipment")).toHaveCount(0);
    await expect(page.getByTestId("order-accept-delivery")).toHaveCount(0);

    // The flag is what stops it, and the page says so rather than failing mutely.
    await page.getByTestId("order-mark-dispatched").click();
    await expect(page.getByTestId("order-actions-error")).toContainText(/not live yet/i, {
      timeout: 20_000,
    });

    // Buyer on the same order: no seller controls, and the dispute is theirs too.
    await page.goto("/auth/signout");
    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-mark-dispatched")).toHaveCount(0);
    await expect(page.getByTestId("order-dispute")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("order-address-line")).toBeVisible();

    await asService.from("orders").delete().eq("id", orderId);
    await asService.from("listings").delete().eq("id", listing.data!.id);
  });

  test("a shipped order offers the seller tracking, never a dispatch button", async ({ page }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY");
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const seller = await signInCached(SELLER_EMAIL);
    const buyer = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    const listing = await seller.db
      .from("listings")
      .insert({ seller_id: seller.userId, title: `E2E shipped ${stamp}`, price_cents: 40000 })
      .select("id")
      .single();

    const order = await asService
      .from("orders")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: listing.data!.id,
        title_snapshot: `E2E shipped ${stamp}`,
        amount_cents: 40000,
        status: "funds_held",
        fulfilment: "shipped",
      })
      .select("id")
      .single();
    expect(order.error, "fixture order must exist or this proves nothing").toBeNull();
    const orderId = order.data!.id as string;

    await loginViaUi(page, SELLER_EMAIL);
    await page.goto(`/orders/${orderId}`);

    await expect(page.getByTestId("order-tracking")).toBeVisible({ timeout: 20_000 });
    // mark_dispatched raises on a shipped order — tracking is mandatory there,
    // so offering the button at all would be offering a guaranteed refusal.
    await expect(page.getByTestId("order-mark-dispatched")).toHaveCount(0);

    await asService.from("orders").delete().eq("id", orderId);
    await asService.from("listings").delete().eq("id", listing.data!.id);
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test tests/e2e/order-actions.spec.ts --reporter=list
```

Expected: 2 passed. **Read the count, not just the absence of red** — a run reporting passes while tests were skipped has proved nothing. If both say `skipped`, `SUPABASE_SERVICE_ROLE_KEY` is missing from the environment; export it and re-run before treating this task as done.

- [ ] **Step 3: Prove the spec can fail**

Temporarily change `availableActions` so the `record_shipment` branch also pushes `"mark_dispatched"`, and re-run.

Expected: the shipped-order test FAILS on `order-mark-dispatched` having count 1. Revert and re-run to confirm both pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/order-actions.spec.ts
git commit -m "Proof the controls are role-correct and reach the database

payments_enabled is false, so every definer refuses with payments_disabled —
and that refusal is the assertion: it proves the click reached the database
rather than dying in the client, and proves the flag is what stops it.

Inverted the shipped-mode branch to confirm the spec goes red first."
```

---

## Task 7: Full verification sweep

- [ ] **Step 1: Run every gate**

```bash
./ship-verify.sh
```

Expected: `RESULT: ALL GATES PASS` across typescript, lint, unit, sql probes, e2e, prod build.

- [ ] **Step 2: Confirm the probe suite still passes**

W1 adds no migration, so no probe should change. If any probe fails, something in this work altered a constraint it should not have — stop and read the failure rather than repairing the probe.

```bash
./run-probes.sh
```

Expected: 21 probes, all green.

- [ ] **Step 3: Paste the SUMMARY block into the session log, then commit any remaining changes**

```bash
git status --short
```

Expected: clean.

---

## Self-review notes

**Spec coverage.** Every W1 requirement in the design maps to a task: the pure decision function and its three-mode routing (Task 1), the four missing wrappers (Task 2), address capture from each party (Tasks 2–4), the corrected dispute/return/pickup ownership (Task 1 tests), the honest refusal rendering (Task 4), the page wiring (Task 5), and proof (Task 6).

**Deliberately not in this plan.** `confirm_shipment_delivered` (service-role only — W2). The driver surface (already complete). Checkout-time delivery-address capture: the design mentions extending `CheckoutFlow`, but collecting it on the order page covers the same requirement with one surface instead of two, and `set_order_addresses` refuses only on a *closed* order, so there is no window where the buyer cannot supply it. If checkout-time capture is wanted later it is additive.

**Type consistency check.** `OrderView` is defined once in Task 1 and consumed unchanged in Tasks 4 and 5. `OrderResult` is the existing exported type from `src/lib/orders/actions.ts`. The component's prop is `OrderView & { id: string }` because `availableActions` does not need the id but the action calls do.
