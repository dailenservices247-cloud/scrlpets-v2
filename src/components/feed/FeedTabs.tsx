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
      <TabsList className="h-11 w-full rounded-xl border border-border/80 bg-muted/70 p-1 shadow-inner">
        <TabsTrigger value="following" className="h-9 flex-1 rounded-lg text-sm font-semibold" data-testid="tab-following">
          {t("following")}
        </TabsTrigger>
        <TabsTrigger value="for_you" className="h-9 flex-1 rounded-lg text-sm font-semibold" data-testid="tab-for-you">
          {t("forYou")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
