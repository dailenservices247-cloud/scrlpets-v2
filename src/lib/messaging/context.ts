export type MessageContext =
  | { kind: "creature"; id: string; label: string }
  | { kind: "listing"; id: string; label: string }
  | { kind: "product"; id: string; label: string }
  | { kind: "deposit"; id: string; label: string }
  | { kind: "care_instruction"; id: string; label: string };

export const MESSAGE_CONTEXT_KINDS = [
  "creature",
  "listing",
  "product",
  "deposit",
  "care_instruction",
] as const satisfies readonly MessageContext["kind"][];
