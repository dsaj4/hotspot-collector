import type { HotspotItem, SourceHealth } from "../../types.js";
import { fetchJson } from "../../core/http.js";
import { nowIso } from "../../core/time.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type HnResponse = {
  hits?: Array<{ objectID?: string; title?: string; url?: string; points?: number }>;
};

export async function collectHackerNewsFrontPage(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "hacker-news-frontpage";
  const capturedAt = nowIso();
  try {
    const raw = (await fetchJson("https://hn.algolia.com/api/v1/search?tags=front_page")) as HnResponse;
    const rawRef = await writeRawSnapshot(sourceId, raw);
    const items = (raw.hits ?? [])
      .map((row, index) => {
        const title = normalizeTitle(row.title);
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "hacker-news",
          provider: "algolia-public",
          rank: index + 1,
          title,
          heat: row.points,
          url: row.url || `https://news.ycombinator.com/item?id=${row.objectID ?? ""}`,
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item));
    return { items, rawRef, health: { sourceId, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider: "algolia-public", itemCount: items.length } };
  } catch (error) {
    return { items: [], rawRef: "", health: { sourceId, status: "error", checkedAt: capturedAt, provider: "algolia-public", message: error instanceof Error ? error.message : String(error) } };
  }
}
