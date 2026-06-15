import type { HotspotItem, SourceHealth } from "../../types.js";
import { nowIso } from "../../core/time.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

function decodeXml(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export async function collectGoogleNewsAi(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "google-news-ai";
  const capturedAt = nowIso();
  try {
    const url = "https://news.google.com/rss/search?q=AI%20OR%20artificial%20intelligence%20when:1d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans";
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/rss+xml,text/xml" } });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const xml = await response.text();
    const rawRef = await writeRawSnapshot(sourceId, { provider: "rss-public", xml });
    const matches = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)];
    const items = matches
      .map((match, index) => {
        const title = normalizeTitle(decodeXml(match[1]).replace(/\s+-\s+[^-]+$/, ""));
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "google-news",
          provider: "rss-public",
          rank: index + 1,
          title,
          url: decodeXml(match[2]),
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item))
      .slice(0, 30);
    return { items, rawRef, health: { sourceId, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider: "rss-public", itemCount: items.length } };
  } catch (error) {
    return { items: [], rawRef: "", health: { sourceId, status: "error", checkedAt: capturedAt, provider: "rss-public", message: error instanceof Error ? error.message : String(error) } };
  }
}
