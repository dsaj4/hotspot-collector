import { fetchText } from "../../core/http.js";
import { sha1 } from "../../core/hash.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { nowIso } from "../../core/time.js";
import type { SourceConfig, SourceHealth, SubscriptionItem } from "../../types.js";
import { jsonFeedItems, stripHtml, xmlFeedItems, type JsonFeedItem } from "./wechat-rss.js";

function param(source: SourceConfig, key: string): string {
  const value = source.params?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function resolveDirectFeedUrl(source: SourceConfig): string {
  if (source.platform === "youtube") {
    const channelId = param(source, "platformId") || param(source, "channelId");
    if (!channelId) throw new Error(`YouTube source ${source.id} is missing channelId/platformId.`);
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  }

  const url = param(source, "feedUrl") || param(source, "inputUrl") || param(source, "url");
  if (!url) throw new Error(`RSS source ${source.id} is missing feedUrl/inputUrl.`);
  return url;
}

export function rssItemToSubscription(input: {
  source: SourceConfig;
  provider: string;
  rawRef: string;
  capturedAt: string;
  item: JsonFeedItem;
  index: number;
}): SubscriptionItem | null {
  const title = String(input.item.title ?? "").trim();
  const url = String(input.item.url ?? input.item.link ?? "").trim();
  if (!title || !url) return null;

  const authorName = input.item.author?.name ?? input.item.authors?.[0]?.name ?? input.source.name;
  const publishedAt = input.item.date_published ?? input.item.published ?? input.item.date_modified ?? null;
  const summary = stripHtml(input.item.summary ?? input.item.content_text ?? input.item.content_html ?? "").slice(0, 500);
  const stableId = String(input.item.id ?? url ?? `${title}-${input.index}`);

  return {
    id: `${input.source.id}-${sha1(stableId).slice(0, 12)}`,
    sourceId: input.source.id,
    platform: input.source.platform,
    provider: input.provider,
    authorId: String(input.source.params?.platformId ?? input.source.id),
    authorName,
    title,
    url,
    publishedAt,
    capturedAt: input.capturedAt,
    summary,
    media: [],
    rawRef: input.rawRef,
    dedupeKey: `${input.source.id}:${sha1(url || title)}`
  };
}

export function parseFeedText(text: string): JsonFeedItem[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return jsonFeedItems(JSON.parse(trimmed));
  }
  return xmlFeedItems(trimmed);
}

export async function collectDirectRssSubscription(
  source: SourceConfig,
  limit: number,
  provider = source.platform === "youtube" ? "youtube-native-rss" : "direct-rss"
): Promise<{ items: SubscriptionItem[]; rawRefs: string[]; health: SourceHealth[] }> {
  const capturedAt = nowIso();
  try {
    const feedUrl = resolveDirectFeedUrl(source);
    const text = await fetchText(feedUrl, { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*" });
    const rawRef = await writeRawSnapshot(source.id, { provider, feedUrl, text });
    const items = parseFeedText(text)
      .slice(0, limit)
      .map((item, index) => rssItemToSubscription({ source, provider, rawRef, capturedAt, item, index }))
      .filter((item): item is SubscriptionItem => Boolean(item));

    return {
      items,
      rawRefs: [rawRef],
      health: [{ sourceId: source.id, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider, itemCount: items.length }]
    };
  } catch (error) {
    return {
      items: [],
      rawRefs: [],
      health: [
        {
          sourceId: source.id,
          status: "unavailable",
          checkedAt: capturedAt,
          provider,
          message: error instanceof Error ? error.message : String(error),
          nextAction: "Check the feed URL or disable this source in the source catalog."
        }
      ]
    };
  }
}
