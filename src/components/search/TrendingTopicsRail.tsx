import Link from "next/link";
import { TrendingUp, Flame } from "lucide-react";
import { getTrendingTopics, formatTopicQuery, type TrendingTopic } from "@/lib/search/trending";

export function TrendingTopicsRail({
  selectedTag,
  title = "Trending Community Topics",
}: {
  selectedTag?: string;
  title?: string;
}) {
  const topics: TrendingTopic[] = getTrendingTopics();

  return (
    <section className="mb-4" data-testid="trending-topics-rail">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5 text-brand-link" aria-hidden />
          <span>{title}</span>
        </div>
        <span className="text-micro text-muted-foreground/80">Updated live</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
        {topics.map((t) => {
          const isSelected = selectedTag?.toLowerCase() === t.tag.toLowerCase();
          return (
            <Link
              key={t.tag}
              href={formatTopicQuery(t.tag)}
              className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-card/70 hover:border-primary/50 hover:bg-card"
              }`}
              data-testid={`topic-pill-${t.tag.replace("#", "")}`}
            >
              {t.hot && (
                <Flame className={`size-3 shrink-0 ${isSelected ? "text-primary-foreground" : "text-amber-500"}`} />
              )}
              <span className={isSelected ? "font-semibold" : "font-medium text-foreground"}>{t.tag}</span>
              <span className={`text-micro ${isSelected ? "opacity-90" : "text-muted-foreground"}`}>
                {t.count > 999 ? `${(t.count / 1000).toFixed(1)}k` : t.count}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
