/**
 * Support confirmation email — Resend.
 *
 * NOT configured. There is no Resend account, key, or verified sending domain
 * in this repo; A.7's migration comment claimed the confirmation "rides the
 * existing Resend wiring at the app layer" and no such wiring existed. So this
 * follows the Stripe Identity precedent (lib/verification/stripe-identity.ts):
 * report `not_configured` honestly, let the surface SAY nothing was sent, and
 * keep the send path exercised the moment RESEND_API_KEY appears.
 *
 * Raw fetch, not the `resend` SDK — one POST does not earn a dependency.
 */
export type SupportEmailResult = { sent: boolean };

/** Both halves are required: a key with no verified sender cannot deliver. */
export function isSupportEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.SUPPORT_FROM_EMAIL);
}

export async function sendSupportConfirmation(ticket: {
  reference: string;
  name: string;
  email: string;
  subject: string;
}): Promise<SupportEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (!key || !from) return { sent: false };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [ticket.email],
        subject: `Scrlpets support — ${ticket.reference}`,
        // Plain text only: no template, no tracking pixel, nothing to render.
        text: [
          `Hi ${ticket.name},`,
          "",
          `We have your message: "${ticket.subject}"`,
          `Your reference is ${ticket.reference}.`,
          "",
          "A person reads every ticket. We do not promise a response time,",
          "and this address does not accept replies — send anything further",
          "through the support form.",
          "",
          "— Scrlpets",
        ].join("\n"),
      }),
    });
    return { sent: response.ok };
  } catch {
    // A failed confirmation must never fail the ticket that is already saved.
    return { sent: false };
  }
}
