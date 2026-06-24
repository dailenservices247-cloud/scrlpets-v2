"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALUES = ["posts", "pets", "about"] as const;
export type ProfileTab = (typeof VALUES)[number];

export function ProfileTabs() {
  const t = useTranslations("profile");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: ProfileTab = (VALUES as readonly string[]).includes(raw ?? "") ? (raw as ProfileTab) : "posts";
  return (
    <Tabs value={tab} onValueChange={(v) => router.push(`${pathname}?tab=${v}`)}>
      <TabsList className="h-11 w-full rounded-xl border border-border/80 bg-muted/60 p-1 shadow-inner">
        <TabsTrigger value="posts" className="h-9 flex-1 rounded-lg text-sm font-semibold" data-testid="ptab-posts">
          {t("tabPosts")}
        </TabsTrigger>
        <TabsTrigger value="pets" className="h-9 flex-1 rounded-lg text-sm font-semibold" data-testid="ptab-pets">
          {t("tabPets")}
        </TabsTrigger>
        <TabsTrigger value="about" className="h-9 flex-1 rounded-lg text-sm font-semibold" data-testid="ptab-about">
          {t("tabAbout")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
