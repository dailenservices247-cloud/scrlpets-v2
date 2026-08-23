import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getOrderThread } from "@/lib/orders/thread";
import { createClient } from "@/lib/supabase/server";
import { OrderThread } from "@/components/orders/OrderThread";
import { OrderActions } from "@/components/orders/OrderActions";

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
  if (!order) notFound();

  const messages = await getOrderThread(id);

  return (
    <AppPage showBottomNav={false}>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{order.title_snapshot ?? t("untitled")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(`status.${order.status}`)}
        </p>
      </header>
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
    </AppPage>
  );
}
