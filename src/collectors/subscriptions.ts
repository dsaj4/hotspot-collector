import path from "node:path";
import {
  bilibiliCookie,
  bilibiliFollowingLimit,
  bilibiliUid,
  genericRssLimit,
  rsshubBaseUrl,
  wechatRssBaseUrl,
  wechatRssFeeds,
  wechatRssLimit
} from "../config.js";
import { appendJsonl, appendSubscriptions, writeHealth } from "../core/storage.js";
import { dateFolder } from "../core/time.js";
import { collectBilibiliFollowings, collectBilibiliSubscriptions } from "../adapters/subscriptions/bilibili.js";
import { collectDirectRssSubscription } from "../adapters/subscriptions/rss.js";
import { collectRsshubSubscription } from "../adapters/subscriptions/rsshub.js";
import { collectWechatRssSubscriptions } from "../adapters/subscriptions/wechat-rss.js";
import { loadSourceCatalog } from "../sources/catalog.js";
import type { CollectionResult, SourceConfig, SubscriptionItem } from "../types.js";

function uniqueByDedupeKey(items: SubscriptionItem[]): SubscriptionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.dedupeKey)) return false;
    seen.add(item.dedupeKey);
    return true;
  });
}

function additionalSubscriptionSources(): SourceConfig[] {
  const builtInSourceIds = new Set(["bilibili-user-dynamic", "bilibili-user-video", "wechat-rss"]);
  return loadSourceCatalog().filter(
    (source) =>
      source.kind === "subscription" &&
      source.enabled &&
      !builtInSourceIds.has(source.id) &&
      (source.fetchMode === "direct-rss" || source.fetchMode === "rsshub")
  );
}

async function collectAdditionalSubscriptions(): Promise<{
  items: SubscriptionItem[];
  rawRefs: string[];
  health: CollectionResult["health"];
}> {
  const results = await Promise.all(
    additionalSubscriptionSources().map((source) =>
      source.fetchMode === "rsshub"
        ? collectRsshubSubscription(source, rsshubBaseUrl, genericRssLimit)
        : collectDirectRssSubscription(source, genericRssLimit)
    )
  );
  return {
    items: results.flatMap((result) => result.items),
    rawRefs: results.flatMap((result) => result.rawRefs),
    health: results.flatMap((result) => result.health)
  };
}

export async function collectSubscriptions(): Promise<CollectionResult> {
  const wechat = await collectWechatRssSubscriptions(wechatRssBaseUrl, wechatRssFeeds, wechatRssLimit);
  const additional = await collectAdditionalSubscriptions();
  const items = uniqueByDedupeKey([...wechat.items, ...additional.items]);
  const normalizedRef = await appendSubscriptions(items);
  const health = [...wechat.health, ...additional.health];
  const healthRef = await writeHealth(health, [
    ...wechatRssFeeds.map((feed) => `wechat-rss-${feed}`),
    ...additional.health.map((item) => item.sourceId)
  ]);

  return {
    rawRefs: [...wechat.rawRefs, ...additional.rawRefs],
    normalizedRefs: [normalizedRef, healthRef],
    health,
    subscriptionCount: items.length
  };
}

export async function discoverBilibiliFollowings(): Promise<CollectionResult & { followingCount: number }> {
  const result = await collectBilibiliFollowings(bilibiliUid, bilibiliCookie, bilibiliFollowingLimit);
  const normalizedRef = await appendJsonl(path.join("data", "normalized", dateFolder(), "bilibili-followings.jsonl"), result.users);
  const healthRef = await writeHealth(result.health, ["bilibili-followings"]);
  return {
    rawRefs: result.rawRefs,
    normalizedRefs: [normalizedRef, healthRef],
    health: result.health,
    followingCount: result.users.length
  };
}

export async function collectWechatSubscriptions(): Promise<CollectionResult> {
  const result = await collectWechatRssSubscriptions(wechatRssBaseUrl, wechatRssFeeds, wechatRssLimit);
  const normalizedRef = await appendSubscriptions(uniqueByDedupeKey(result.items));
  const healthRef = await writeHealth(result.health, wechatRssFeeds.map((feed) => `wechat-rss-${feed}`));
  return {
    rawRefs: result.rawRefs,
    normalizedRefs: [normalizedRef, healthRef],
    health: result.health,
    subscriptionCount: result.items.length
  };
}

export async function collectFollowingSubscriptions(): Promise<CollectionResult & { followingCount: number }> {
  const followings = await collectBilibiliFollowings(bilibiliUid, bilibiliCookie, bilibiliFollowingLimit);
  const results = [];
  for (const user of followings.users) {
    results.push(
      await collectBilibiliSubscriptions(user.uid, {
        cookie: bilibiliCookie,
        dynamicSourceId: `bilibili-following-dynamic-${user.uid}`,
        videoSourceId: `bilibili-following-video-${user.uid}`
      })
    );
  }
  const items = uniqueByDedupeKey(results.flatMap((result) => [...result.dynamicItems, ...result.videoItems]));
  const normalizedRef = await appendSubscriptions(items);
  const health = [...followings.health, ...results.flatMap((result) => result.health)];
  const healthRef = await writeHealth(health, [
    "bilibili-followings",
    ...followings.users.flatMap((user) => [`bilibili-following-dynamic-${user.uid}`, `bilibili-following-video-${user.uid}`])
  ]);
  return {
    rawRefs: [...followings.rawRefs, ...results.flatMap((result) => result.rawRefs)],
    normalizedRefs: [normalizedRef, healthRef],
    health,
    subscriptionCount: items.length,
    followingCount: followings.users.length
  };
}
