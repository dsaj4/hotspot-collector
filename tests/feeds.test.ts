import { describe, expect, it } from "vitest";
import { generateJsonFeed, generateRss, hotspotFeedItem, subscriptionFeedItem } from "../src/feeds/format.js";
import type { HotspotItem, SubscriptionItem } from "../src/types.js";

describe("feed formatting", () => {
  it("renders subscription items as RSS and JSON Feed", () => {
    const source: SubscriptionItem = {
      id: "sub-1",
      sourceId: "rss-example",
      platform: "rss",
      provider: "direct-rss",
      authorId: "author",
      authorName: "Author",
      title: "Hello & World",
      url: "https://example.com/hello",
      publishedAt: "2026-05-29T00:00:00.000Z",
      capturedAt: "2026-05-29T01:00:00.000Z",
      summary: "Summary",
      media: [],
      rawRef: "data/raw/rss.json",
      dedupeKey: "rss-example:hello"
    };

    const item = subscriptionFeedItem(source);
    expect(generateRss([item], { title: "Feed", description: "Desc", link: "https://example.com" })).toContain("Hello &amp; World");
    expect(JSON.parse(generateJsonFeed([item], { title: "Feed", description: "Desc", link: "https://example.com" })).items[0].id).toBe(
      "rss-example:hello"
    );
  });

  it("renders hotspot rank in feed title", () => {
    const item: HotspotItem = {
      id: "hot-1",
      sourceId: "github-trending",
      platform: "github",
      provider: "html-public",
      rank: 2,
      title: "repo/name",
      url: "https://github.com/repo/name",
      category: "hotspot",
      capturedAt: "2026-05-29T00:00:00.000Z",
      rawRef: "data/raw/github.json",
      dedupeKey: "github-trending:repo"
    };

    expect(hotspotFeedItem(item).title).toBe("#2 repo/name");
  });
});
