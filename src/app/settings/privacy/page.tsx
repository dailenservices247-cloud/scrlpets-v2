import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TreePrivacy } from "@/lib/tree/queries";
import { PrivacyForm } from "@/components/settings/PrivacyForm";

export const metadata = {
  title: "Privacy & Visibility | Scrlpets",
  description: "Manage pedigree lineage visibility, reciprocal read receipts, and trust settings.",
};

export default async function PrivacySettingsPage() {
  const user = await getSessionUser();

  let initialTreePrivacy: TreePrivacy = "public";
  let initialReadReceipts = true;

  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("tree_privacy, show_read_receipts")
      .eq("id", user.id)
      .maybeSingle();

    if (data?.tree_privacy) {
      initialTreePrivacy = data.tree_privacy as TreePrivacy;
    }
    if (typeof data?.show_read_receipts === "boolean") {
      initialReadReceipts = data.show_read_receipts;
    }
  }

  return (
    <AppPage>
      <div className="p-4 sm:p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Privacy & Visibility</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure lineage tree accessibility, reciprocal read receipts, and verified identity safeguards.
            </p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>

        <PrivacyForm
          initialTreePrivacy={initialTreePrivacy}
          initialReadReceipts={initialReadReceipts}
        />
      </div>
    </AppPage>
  );
}
