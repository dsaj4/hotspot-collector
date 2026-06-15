import type { HotspotItem, SourceHealth } from "../../../types.js";
import { fetchJson } from "../../../core/http.js";
import { nowIso } from "../../../core/time.js";
import { writeRawSnapshot } from "../../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type BaiduResponse = {
  success?: boolean;
  data?: {
    cards?: Array<{ content?: Array<{ content?: Array<{ index?: number; word?: string; newHotName?: string; url?: string }> }> }>;
  };
};

export async function collectBaiduHot(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "baidu-hot";
  const capturedAt = nowIso();
  try {
    const raw = (await fetchJson("https://top.baidu.com/api/board?platform=wise&tab=realtime")) as BaiduResponse;
    const rawRef = await writeRawSnapshot(sourceId, raw);
    const rows = raw.data?.cards?.[0]?.content?.[0]?.content ?? [];
    const items = rows
      .map((row, index) => {
        const title = normalizeTitle(row.word);
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "baidu",
          provider: "platform-direct",
          rank: row.index ?? index + 1,
          title,
          label: row.newHotName,
          url: `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
          mobileUrl: row.url,
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item));
    return { items, rawRef, health: { sourceId, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider: "platform-direct", itemCount: items.length } };
  } catch (error) {
    return { items: [], rawRef: "", health: { sourceId, status: "error", checkedAt: capturedAt, provider: "platform-direct", message: error instanceof Error ? error.message : String(error) } };
  }
}
