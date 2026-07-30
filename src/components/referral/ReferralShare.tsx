import { getTranslations } from "next-intl/server";
import { ShareActions } from "./ShareActions";
import { encodeQr, qrPath } from "./qr";

/**
 * E: the QR and the message that goes with it.
 *
 * A server component: the matrix is computed here and shipped as one SVG path,
 * so the QR costs the client nothing and the referral code never travels to a
 * QR service that would log it.
 *
 * The copy is checked against what the database actually does. `claim_referral`
 * pays nothing on signup and refuses anyone who already has a listing or a
 * confirmed handover; `convert_referral` credits the REFERRER 250 points, once,
 * and only after the invited person publishes a listing or completes a
 * confirmed handover. The invited person gets nothing from the link at all —
 * so the message says so instead of implying a welcome bonus that would be a
 * lie the moment someone looked for it.
 */
export async function ReferralShare({ link }: { link: string | null }) {
  const t = await getTranslations("referrals");
  if (!link) return null;

  const code = encodeQr(link);
  const message = t("shareText", { link });

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="referral-share">
      <h2 className="text-sm font-semibold">{t("shareTitle")}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("shareHonesty")}</p>

      {code ? (
        <div className="mt-3 flex justify-center">
          <svg
            viewBox={`0 0 ${code.size + 8} ${code.size + 8}`}
            role="img"
            aria-label={t("qrAlt")}
            data-testid="referral-qr"
            // crispEdges keeps module boundaries hard at any size; an
            // antialiased QR is a QR that sometimes will not scan.
            shapeRendering="crispEdges"
            className="size-52 rounded-xl bg-white p-1"
          >
            <path d={qrPath(code)} fill="#000" />
          </svg>
        </div>
      ) : (
        // Only reachable if the site URL grows past the version-5 ceiling.
        <p className="mt-3 text-xs text-muted-foreground" data-testid="referral-qr-unavailable">
          {t("qrUnavailable")}
        </p>
      )}

      <p
        className="mt-3 whitespace-pre-line rounded-xl border border-border/60 bg-muted/25 p-3 text-xs leading-5"
        data-testid="referral-share-text"
      >
        {message}
      </p>
      <ShareActions text={message} />
    </section>
  );
}
