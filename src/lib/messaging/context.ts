export type MessageContext = {
  kind:
    | "creature"
    | "listing"
    | "product"
    | "deposit"
    | "care_instruction";
  id: string;
  label: string;
  eyebrow: string;
  description?: string | null;
  href?: string | null;
  imageUrl?: string | null;
};

export const MESSAGE_CONTEXT_KINDS = [
  "creature",
  "listing",
  "product",
  "deposit",
  "care_instruction",
] as const satisfies readonly MessageContext["kind"][];
