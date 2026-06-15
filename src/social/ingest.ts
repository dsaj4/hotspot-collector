import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha1 } from "../core/hash.js";
import { appendJsonlUnique, appendSocialItems, writeHealth, writeRawSnapshot } from "../core/storage.js";
import { dateFolder } from "../core/time.js";
import type { BrowserObservation, HotspotItem, SocialItem, SubscriptionItem } from "../types.js";
import { validateBrowserObservation } from "../validators/normalized.js";

function toSocialItem(observation: BrowserObservation, rawRef: string, capturedAt: string, index: number): SocialItem {
  const item = observation.items[index];
  const stable = item.externalId || item.url;
  return {
    id: `${observation.platform}-${sha1(`${observation.sourceId}:${stable}`).slice(0, 16)}`,
    sourceId: observation.sourceId,
    platform: observation.platform,
    provider: "browser-use",
    streamType: observation.streamType,
    title: item.title.trim(),
    url: item.url,
    authorId: item.authorId,
    authorName: item.authorName,
    publishedAt: item.publishedAt ?? null,
    capturedAt,
    body: item.body?.trim() ?? "",
    media: item.media ?? [],
    rank: item.rank,
    heat: item.heat,
    rawRef,
    dedupeKey: `${observation.sourceId}:${observation.streamType}:${sha1(stable)}`
  };
}

function toSubscription(item: SocialItem): SubscriptionItem {
  return {
    id: item.id,
    sourceId: item.sourceId,
    platform: item.platform,
    provider: item.provider,
    authorId: item.authorId ?? item.platform,
    authorName: item.authorName ?? item.platform,
    title: item.title,
    url: item.url,
    publishedAt: item.publishedAt,
    capturedAt: item.capturedAt,
    summary: item.body.slice(0, 500),
    media: item.media,
    rawRef: item.rawRef,
    dedupeKey: item.dedupeKey
  };
}

function toHotspot(item: SocialItem, index: number): HotspotItem {
  return {
    id: item.id,
    sourceId: item.sourceId,
    platform: item.platform,
    provider: item.provider,
    rank: item.rank ?? index + 1,
    title: item.title,
    url: item.url,
    heat: item.heat,
    category: "hotspot",
    capturedAt: item.capturedAt,
    rawRef: item.rawRef,
    dedupeKey: item.dedupeKey
  };
}

export async function ingestBrowserObservation(observation: BrowserObservation): Promise<{
  itemCount: number;
  fallbackRequired: boolean;
  rawRef: string;
  normalizedRefs: string[];
}> {
  const issues = validateBrowserObservation(observation);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));

  const capturedAt = observation.capturedAt ?? new Date().toISOString();
  const rawRef = await writeRawSnapshot(observation.sourceId, { provider: "browser-use", ...observation, capturedAt });
  const items = observation.items.map((_, index) => toSocialItem(observation, rawRef, capturedAt, index));
  const socialRef = await appendSocialItems(items);
  const normalizedRefs = [socialRef];

  if (observation.streamType === "hotspot") {
    normalizedRefs.push(await appendJsonlUnique(path.join("data", "normalized", dateFolder(), "hotspots.jsonl"), items.map(toHotspot)));
  } else {
    normalizedRefs.push(await appendJsonlUnique(path.join("data", "normalized", dateFolder(), "subscriptions.jsonl"), items.map(toSubscription)));
  }

  const fallbackRequired = observation.status === "error" || observation.status === "unavailable";
  normalizedRefs.push(await writeHealth([{
    sourceId: observation.sourceId,
    status: observation.status,
    checkedAt: capturedAt,
    provider: "browser-use",
    itemCount: items.length,
    message: observation.message,
    successWindowHours: 6,
    nextAction: fallbackRequired ? "Run the registered social:fallback route, then restore the browser session or selectors." : undefined
  }]));

  return { itemCount: items.length, fallbackRequired, rawRef, normalizedRefs };
}

export async function ingestBrowserObservationFile(filePath: string): Promise<Awaited<ReturnType<typeof ingestBrowserObservation>>> {
  return ingestBrowserObservation(JSON.parse(await readFile(filePath, "utf8")) as BrowserObservation);
}
