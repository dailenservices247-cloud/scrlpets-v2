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
      <TabsList className="w-full">
        <TabsTrigger value="posts" className="flex-1" data-testid="ptab-posts">
          {t("tabPosts")}
        </TabsTrigger>
        <TabsTrigger value="pets" className="flex-1" data-testid="ptab-pets">
          {t("tabPets")}
        </TabsTrigger>
        <TabsTrigger value="about" className="flex-1" data-testid="ptab-about">
          {t("tabAbout")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
