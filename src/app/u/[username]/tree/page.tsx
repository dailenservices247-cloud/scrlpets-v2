import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { TreeNotice } from "@/components/tree/TreeNotice";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { getSessionUser } from "@/lib/auth/session";
import { dominantSpeciesIdentity } from "@/lib/species/identity";
import { getTreeOwnerProfile, getVisitorTree, hasAcceptedPackLink } from "@/lib/tree/queries";

export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const owner = await getTreeOwnerProfile(username);
  if (!owner) return {};
  const name = owner.displayName ?? owner.username;
  return {
    title: `${name}'s tree`,
    description: `The Ecosystem Tree for @${owner.username} on Scrlpets.`,
  };
}

export default async function VisitorTreePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const t = await getTranslations("tree");
  const owner = await getTreeOwnerProfile(username);
  if (!owner) notFound();

  if (owner.treePrivacy === "private") {
    return (
      <AppPage>
        <TreeNotice
          icon={Lock}
          eyebrow={t("eyebrow")}
          title={t("privateTitle")}
          body={t("privateBody")}
          testId="tree-private-notice"
        />
      </AppPage>
    );
  }

  if (owner.treePrivacy === "buyers") {
    const viewer = await getSessionUser();
    const allowed = viewer ? await hasAcceptedPackLink(viewer.id, owner.id) : false;
    if (!allowed) {
      return (
        <AppPage>
          <TreeNotice
            icon={Lock}
            eyebrow={t("eyebrow")}
            title={t("buyersTitle")}
            body={t("buyersBody")}
            testId="tree-buyers-notice"
          />
        </AppPage>
      );
    }
  }

  const tree = await getVisitorTree(owner.id);
  const identity = dominantSpeciesIdentity(tree.creatures.map((c) => c.species));
  const name = owner.displayName ?? owner.username;

  return (
    <AppPage>
      <section className="px-3 pb-3 pt-4" data-testid="visitor-tree-header">
        <div className="premium-panel rounded-2xl p-4">
          <p className="eyebrow">{identity.roleBadge}</p>
          <h1 className="mt-1 text-2xl font-semibold" data-testid="visitor-tree-group-name">
            {t("visitorTitle", { name, groupName: identity.groupName })}
          </h1>
        </div>
      </section>
      <TreeCanvas generations={tree.generations} creatures={tree.creatures} canManage={false} />
    </AppPage>
  );
}
