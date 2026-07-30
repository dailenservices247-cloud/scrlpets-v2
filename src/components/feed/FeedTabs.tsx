"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FeedTabs({ broadened = false }: { broadened?: boolean }) {
  const t = useTranslations("feed");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "for_you" ? "for_you" : "following";
  return (
    <>
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
      {/* A Following tab that quietly shows strangers is a lie about where the
          content came from. When the graph is too small to fill a feed, say so
          in the surface's own words instead of relabelling the tab under the
          reader mid-scroll. */}
      {tab === "following" && broadened && (
        <p
          className="mt-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground"
          role="status"
          data-testid="following-broadened-notice"
        >
          <span className="font-semibold text-foreground">{t("broadenedLabel")}</span>{" "}
          {t("broadenedBody")}
        </p>
      )}
    </>
  );
}
