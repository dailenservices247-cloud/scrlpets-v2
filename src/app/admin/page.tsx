import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getPendingPrograms, isPlatformAdmin } from "@/lib/verification/queries";
import { getOpenReports } from "@/lib/moderation/queries";
import { getDraftGuides } from "@/lib/guides/queries";
import { getOverdueShipments } from "@/lib/admin/shipments";
import {
  getModerationLog,
  getOpenTickets,
  getRedemptionQueue,
  getDisputeQueue,
  getSuspendedAccounts,
  getAdminOverviewStats,
  getAdminUsersList,
  getAdminFinancialStats,
  getSystemHealthStats,
} from "@/lib/admin/queries";

import { AdminNav, type AdminTabId } from "@/components/admin/AdminNav";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { UserManagementPanel } from "@/components/admin/UserManagementPanel";
import { OrderInspector } from "@/components/admin/OrderInspector";
import { AdminRevenuePanel } from "@/components/admin/AdminRevenuePanel";
import { AdminSystemHealthPanel } from "@/components/admin/AdminSystemHealthPanel";

import { ProgramReviewQueue } from "@/components/admin/ProgramReviewQueue";
import { DisputeQueue } from "@/components/admin/DisputeQueue";
import { ShipmentQueue } from "@/components/admin/ShipmentQueue";
import { ReportQueue } from "@/components/admin/ReportQueue";
import { GuideApprovalQueue } from "@/components/admin/GuideApprovalQueue";
import { SuspensionPanel } from "@/components/admin/SuspensionPanel";
import { RedemptionQueue } from "@/components/admin/RedemptionQueue";
import { SupportTicketQueue } from "@/components/admin/SupportTicketQueue";
import { ModerationLog } from "@/components/admin/ModerationLog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Command Center — Scrlpets",
  description: "Platform administration, commerce escrow governance, user accounts, and system telemetry.",
};

const VALID_TABS: AdminTabId[] = [
  "overview",
  "users",
  "disputes",
  "revenue",
  "moderation",
  "verifications",
  "support",
  "rewards",
  "system",
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("admin");
  if (!(await isPlatformAdmin())) notFound();

  const { tab: rawTab } = await searchParams;
  const activeTab: AdminTabId = (VALID_TABS.includes(rawTab as AdminTabId) ? rawTab : "overview") as AdminTabId;

  // Lightweight queue counts for the header badges
  const [
    openDisputes,
    openReports,
    pendingPrograms,
    openTickets,
    openRedemptions,
    overdueShipments,
  ] = await Promise.all([
    getDisputeQueue(),
    getOpenReports(),
    getPendingPrograms(),
    getOpenTickets(),
    getRedemptionQueue(),
    getOverdueShipments(),
  ]);

  const badges = {
    disputes: openDisputes.length,
    reports: openReports.length,
    programs: pendingPrograms.length,
    tickets: openTickets.length,
    redemptions: openRedemptions.length,
    shipments: overdueShipments.length,
  };

  return (
    <AppPage>
      <div className="px-3 pb-12 pt-4">
        <AdminNav activeTab={activeTab} badges={badges} />

        {/* Tab 1: Overview & Pulse */}
        {activeTab === "overview" && (
          <OverviewPanel stats={await getAdminOverviewStats()} />
        )}

        {/* Tab 2: User Directory & Access Control */}
        {activeTab === "users" && (
          <UserManagementPanel initialUsers={await getAdminUsersList()} />
        )}

        {/* Tab 3: Disputes, Overdue Shipments, & Order Event Tracer */}
        {activeTab === "disputes" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("disputesHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Orders with active buyer disputes requiring arbitrator adjudication
              </p>
              <div className="mt-2">
                <DisputeQueue disputes={openDisputes} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("shipmentsHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Dispatched orders requiring manual carrier delivery verification
              </p>
              <div className="mt-2">
                <ShipmentQueue rows={overdueShipments} />
              </div>
            </div>

            <div>
              <OrderInspector recentOrderIds={openDisputes.map((d) => d.orderId)} />
            </div>
          </div>
        )}

        {/* Tab 4: Financials & Revenue Ledger */}
        {activeTab === "revenue" && (
          <AdminRevenuePanel stats={await getAdminFinancialStats()} />
        )}

        {/* Tab 5: Content Moderation & Suspensions */}
        {activeTab === "moderation" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("reportsHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Flagged posts, comments, and profile reports
              </p>
              <div className="mt-2">
                <ReportQueue reports={openReports} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("suspensionsHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Accounts currently barred from logging in or conducting commerce
              </p>
              <div className="mt-2">
                <SuspensionPanel suspended={await getSuspendedAccounts()} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("auditHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Append-only log of moderation decisions and official reasons
              </p>
              <div className="mt-2">
                <ModerationLog entries={await getModerationLog()} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Verifications & Compliance */}
        {activeTab === "verifications" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("programsHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Credential verification for kennels, rescues, USDA licenses, and transporters
              </p>
              <div className="mt-2">
                <ProgramReviewQueue programs={pendingPrograms} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t("guidesHeading")}</h2>
              <p className="text-micro text-muted-foreground">
                Educational guides submitted by community members awaiting publication
              </p>
              <div className="mt-2">
                <GuideApprovalQueue drafts={await getDraftGuides()} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Support Tickets */}
        {activeTab === "support" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">{t("ticketsHeading")}</h2>
            <p className="text-micro text-muted-foreground">
              Customer service inquiries, dispute escalations, and technical tickets
            </p>
            <SupportTicketQueue tickets={openTickets} />
          </div>
        )}

        {/* Tab 8: Rewards & Redemptions */}
        {activeTab === "rewards" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">{t("redemptionsHeading")}</h2>
            <p className="text-micro text-muted-foreground">
              Points redemption requests for physical products, fee credits, and boost passes
            </p>
            <RedemptionQueue redemptions={openRedemptions} />
          </div>
        )}

        {/* Tab 9: System Health & Maintenance */}
        {activeTab === "system" && (
          <AdminSystemHealthPanel stats={await getSystemHealthStats()} />
        )}
      </div>
    </AppPage>
  );
}
