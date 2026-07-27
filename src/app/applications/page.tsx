import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { ApplicationList } from "@/components/marketplace/ApplicationList";
import { getMyApplications } from "@/lib/applications/queries";
import { getSessionUser } from "@/lib/auth/session";

// D13: one inbox, both roles. RLS already scopes rows to the two parties.
export default async function ApplicationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [t, applications] = await Promise.all([
    getTranslations("applications"),
    getMyApplications(),
  ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("pageSubtitle")}</p>
      </header>
      <div className="px-3 pb-6">
        <ApplicationList applications={applications} viewerId={user.id} />
      </div>
    </AppPage>
  );
}
