import { fetchText } from "../../core/http.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { nowIso } from "../../core/time.js";
import { buildRsshubUrl } from "../../sources/rsshub.js";
import type { SourceConfig, SourceHealth, SubscriptionItem } from "../../types.js";
import { parseFeedText, rssItemToSubscription } from "./rss.js";

export async function collectRsshubSubscription(
  source: SourceConfig,
  baseUrl: string,
  limit: number
): Promise<{ items: SubscriptionItem[]; rawRefs: string[]; health: SourceHealth[] }> {
  const capturedAt = nowIso();
  const provider = "rsshub";

  try {
    const feedUrl = buildRsshubUrl(source, baseUrl);
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
          nextAction: "Set RSSHUB_BASE_URL to a reachable RSSHub instance or disable this rsshub source."
        }
      ]
    };
  }
}
