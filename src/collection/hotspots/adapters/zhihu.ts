import type { HotspotItem, SourceHealth } from "../../../types.js";
import { fetchJson } from "../../../core/http.js";
import { nowIso } from "../../../core/time.js";
import { writeRawSnapshot } from "../../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type ZhihuResponse = {
  data?: Array<{ id?: string; card_id?: string; detail_text?: string; target?: { title?: string }; children?: Array<{ thumbnail?: string }> }>;
};

export async function collectZhihuHot(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "zhihu-hot";
  const capturedAt = nowIso();
  try {
    const raw = (await fetchJson("https://api.zhihu.com/topstory/hot-list")) as ZhihuResponse;
    const rawRef = await writeRawSnapshot(sourceId, raw);
    const rows = raw.data ?? [];
    const items = rows
      .map((row, index) => {
        const title = normalizeTitle(row.target?.title);
        if (!title) return null;
        const questionId = row.card_id?.replace("Q_", "") ?? row.id ?? "";
        return makeHotspotItem({
          sourceId,
          platform: "zhihu",
          provider: "platform-direct",
          rank: index + 1,
          title,
          heat: row.detail_text,
          url: `https://www.zhihu.com/question/${questionId}`,
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
