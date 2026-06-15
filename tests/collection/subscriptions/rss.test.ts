import { describe, expect, it } from "vitest";
import { parseFeedText, resolveDirectFeedUrl, rssItemToSubscription } from "../../../src/collection/subscriptions/rss.js";
import type { SourceConfig } from "../../../src/types.js";

const source: SourceConfig = {
  id: "rss-example",
  kind: "subscription",
  platform: "rss",
  name: "RSS Example",
  enabled: true,
  intervalMinutes: 60,
  fetchMode: "direct-rss",
  params: { inputUrl: "https://example.com/feed.xml" },
  policy: {
    requiresLogin: false,
    usesCookie: false,
    usesBrowserSession: false,
    publicOnly: true,
    enabledByDefault: true
  }
};

describe("RSS subscription utilities", () => {
  it("parses RSS item XML", () => {
    const items = parseFeedText(`
      <rss><channel><item>
        <title>Hello</title>
        <link>https://example.com/hello</link>
        <description><![CDATA[<p>Summary</p>]]></description>
        <pubDate>Fri, 29 May 2026 12:00:00 +0800</pubDate>
      </item></channel></rss>
    `);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Hello");
    expect(items[0].url).toBe("https://example.com/hello");
  });

  it("normalizes RSS items into subscription items", () => {
    const item = rssItemToSubscription({
      source,
      provider: "direct-rss",
      rawRef: "data/raw/rss.json",
      capturedAt: "2026-05-29T00:00:00.000Z",
      index: 0,
      item: {
        title: "Hello",
        url: "https://example.com/hello",
        summary: "<p>Summary</p>",
        author: { name: "Example" }
      }
    });

    expect(item?.platform).toBe("rss");
    expect(item?.provider).toBe("direct-rss");
    expect(item?.summary).toBe("Summary");
  });

  it("builds native YouTube RSS URLs", () => {
    expect(
      resolveDirectFeedUrl({
        ...source,
        id: "youtube-channel",
        platform: "youtube",
        params: { platformId: "UC123" }
      })
    ).toBe("https://www.youtube.com/feeds/videos.xml?channel_id=UC123");
  });
});
