import { appendHotspots, writeHealth } from "../../core/storage.js";
import { collectBaiduHot } from "./adapters/baidu.js";
import { collectDouyinHot } from "./adapters/douyin.js";
import { collectGithubTrending } from "./adapters/github.js";
import { collectGoogleNewsAi } from "./adapters/google-news.js";
import { collectHackerNewsFrontPage } from "./adapters/hacker-news.js";
import { collectZhihuHot } from "./adapters/zhihu.js";
import type { CollectionResult, HotspotItem } from "../../types.js";

function uniqueByDedupeKey(items: HotspotItem[]): HotspotItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.dedupeKey)) return false;
    seen.add(item.dedupeKey);
    return true;
  });
}

export async function collectHotspots(): Promise<CollectionResult> {
  const results = await Promise.all([
    collectZhihuHot(),
    collectDouyinHot(),
    collectBaiduHot(),
    collectGithubTrending(),
    collectHackerNewsFrontPage(),
    collectGoogleNewsAi()
  ]);

  const items = uniqueByDedupeKey(results.flatMap((result) => result.items));
  const normalizedRef = await appendHotspots(items);
  const health = results.map((result) => result.health);
  const healthRef = await writeHealth(health, [
    "zhihu-hot",
    "douyin-hot",
    "baidu-hot",
    "github-trending",
    "hacker-news-frontpage",
    "google-news-ai"
  ]);

  return {
    rawRefs: results.map((result) => result.rawRef).filter(Boolean),
    normalizedRefs: [normalizedRef, healthRef],
    health,
    hotspotCount: items.length
  };
}
