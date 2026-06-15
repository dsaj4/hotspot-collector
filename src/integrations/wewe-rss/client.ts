import { fetchJson, fetchText } from "../../core/http.js";
import { sha1 } from "../../core/hash.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { nowIso } from "../../core/time.js";
import type { SourceHealth, SubscriptionItem } from "../../types.js";

export type JsonFeedItem = {
  id?: string;
  title?: string;
  url?: string;
  link?: string;
  date_published?: string;
  date_modified?: string;
  published?: string;
  author?: { name?: string };
  authors?: Array<{ name?: string }>;
  summary?: string;
  content_text?: string;
  content_html?: string;
};

type JsonFeed = {
  title?: string;
  items?: JsonFeedItem[];
  data?: { items?: JsonFeedItem[] } | JsonFeedItem[];
};

export function decodeXml(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "");
}

export function stripHtml(input: string): string {
  return decodeXml(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function buildFeedUrl(baseUrl: string, feed: string, suffix: "json" | "rss" | "atom"): string {
  const base = baseUrl.replace(/\/$/, "");
  const normalizedFeed = feed.replace(/^\/?feeds\//, "").replace(/\.(json|rss|atom)$/i, "");
  return `${base}/feeds/${encodeURIComponent(normalizedFeed)}.${suffix}`;
}

export function jsonFeedItems(payload: unknown): JsonFeedItem[] {
  const feed = payload as JsonFeed;
  if (Array.isArray(feed.items)) return feed.items;
  if (Array.isArray(feed.data)) return feed.data;
  if (feed.data && !Array.isArray(feed.data) && Array.isArray(feed.data.items)) return feed.data.items;
  return [];
}

export function xmlFeedItems(xml: string): JsonFeedItem[] {
  const matches = [...xml.matchAll(/<(item|entry)>[\s\S]*?<\/\1>/g)];
  return matches.map((match) => {
    const block = match[0];
    const value = (tag: string): string => {
      const tagMatch = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return tagMatch ? decodeXml(tagMatch[1]).trim() : "";
    };
    const atomLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
    return {
      title: value("title"),
      url: value("link") || atomLink,
      date_published: value("pubDate") || value("published") || value("updated"),
      author: { name: value("author") },
      summary: value("description") || value("summary"),
      content_html: value("content:encoded")
    };
  });
}

export function makeWechatSubscriptionItem(input: {
  sourceId: string;
  provider: string;
  feed: string;
  rawRef: string;
  capturedAt: string;
  item: JsonFeedItem;
  index: number;
}): SubscriptionItem | null {
  const title = String(input.item.title ?? "").trim();
  const url = String(input.item.url ?? input.item.link ?? "").trim();
  if (!title || !url) return null;

  const authorName =
    input.item.author?.name ?? input.item.authors?.[0]?.name ?? input.feed.replace(/^all$/i, "WeChat public account");
  const publishedAt = input.item.date_published ?? input.item.published ?? input.item.date_modified ?? null;
  const summary = stripHtml(input.item.summary ?? input.item.content_text ?? input.item.content_html ?? "").slice(0, 500);
  const stableId = String(input.item.id ?? url ?? `${title}-${input.index}`);

  return {
    id: `${input.sourceId}-${sha1(stableId).slice(0, 12)}`,
    sourceId: input.sourceId,
    platform: "wechat",
    provider: input.provider,
    authorId: input.feed,
    authorName,
    title,
    url,
    publishedAt,
    capturedAt: input.capturedAt,
    summary,
    media: [],
    rawRef: input.rawRef,
    dedupeKey: `${input.sourceId}:${sha1(url || title)}`
  };
}

export async function collectWechatRssSubscriptions(
  baseUrl: string,
  feeds: string[],
  limit: number
): Promise<{ items: SubscriptionItem[]; rawRefs: string[]; health: SourceHealth[] }> {
  const capturedAt = nowIso();
  const provider = "wewe-rss-local";
  const enabledFeeds = feeds.length ? feeds : ["all"];
  const items: SubscriptionItem[] = [];
  const rawRefs: string[] = [];
  const health: SourceHealth[] = [];

  for (const feed of enabledFeeds) {
    const sourceId = `wechat-rss-${feed}`;
    try {
      let payload: unknown;
      let parsedItems: JsonFeedItem[] = [];
      try {
        payload = await fetchJson(buildFeedUrl(baseUrl, feed, "json"));
        parsedItems = jsonFeedItems(payload);
      } catch {
        const xml = await fetchText(buildFeedUrl(baseUrl, feed, "rss"), { Accept: "application/rss+xml,text/xml,*/*" });
        payload = { xml };
        parsedItems = xmlFeedItems(xml);
      }

      const rawRef = await writeRawSnapshot(sourceId, { provider, baseUrl, feed, payload });
      rawRefs.push(rawRef);
      const normalized = parsedItems
        .slice(0, limit)
        .map((item, index) => makeWechatSubscriptionItem({ sourceId, provider, feed, rawRef, capturedAt, item, index }))
        .filter((item): item is SubscriptionItem => Boolean(item));
      items.push(...normalized);
      health.push({ sourceId, status: normalized.length ? "ok" : "empty", checkedAt: capturedAt, provider, itemCount: normalized.length });
    } catch (error) {
      health.push({
        sourceId,
        status: "unavailable",
        checkedAt: capturedAt,
        provider,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { items, rawRefs, health };
}
