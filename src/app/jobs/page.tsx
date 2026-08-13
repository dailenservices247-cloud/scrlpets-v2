import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getMyTransportJobs } from "@/lib/jobs/queries";
import { JobList } from "@/components/jobs/JobList";

/**
 * What a booked driver is carrying.
 *
 * my_transport_jobs already scopes to the signed-in transporter and withholds
 * addresses until the buyer's money is captured, so this page renders what it is
 * given rather than deciding any of it.
 */
export default async function JobsPage() {
  const t = await getTranslations("jobs");
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/jobs"));

  const jobs = await getMyTransportJobs();

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="px-3 pb-10">
        <JobList jobs={jobs} />
      </div>
    </AppPage>
  );
}
