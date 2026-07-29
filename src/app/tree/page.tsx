import { LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { TreeNotice } from "@/components/tree/TreeNotice";
import { TreeHeader } from "@/components/tree/TreeHeader";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getOwnTree, getTreePrivacy, getAcceptedPackLinkCount } from "@/lib/tree/queries";
import { dominantSpeciesIdentity } from "@/lib/species/identity";

export const dynamic = "force-dynamic";


export const metadata = {
  title: "My Tree",
  description: "Your Ecosystem Tree — generations, lineage, and pack.",
};

// Not middleware-gated (see src/lib/auth/access.ts) — this page renders its
// own sign-in prompt instead of redirecting, per the build spec.
export default async function TreePage() {
  const t = await getTranslations("tree");
  const user = await getSessionUser();

  if (!user) {
    return (
      <AppPage>
        <TreeNotice
          icon={LogIn}
          eyebrow={t("eyebrow")}
          title={t("signInTitle")}
          body={t("signInBody")}
          cta={{ href: loginHrefFor("/tree"), label: t("signInCta") }}
          testId="tree-signin-notice"
        />
      </AppPage>
    );
  }

  const [tree, privacy, packSize] = await Promise.all([
    getOwnTree(user.id),
    getTreePrivacy(user.id),
    getAcceptedPackLinkCount(user.id),
  ]);
  const identity = dominantSpeciesIdentity(tree.creatures.map((c) => c.species));
  const stats = {
    animals: tree.creatures.length,
    memorials: tree.creatures.filter((c) => c.deceasedAt).length,
    packSize,
  };

  return (
    <AppPage>
      <TreeHeader identity={identity} stats={stats} initialPrivacy={privacy} />
      <TreeCanvas generations={tree.generations} creatures={tree.creatures} canManage />
    </AppPage>
  );
}
