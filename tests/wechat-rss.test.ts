import { describe, expect, it } from "vitest";
import {
  buildFeedUrl,
  jsonFeedItems,
  makeWechatSubscriptionItem,
  stripHtml,
  xmlFeedItems
} from "../src/adapters/subscriptions/wechat-rss.js";

describe("wechat rss adapter helpers", () => {
  it("builds feed urls for json and rss variants", () => {
    expect(buildFeedUrl("http://127.0.0.1:4000/", "/feeds/all.json", "rss")).toBe("http://127.0.0.1:4000/feeds/all.rss");
  });

  it("extracts json feed item arrays from common shapes", () => {
    expect(jsonFeedItems({ items: [{ title: "A" }] })).toHaveLength(1);
    expect(jsonFeedItems({ data: { items: [{ title: "B" }] } })).toHaveLength(1);
    expect(jsonFeedItems({ data: [{ title: "C" }] })).toHaveLength(1);
  });

  it("extracts RSS item fields", () => {
    const xml = `
      <rss><channel><item>
        <title><![CDATA[Article &amp; title]]></title>
        <link>https://example.com/a</link>
        <pubDate>Thu, 28 May 2026 10:00:00 GMT</pubDate>
        <author>Account</author>
        <description><![CDATA[<p>Hello</p>]]></description>
      </item></channel></rss>
    `;

    const items = xmlFeedItems(xml);
    expect(items[0]?.title).toBe("Article & title");
    expect(items[0]?.url).toBe("https://example.com/a");
    expect(stripHtml(items[0]?.summary ?? "")).toBe("Hello");
  });

  it("creates subscription items only when title and url are present", () => {
    const item = makeWechatSubscriptionItem({
      sourceId: "wechat-rss-all",
      provider: "wewe-rss-local",
      feed: "all",
      rawRef: "data/raw/wechat.json",
      capturedAt: "2026-05-28T03:00:00.000Z",
      index: 0,
      item: {
        id: "1",
        title: "A useful post",
        url: "https://example.com/post",
        author: { name: "Public Account" },
        content_html: "<p>summary</p>"
      }
    });

    expect(item?.platform).toBe("wechat");
    expect(item?.authorName).toBe("Public Account");
    expect(item?.summary).toBe("summary");
    expect(item?.rawRef).toBe("data/raw/wechat.json");
  });
});
