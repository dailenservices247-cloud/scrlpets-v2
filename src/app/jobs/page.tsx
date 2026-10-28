import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getMyTransportJobs, getInboundTransportQuotes } from "@/lib/jobs/queries";
import { JobList } from "@/components/jobs/JobList";
import { QuoteRequestsList } from "@/components/jobs/QuoteRequestsList";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("jobs");
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/jobs"));

  const { tab = "active" } = await searchParams;
  const [jobs, quotes] = await Promise.all([
    getMyTransportJobs(),
    getInboundTransportQuotes(),
  ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>

        {/* Tab switcher */}
        <div className="mt-4 flex gap-2 border-b border-border/60 pb-2">
          <a
            href="/jobs?tab=active"
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              tab === "active"
                ? "bg-primary/15 text-brand-link font-semibold"
                : "text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Active Deliveries ({jobs.length})
          </a>
          <a
            href="/jobs?tab=quotes"
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              tab === "quotes"
                ? "bg-primary/15 text-brand-link font-semibold"
                : "text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Quote Requests ({quotes.filter((q) => q.status === "requested").length})
          </a>
        </div>
      </header>
      <div className="px-3 pb-10">
        {tab === "quotes" ? (
          <QuoteRequestsList quotes={quotes} />
        ) : (
          <JobList jobs={jobs} />
        )}
      </div>
    </AppPage>
  );
}
