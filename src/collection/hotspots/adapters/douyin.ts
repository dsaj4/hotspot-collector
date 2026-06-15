import type { HotspotItem, SourceHealth } from "../../../types.js";
import { fetchJson } from "../../../core/http.js";
import { nowIso } from "../../../core/time.js";
import { writeRawSnapshot } from "../../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type DouyinResponse = {
  status_code?: number;
  data?: {
    word_list?: Array<{ group_id?: string; sentence_id?: string; word?: string; hot_value?: number | string }>;
  };
};

export async function collectDouyinHot(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "douyin-hot";
  const capturedAt = nowIso();
  try {
    const raw = (await fetchJson("https://aweme.snssdk.com/aweme/v1/hot/search/list/")) as DouyinResponse;
    const rawRef = await writeRawSnapshot(sourceId, raw);
    const rows = raw.data?.word_list ?? [];
    const items = rows
      .map((row, index) => {
        const title = normalizeTitle(row.word);
        if (!title) return null;
        const sentenceId = row.sentence_id ?? row.group_id ?? title;
        return makeHotspotItem({
          sourceId,
          platform: "douyin",
          provider: "platform-direct",
          rank: index + 1,
          title,
          heat: row.hot_value,
          url: `https://www.douyin.com/hot/${encodeURIComponent(sentenceId)}`,
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
