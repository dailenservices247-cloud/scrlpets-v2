import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type MarketTab = "animals" | "supplies" | "services";

export const MARKET_TABS: readonly MarketTab[] = ["animals", "supplies", "services"];

/**
 * Switching tab drops the filters on purpose: species/intent mean nothing to
 * supplies, and a category carried from supplies into services would name a
 * category that tab has never heard of.
 */
export function MarketTabs({ tab, label }: { tab: MarketTab; label: string }) {
  const t = useTranslations("market");
  return (
    <nav className="flex gap-2 overflow-x-auto px-4 pb-4" aria-label={label} data-testid="market-tabs">
      {MARKET_TABS.map((value) => {
        const active = value === tab;
        return (
          <Link
            key={value}
            href={`/market?tab=${value}`}
            aria-current={active ? "page" : undefined}
            data-testid={`market-tab-${value}`}
            className={cn(
              "inline-flex min-h-11 items-center shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
              active ? "border-primary bg-primary/10 font-bold text-brand-link" : "border-input text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t(`tab.${value}`)}
          </Link>
        );
      })}
    </nav>
  );
}
