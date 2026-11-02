import { describe, it, expect } from "vitest";
import { getTrendingTopics, formatTopicQuery } from "@/lib/search/trending";

describe("Trending Topics Discovery", () => {
  it("provides populated list of trending pet & breed topics", () => {
    const topics = getTrendingTopics();
    expect(topics.length).toBeGreaterThan(5);
    expect(topics.some((t) => t.tag === "#canecorso")).toBe(true);
    expect(topics.some((t) => t.tag === "#workingdog")).toBe(true);
    expect(topics.some((t) => t.tag === "#puppy")).toBe(true);
  });

  it("formats topic queries correctly with URL encoding", () => {
    expect(formatTopicQuery("#canecorso")).toBe("/search?q=%23canecorso");
    expect(formatTopicQuery("workingdog")).toBe("/search?q=%23workingdog");
    expect(formatTopicQuery("#french bulldog")).toBe("/search?q=%23french%20bulldog");
  });

  it("assigns valid categories to each topic", () => {
    const topics = getTrendingTopics();
    const validCategories = ["breed", "working", "care", "viral"];
    topics.forEach((t) => {
      expect(validCategories).toContain(t.category);
      expect(t.count).toBeGreaterThan(0);
    });
  });
});
