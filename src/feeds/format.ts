import type { HotspotItem, SubscriptionItem } from "../types.js";

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  authorName: string;
  publishedAt: string;
};

export function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pubDate(input: string): string {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function isoDate(input: string): string {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function subscriptionFeedItem(item: SubscriptionItem): FeedItem {
  return {
    id: item.dedupeKey,
    title: item.title,
    url: item.url,
    summary: item.summary,
    authorName: item.authorName,
    publishedAt: item.publishedAt ?? item.capturedAt
  };
}

export function hotspotFeedItem(item: HotspotItem): FeedItem {
  return {
    id: item.dedupeKey,
    title: `#${item.rank} ${item.title}`,
    url: item.url,
    summary: [item.platform, item.heat ? `heat: ${item.heat}` : "", item.label ?? ""].filter(Boolean).join(" | "),
    authorName: item.provider,
    publishedAt: item.capturedAt
  };
}

export function generateRss(items: FeedItem[], options: { title: string; description: string; link: string }): string {
  const itemXml = items
    .map(
      (item) => `    <item>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <description>${escapeXml(item.summary)}</description>
      <author>${escapeXml(item.authorName)}</author>
      <pubDate>${pubDate(item.publishedAt)}</pubDate>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.link)}</link>
    <description>${escapeXml(options.description)}</description>
    <generator>hotspot-collector</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemXml}
  </channel>
</rss>`;
}

export function generateJsonFeed(items: FeedItem[], options: { title: string; description: string; link: string }): string {
  return JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: options.title,
      home_page_url: options.link,
      description: options.description,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        summary: item.summary,
        content_text: item.summary,
        date_published: isoDate(item.publishedAt),
        authors: [{ name: item.authorName }]
      }))
    },
    null,
    2
  );
}
