"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FeedTabs() {
  const t = useTranslations("feed");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "for_you" ? "for_you" : "following";
  return (
    <Tabs value={tab} onValueChange={(v) => router.push(`/?tab=${v}`)}>
      <TabsList className="w-full">
        <TabsTrigger value="following" className="flex-1" data-testid="tab-following">
          {t("following")}
        </TabsTrigger>
        <TabsTrigger value="for_you" className="flex-1" data-testid="tab-for-you">
          {t("forYou")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
