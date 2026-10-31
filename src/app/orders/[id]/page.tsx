import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Star } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getOrderThread } from "@/lib/orders/thread";
import { createClient } from "@/lib/supabase/server";
import { OrderThread } from "@/components/orders/OrderThread";
import { OrderActions } from "@/components/orders/OrderActions";
import { OrderDossierPanel } from "@/components/orders/OrderDossierPanel";
import { OrderInspectionBanner } from "@/components/orders/OrderInspectionBanner";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { getOrderCounterpartyDossier } from "@/lib/contracts/queries";
import { getReviewableHandovers } from "@/lib/reviews/queries";

/**
 * One order, and the people involved in it.
 *
 * The thread is not a second messaging system. `conversations` is a relationship
 * between two people and its security model is about CONSENT to be contacted;
 * this is a thread about a transaction, where membership is a fact of the order.
 * A driver does not need the buyer's permission to say they are running late.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orderThread");
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor(`/orders/${id}`));

  const supabase = await createClient();
  // RLS returns the order only to its parties, so a non-party gets a 404 rather
  // than a permission message that confirms the order exists.
  const { data } = await supabase
    .from("orders")
    .select(
      "id,title_snapshot,status,fulfilment,buyer_id,seller_id,transporter_id,transport_payout_policy,transport_surcharge_cents,picked_up_at,animal_returned_at,inspection_ends_at,inspection_hours,handover_at,listing_id",
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
    transport_payout_policy: string | null;
    transport_surcharge_cents: number | null;
    picked_up_at: string | null;
    animal_returned_at: string | null;
    inspection_ends_at: string | null;
    inspection_hours: number | null;
    handover_at: string | null;
    listing_id: string | null;
  } | null;

  if (!order) notFound();

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  const isTransporter = Boolean(order.transporter_id && user.id === order.transporter_id);

  const [messages, dossier, reviewableHandovers] = await Promise.all([
    getOrderThread(id),
    getOrderCounterpartyDossier(id),
    isBuyer ? getReviewableHandovers() : Promise.resolve([]),
  ]);

  // Check if buyer has an active reviewable handover matching this seller
  const pendingReview = isBuyer
    ? reviewableHandovers.find((h) => h.sellerId === order.seller_id)
    : null;

  // If already released and buyer, check for existing review to display badge
  let existingReview: { id: string; rating: number; title: string | null } | null = null;
  if (isBuyer && order.status === "released" && !pendingReview) {
    const { data: rev } = await supabase
      .from("reviews")
      .select("id,rating,title")
      .eq("reviewer_id", user.id)
      .eq("subject_id", order.seller_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingReview = rev as { id: string; rating: number; title: string | null } | null;
  }

  return (
    <AppPage showBottomNav={false}>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{order.title_snapshot ?? t("untitled")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(`status.${order.status}`)}
        </p>
      </header>
      <div className="flex flex-col gap-4 px-3 pb-10">
        {/* Prominent Inspection Window Countdown */}
        {order.status === "inspection" && (
          <OrderInspectionBanner
            orderId={order.id}
            status={order.status}
            isBuyer={isBuyer}
            isSeller={isSeller}
            isTransporter={isTransporter}
            inspectionEndsAt={order.inspection_ends_at}
            inspectionHours={order.inspection_hours ?? 24}
            handoverAt={order.handover_at}
          />
        )}

        {/* Completed Order Review Banner / Form */}
        {order.status === "released" && isBuyer && (
          <section className="premium-panel rounded-2xl p-4" data-testid="order-completed-review-section">
            {pendingReview ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-amber-500/20 text-amber-500">
                    <Star className="size-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Leave a Verified Review for @{pendingReview.sellerUsername ?? "Seller"}
                    </h2>
                    <p className="text-micro text-muted-foreground">
                      Transaction completed & funds released. Share your verified experience.
                    </p>
                  </div>
                </div>
                <ReviewForm
                  applicationId={pendingReview.applicationId}
                  subjectId={pendingReview.sellerId}
                  sellerUsername={pendingReview.sellerUsername}
                  listingTitle={pendingReview.listingTitle ?? order.title_snapshot}
                />
              </div>
            ) : existingReview ? (
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Verified Review Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {"★".repeat(existingReview.rating)} · {existingReview.title ? `"${existingReview.title}"` : "Thank you for rating!"}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        )}

        <OrderDossierPanel
          dossier={dossier}
          transportPayoutPolicy={order.transport_payout_policy ?? undefined}
          transportSurchargeCents={order.transport_surcharge_cents ?? undefined}
        />

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
    </AppPage>
  );
}
