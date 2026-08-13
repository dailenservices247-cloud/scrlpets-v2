import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { isPaymentsEnabled } from "@/lib/orders/queries";
import { getCheckoutListing } from "@/lib/checkout/queries";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

/**
 * Buying an animal.
 *
 * Nothing here decides money. Every figure shown is either the listing's own or
 * derived by `create_order`, which freezes the fee at the moment the order is
 * struck — a total computed on this page would be a second source that could
 * disagree with what is actually charged.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("checkout");
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor(`/checkout/${id}`));

  const [listing, paymentsEnabled] = await Promise.all([
    getCheckoutListing(id),
    isPaymentsEnabled(),
  ]);
  if (!listing) notFound();

  // A seller cannot buy their own animal; create_order refuses it too, but
  // sending them to a checkout that will refuse is a worse way to say so.
  if (listing.sellerId === user.id) redirect(`/listing/${id}`);

  return (
    <AppPage showBottomNav={false}>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{listing.title}</p>
      </header>
      <div className="px-3 pb-10">
        <CheckoutFlow listing={listing} paymentsEnabled={paymentsEnabled} />
      </div>
    </AppPage>
  );
}
