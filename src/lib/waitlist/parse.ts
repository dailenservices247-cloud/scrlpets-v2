import { LITTER_SPECIES } from "@/lib/litters/constants";

export type WaitlistInput = {
  email: string;
  species: string[];
  source: string;
};

export type WaitlistParseError = { error: "email" | "bot" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;

/**
 * Pure input gate for the waitlist form. Everything the browser posts is
 * untrusted: species collapse to the fixed vocabulary, source collapses to a
 * slug or "direct", and the invisible `company` field catches scripts — a
 * human never sees it, so anything in it is not a human.
 */
export function parseWaitlistInput(
  formData: FormData,
): WaitlistInput | WaitlistParseError {
  if (String(formData.get("company") ?? "") !== "") return { error: "bot" };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 320 || !EMAIL_RE.test(email)) return { error: "email" };

  const species = [
    ...new Set(
      formData
        .getAll("species")
        .map(String)
        .filter((value) =>
          (LITTER_SPECIES as readonly string[]).includes(value),
        ),
    ),
  ];

  const rawSource = String(formData.get("source") ?? "");
  const source = SOURCE_RE.test(rawSource) ? rawSource : "direct";

  return { email, species, source };
}
