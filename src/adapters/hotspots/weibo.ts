import type { HotspotItem, SourceHealth } from "../../types.js";
import { fetchJson } from "../../core/http.js";
import { nowIso } from "../../core/time.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type NewsNowResponse = {
  status?: string;
  id?: string;
  items?: Array<{ id?: string; title?: string; url?: string; mobileUrl?: string; extra?: { info?: string }; hot?: number | string }>;
};

export async function collectWeiboHot(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "weibo-hot";
  const capturedAt = nowIso();
  const provider = "newsnow";
  try {
    const raw = (await fetchJson("https://newsnow.busiyi.world/api/s?id=weibo&latest")) as NewsNowResponse;
    const rawRef = await writeRawSnapshot(sourceId, { provider, ...raw });
    const rows = raw.items ?? [];
    const items = rows
      .map((row, index) => {
        const title = normalizeTitle(row.title);
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "weibo",
          provider,
          rank: index + 1,
          title,
          heat: row.hot ?? row.extra?.info,
          url: row.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
          mobileUrl: row.mobileUrl,
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item));
    return { items, rawRef, health: { sourceId, status: raw.status === "cache" ? "cache" : items.length ? "ok" : "empty", checkedAt: capturedAt, provider, itemCount: items.length } };
  } catch (error) {
    return { items: [], rawRef: "", health: { sourceId, status: "error", checkedAt: capturedAt, provider, message: error instanceof Error ? error.message : String(error) } };
  }
}
