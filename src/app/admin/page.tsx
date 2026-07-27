import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getPendingPrograms, isPlatformAdmin } from "@/lib/verification/queries";
import { ProgramReviewQueue } from "@/components/admin/ProgramReviewQueue";

// D4: the platform-admin surface. Not linked from anywhere public; the DB
// refuses every action for non-admins regardless of what reaches this page.
export default async function AdminPage() {
  const t = await getTranslations("admin");
  if (!(await isPlatformAdmin())) notFound();
  const programs = await getPendingPrograms();

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="px-3 pb-6">
        <ProgramReviewQueue programs={programs} />
      </div>
    </AppPage>
  );
}
