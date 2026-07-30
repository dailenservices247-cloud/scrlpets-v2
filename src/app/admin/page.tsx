import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getPendingPrograms, isPlatformAdmin } from "@/lib/verification/queries";
import { getOpenReports } from "@/lib/moderation/queries";
import { getDraftGuides } from "@/lib/guides/queries";
import {
  getModerationLog,
  getOpenTickets,
  getRedemptionQueue,
  getSuspendedAccounts,
} from "@/lib/admin/queries";
import { ProgramReviewQueue } from "@/components/admin/ProgramReviewQueue";
import { ReportQueue } from "@/components/admin/ReportQueue";
import { GuideApprovalQueue } from "@/components/admin/GuideApprovalQueue";
import { SuspensionPanel } from "@/components/admin/SuspensionPanel";
import { RedemptionQueue } from "@/components/admin/RedemptionQueue";
import { SupportTicketQueue } from "@/components/admin/SupportTicketQueue";
import { ModerationLog } from "@/components/admin/ModerationLog";

// D4/E: the platform-admin surface. Not linked from anywhere public; the DB
// refuses every action for non-admins regardless of what reaches this page.
export default async function AdminPage() {
  const t = await getTranslations("admin");
  if (!(await isPlatformAdmin())) notFound();
  const [programs, reports, drafts, tickets, redemptions, suspended, log] = await Promise.all([
    getPendingPrograms(),
    getOpenReports(),
    getDraftGuides(),
    getOpenTickets(),
    getRedemptionQueue(),
    getSuspendedAccounts(),
    getModerationLog(),
  ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="px-3 pb-6">
        <h2 className="pb-2 text-sm font-semibold">{t("reportsHeading")}</h2>
        <ReportQueue reports={reports} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("ticketsHeading")}</h2>
        <SupportTicketQueue tickets={tickets} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("redemptionsHeading")}</h2>
        <RedemptionQueue redemptions={redemptions} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("programsHeading")}</h2>
        <ProgramReviewQueue programs={programs} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("guidesHeading")}</h2>
        <GuideApprovalQueue drafts={drafts} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("suspensionsHeading")}</h2>
        <SuspensionPanel suspended={suspended} />
        <h2 className="pb-2 pt-6 text-sm font-semibold">{t("auditHeading")}</h2>
        <ModerationLog entries={log} />
      </div>
    </AppPage>
  );
}
