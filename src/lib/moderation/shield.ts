/**
 * Scrlpets Deal Room & Escrow Shield
 *
 * Fast inline classification (<100ms) to intercept off-platform payment steering
 * (CashApp, Venmo, Zelle, Wire fraud) and animal welfare violations before
 * messages land in Supabase. Preserves Stripe Buyer Protection Hold and the
 * 72-hour veterinary inspection guarantee.
 *
 * Designed with a two-tier architecture:
 * 1. Sub-millisecond deterministic heuristic pattern scanner (always on).
 * 2. Pluggable sub-100ms discriminative classifier (TypeSafe Jev API) when
 *    JEV_API_KEY is configured, with fail-open timeout safety.
 */

export type ShieldVerdict = {
  allowed: boolean;
  reason?: "off_platform_payment" | "welfare_violation" | "phishing";
  warningMessage?: string;
  confidence: number;
  source: "heuristic" | "jev_ai";
};

// Patterns targeting off-platform payment evasion in animal marketplaces
const OFF_PLATFORM_PATTERNS: { regex: RegExp; label: string }[] = [
  // CashApp cashtags and keywords (e.g. $breeder, cash app). Note: does NOT match currency amounts like $500
  { regex: /(?:\bcash\s*app\b|(?:\s|^)\$[a-zA-Z][a-zA-Z0-9_]{1,19}\b)/i, label: "CashApp" },
  // Venmo handles and keywords
  { regex: /\b(?:venmo|@([a-zA-Z0-9_-]{5,30}))\b/i, label: "Venmo" },
  // Zelle keywords and phone/email payment hints
  { regex: /\bzelle\b/i, label: "Zelle" },
  // Wire transfers / Western Union / MoneyGram
  { regex: /\b(?:wire\s+transfer|western\s+union|money\s*gram)\b/i, label: "Wire Transfer" },
  // Explicit disintermediation phrasing
  { regex: /\b(?:pay\s+(?:outside|off[-\s]?platform|off[-\s]?app|direct(?:ly)?)|skip\s+the\s+fee|avoid\s+(?:the\s+)?fee)\b/i, label: "Off-platform payment" },
  // Apple Pay / Google Pay off-platform steering
  { regex: /\b(?:apple\s*cash|apple\s*pay\s+me|send\s+via\s+apple\s*pay)\b/i, label: "Apple Cash direct" },
  // Crypto addresses
  { regex: /\b(?:(?:0x[a-fA-F0-9]{40})|(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}))\b/i, label: "Cryptocurrency" },
];

// Animal welfare violations (e.g. selling under 8 weeks / under legal age)
const WELFARE_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /\b(?:ready\s+at\s+[1-6]\s+weeks?|leave\s+(?:mom\s+at|at)\s+[1-6]\s+weeks?|take\s+home\s+at\s+[1-6]\s+weeks?)\b/i, label: "Underage separation (<8 weeks)" },
  { regex: /\b(?:fighting\s+lines?|game\s+dog|gamebred\s+pit)\b/i, label: "Animal fighting references" },
];

const WARNING_PAYMENT =
  "⚠️ Escrow Shield Protection: For your security and to keep your 72-hour veterinary health guarantee and refund protection intact, all deposits and payments must remain within Scrlpets. Off-platform payments (CashApp, Venmo, Zelle, Wire) are prohibited and forfeit buyer protection.";

const WARNING_WELFARE =
  "⚠️ Animal Welfare Shield: Listings and communications must comply with animal welfare standards. Puppies and kittens must remain with their mother until at least 8 weeks of age.";

/**
 * Screen message body for off-platform payment attempts or welfare violations.
 * Evaluates in <1ms via heuristic rules; queries Jev AI if configured (<100ms).
 */
export async function screenMessage(text: string): Promise<ShieldVerdict> {
  if (!text || text.trim().length === 0) {
    return { allowed: true, confidence: 1.0, source: "heuristic" };
  }

  // 1. Fast Heuristic Filter (<1ms)
  for (const { regex } of OFF_PLATFORM_PATTERNS) {
    if (regex.test(text)) {
      return {
        allowed: false,
        reason: "off_platform_payment",
        warningMessage: WARNING_PAYMENT,
        confidence: 0.98,
        source: "heuristic",
      };
    }
  }

  for (const { regex } of WELFARE_PATTERNS) {
    if (regex.test(text)) {
      return {
        allowed: false,
        reason: "welfare_violation",
        warningMessage: WARNING_WELFARE,
        confidence: 0.95,
        source: "heuristic",
      };
    }
  }

  // 2. Jev AI Discriminative Model (<100ms)
  // If JEV_API_KEY is configured in the environment, send zero-shot classification request
  const jevApiKey = process.env.JEV_API_KEY;
  if (jevApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150); // 150ms strict budget

      const response = await fetch("https://api.typesafe.ai/v1/jev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jevApiKey}`,
        },
        body: JSON.stringify({
          model: "jev-latest",
          state: text,
          questions: [
            {
              id: "off_platform_payment",
              type: "noul",
              prompt: "Does this message solicit or propose paying outside the platform, avoiding fees, or using third-party payment methods (CashApp, Venmo, Zelle, Wire, check)?",
            },
            {
              id: "animal_welfare_risk",
              type: "noul",
              prompt: "Does this message violate humane animal welfare policies, such as separating animals from their mother before 8 weeks, animal fighting, or neglect?",
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const paymentProb = data.answers?.off_platform_payment?.probability ?? 0;
        const welfareProb = data.answers?.animal_welfare_risk?.probability ?? 0;

        if (paymentProb >= 0.80) {
          return {
            allowed: false,
            reason: "off_platform_payment",
            warningMessage: WARNING_PAYMENT,
            confidence: paymentProb,
            source: "jev_ai",
          };
        }

        if (welfareProb >= 0.80) {
          return {
            allowed: false,
            reason: "welfare_violation",
            warningMessage: WARNING_WELFARE,
            confidence: welfareProb,
            source: "jev_ai",
          };
        }
      }
    } catch {
      // Timeout or network error: fail-open to preserve chat uptime
    }
  }

  return { allowed: true, confidence: 0.99, source: "heuristic" };
}
