import { collectBilibiliPopular } from "../adapters/hotspots/bilibili.js";
import { collectWeiboHot } from "../adapters/hotspots/weibo.js";
import { appendHotspots, writeHealth } from "../core/storage.js";
import type { CollectionResult, SocialFallbackAdapter, SocialStreamType } from "../types.js";
import { browserSource } from "./config.js";

async function runAdapter(adapter: SocialFallbackAdapter): Promise<CollectionResult> {
  if (adapter === "bilibili-hotspots" || adapter === "weibo-hotspots") {
    const result = adapter === "bilibili-hotspots" ? await collectBilibiliPopular() : await collectWeiboHot();
    return {
      rawRefs: result.rawRef ? [result.rawRef] : [],
      normalizedRefs: [await appendHotspots(result.items), await writeHealth([result.health])],
      health: [result.health],
      hotspotCount: result.items.length
    };
  }
  throw new Error(`Registered fallback adapter is not implemented: ${adapter}`);
}

export async function runSocialFallback(sourceId: string, streamType: SocialStreamType): Promise<CollectionResult> {
  const source = browserSource(sourceId);
  if (!source || !source.enabled) throw new Error(`Unknown or disabled browser source: ${sourceId}`);
  if (!source.streams.includes(streamType)) throw new Error(`Stream ${streamType} is not registered for ${sourceId}`);
  const adapter = source.fallbackByStream?.[streamType];
  if (!adapter) {
    const checkedAt = new Date().toISOString();
    const health = [{
      sourceId,
      status: "unavailable" as const,
      checkedAt,
      provider: "browser-use-fallback",
      message: `No fallback is registered for ${source.platform} ${streamType}.`,
      successWindowHours: 6,
      nextAction: "Restore the browser session or browser extraction selectors."
    }];
    return { rawRefs: [], normalizedRefs: [await writeHealth(health)], health };
  }
  return runAdapter(adapter);
}
