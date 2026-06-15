import type { HotspotItem, SourceHealth } from "../../../types.js";
import { fetchJson } from "../../../core/http.js";
import { nowIso } from "../../../core/time.js";
import { writeRawSnapshot } from "../../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

type BilibiliRankingResponse = {
  code?: number;
  message?: string;
  data?: {
    realtime?: Array<{ bvid?: string; title?: string; desc?: string; pic?: string; stat?: { view?: number }; short_link_v2?: string }>;
    list?: Array<{ bvid?: string; title?: string; desc?: string; pic?: string; stat?: { view?: number }; short_link_v2?: string }>;
  };
};

type NewsNowResponse = {
  status?: string;
  items?: Array<{ title?: string; url?: string; mobileUrl?: string; hot?: number | string; extra?: { info?: string } }>;
};

export async function collectBilibiliPopular(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "bilibili-popular";
  const capturedAt = nowIso();
  try {
    const raw = (await fetchJson("https://api.bilibili.com/x/web-interface/ranking/v2", {
      Referer: "https://www.bilibili.com/ranking/all"
    })) as BilibiliRankingResponse;
    const rawRef = await writeRawSnapshot(sourceId, raw);
    const rows = raw.data?.realtime ?? raw.data?.list ?? [];
    if (!rows.length) {
      throw new Error(`Bilibili direct returned no ranking rows${raw.code ? ` (code ${raw.code}: ${raw.message ?? ""})` : ""}.`);
    }
    const items = rows
      .map((row, index) => {
        const title = normalizeTitle(row.title);
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "bilibili",
          provider: "platform-direct",
          rank: index + 1,
          title,
          heat: row.stat?.view,
          url: row.short_link_v2 || `https://www.bilibili.com/video/${row.bvid ?? ""}`,
          mobileUrl: `https://m.bilibili.com/video/${row.bvid ?? ""}`,
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item));
    return { items, rawRef, health: { sourceId, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider: "platform-direct", itemCount: items.length } };
  } catch (directError) {
    try {
      const provider = "newsnow";
      const raw = (await fetchJson("https://newsnow.busiyi.world/api/s?id=bilibili&latest")) as NewsNowResponse;
      const rawRef = await writeRawSnapshot(sourceId, { provider, directError: directError instanceof Error ? directError.message : String(directError), ...raw });
      const rows = raw.items ?? [];
      const items = rows
        .map((row, index) => {
          const title = normalizeTitle(row.title);
          if (!title) return null;
          return makeHotspotItem({
            sourceId,
            platform: "bilibili",
            provider,
            rank: index + 1,
            title,
            heat: row.hot ?? row.extra?.info,
            url: row.url || "",
            mobileUrl: row.mobileUrl,
            capturedAt,
            rawRef
          });
        })
        .filter((item): item is HotspotItem => Boolean(item));
      return {
        items,
        rawRef,
        health: {
          sourceId,
          status: raw.status === "cache" ? "cache" : items.length ? "ok" : "empty",
          checkedAt: capturedAt,
          provider,
          itemCount: items.length,
          message: `Direct fallback used: ${directError instanceof Error ? directError.message : String(directError)}`
        }
      };
    } catch (fallbackError) {
      return {
        items: [],
        rawRef: "",
        health: {
          sourceId,
          status: "error",
          checkedAt: capturedAt,
          provider: "platform-direct",
          message: `Direct failed: ${directError instanceof Error ? directError.message : String(directError)}; fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        }
      };
    }
  }
}
