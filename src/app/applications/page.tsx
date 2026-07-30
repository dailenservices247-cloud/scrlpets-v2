import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { ApplicationList } from "@/components/marketplace/ApplicationList";
import { getMyApplications } from "@/lib/applications/queries";
import { getReviewableHandovers } from "@/lib/reviews/queries";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { WithdrawAction } from "./WithdrawAction";
import { getSessionUser } from "@/lib/auth/session";

// D13: one inbox, both roles. RLS already scopes rows to the two parties.
export default async function ApplicationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [t, tr, applications, reviewable] = await Promise.all([
    getTranslations("applications"),
    getTranslations("reviews"),
    getMyApplications(),
    getReviewableHandovers(),
  ]);

  // R9: the buyer's own withdrawal window — submitted or accepted, and
  // neither side has confirmed a handover yet (once either has, set_application_status
  // refuses with handover_started and this stops listing the application here).
  const withdrawable = applications.filter(
    (a) =>
      a.buyerId === user.id &&
      (a.status === "submitted" || a.status === "accepted") &&
      !a.buyerConfirmedAt &&
      !a.sellerConfirmedAt,
  );

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("pageSubtitle")}</p>
      </header>
      {reviewable.length > 0 && (
        <section className="px-3 pb-2" data-testid="reviewable-handovers">
          <h2 className="pb-2 text-sm font-semibold">{tr("pending")}</h2>
          <div className="flex flex-col gap-2">
            {reviewable.map((h) => (
              <ReviewForm
                key={h.applicationId}
                applicationId={h.applicationId}
                subjectId={h.sellerId}
                sellerUsername={h.sellerUsername}
                listingTitle={h.listingTitle}
              />
            ))}
          </div>
        </section>
      )}
      {withdrawable.length > 0 && (
        <section className="px-3 pb-2" data-testid="withdrawable-applications">
          <h2 className="pb-2 text-sm font-semibold">{t("withdrawSectionTitle")}</h2>
          <div className="flex flex-col gap-2">
            {withdrawable.map((a) => (
              <WithdrawAction key={a.id} application={a} />
            ))}
          </div>
        </section>
      )}
      <div className="px-3 pb-6">
        <ApplicationList applications={applications} viewerId={user.id} />
      </div>
    </AppPage>
  );
}
