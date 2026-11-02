export type TopicCategory = "breed" | "working" | "care" | "viral";

export type TrendingTopic = {
  tag: string;
  label: string;
  count: number;
  category: TopicCategory;
  hot?: boolean;
};

export const CANONICAL_TRENDING_TOPICS: TrendingTopic[] = [
  { tag: "#canecorso", label: "Cane Corso", count: 1420, category: "breed", hot: true },
  { tag: "#workingdog", label: "Working Dogs", count: 980, category: "working", hot: true },
  { tag: "#presacanario", label: "Presa Canario", count: 640, category: "breed", hot: true },
  { tag: "#puppy", label: "Litters & Whelps", count: 2150, category: "viral", hot: true },
  { tag: "#protectiondog", label: "Personal Protection", count: 820, category: "working" },
  { tag: "#frenchbulldog", label: "French Bulldog", count: 1890, category: "breed" },
  { tag: "#studservice", label: "Verified Studs", count: 410, category: "care" },
  { tag: "#malinois", label: "Belgian Malinois", count: 770, category: "working" },
  { tag: "#germanshepherd", label: "German Shepherd", count: 1260, category: "breed" },
  { tag: "#alumni", label: "Verified Alumni", count: 530, category: "care" },
];

export function formatTopicQuery(tag: string): string {
  const clean = tag.startsWith("#") ? tag : `#${tag}`;
  return `/search?q=${encodeURIComponent(clean)}`;
}

export function getTrendingTopics(): TrendingTopic[] {
  return CANONICAL_TRENDING_TOPICS;
}
