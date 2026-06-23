import { FeedTabs } from "./FeedTabs";

export function FeedSectionControls() {
  return (
    <section
      className="border-b border-border/80 bg-background/70 px-4 py-3"
      data-testid="feed-section-controls"
    >
      <FeedTabs />
    </section>
  );
}
