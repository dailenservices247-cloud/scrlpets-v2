export type TopicCategory = "breed" | "working" | "care" | "viral" | "reptile" | "insect" | "aquatic" | "avian" | "small_pet";

export type TrendingTopic = {
  tag: string;
  label: string;
  count: number;
  category: TopicCategory;
  hot?: boolean;
};

export const CANONICAL_TRENDING_TOPICS: TrendingTopic[] = [
  // Cross-Species & Discovery
  { tag: "#canecorso", label: "Cane Corso", count: 1420, category: "breed", hot: true },
  { tag: "#antkeeping", label: "Ant Keeping & Nuptial Flights", count: 860, category: "insect", hot: true },
  { tag: "#reptiles", label: "Reptiles & Morphs", count: 1750, category: "reptile", hot: true },
  { tag: "#queenant", label: "Queen Ants & Colonies", count: 540, category: "insect" },
  { tag: "#beardeddragon", label: "Bearded Dragons", count: 1120, category: "reptile" },
  { tag: "#workingdog", label: "Working Dogs", count: 980, category: "working", hot: true },
  { tag: "#ballpython", label: "Ball Pythons & Morphs", count: 1340, category: "reptile" },
  { tag: "#crestedgecko", label: "Crested Geckos", count: 910, category: "reptile" },
  { tag: "#puppy", label: "Litters & Whelps", count: 2150, category: "viral", hot: true },
  { tag: "#aquascaping", label: "Fish & Aquariums", count: 780, category: "aquatic" },
  { tag: "#hollandlop", label: "Holland Lop Rabbits", count: 620, category: "small_pet" },
  { tag: "#parrots", label: "Parrots & Aviary", count: 590, category: "avian" },
  { tag: "#presacanario", label: "Presa Canario", count: 640, category: "breed" },
  { tag: "#alumni", label: "Verified Alumni & Handover", count: 530, category: "care" },
];

export function formatTopicQuery(tag: string): string {
  const clean = tag.startsWith("#") ? tag : `#${tag}`;
  return `/search?q=${encodeURIComponent(clean)}`;
}

export function getTrendingTopics(): TrendingTopic[] {
  return CANONICAL_TRENDING_TOPICS;
}

