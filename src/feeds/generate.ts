import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HotspotItem, SubscriptionItem } from "../types.js";
import { generateJsonFeed, generateRss, hotspotFeedItem, subscriptionFeedItem, type FeedItem } from "./format.js";

export type FeedKind = "subscriptions" | "hotspots";

type FeedOutput = {
  kind: FeedKind;
  itemCount: number;
  rssRef: string;
  jsonRef: string;
};

const rootDir = process.cwd();

async function latestNormalizedFile(kind: FeedKind): Promise<string | null> {
  const dir = path.join(rootDir, "data", "normalized");
  let dates: string[] = [];
  try {
    dates = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  } catch {
    return null;
  }

  const fileName = kind === "subscriptions" ? "subscriptions.jsonl" : "hotspots.jsonl";
  for (const date of dates) {
    const file = path.join(dir, date, fileName);
    try {
      await readFile(file, "utf8");
      return file;
    } catch {
      // Try the next date folder.
    }
  }
  return null;
}

async function readJsonl<T>(filePath: string | null): Promise<T[]> {
  if (!filePath) return [];
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

async function writeFeedFiles(kind: FeedKind, items: FeedItem[]): Promise<FeedOutput> {
  const relDir = path.join("reports", "feeds");
  const absDir = path.join(rootDir, relDir);
  await mkdir(absDir, { recursive: true });

  const title = kind === "subscriptions" ? "Hotspot Collector Subscriptions" : "Hotspot Collector Hotspots";
  const description =
    kind === "subscriptions" ? "Normalized subscription feed generated from local JSONL." : "Normalized hotspot feed generated from local JSONL.";
  const link = "http://localhost/hotspot-collector";
  const rssRef = path.join(relDir, `${kind}.rss`).replaceAll("\\", "/");
  const jsonRef = path.join(relDir, `${kind}.json`).replaceAll("\\", "/");

  await writeFile(path.join(rootDir, rssRef), generateRss(items, { title, description, link }), "utf8");
  await writeFile(path.join(rootDir, jsonRef), generateJsonFeed(items, { title, description, link }), "utf8");
  return { kind, itemCount: items.length, rssRef, jsonRef };
}

export async function generateFeed(kind: FeedKind): Promise<FeedOutput> {
  if (kind === "subscriptions") {
    const items = (await readJsonl<SubscriptionItem>(await latestNormalizedFile(kind))).map(subscriptionFeedItem);
    return writeFeedFiles(kind, items);
  }
  const items = (await readJsonl<HotspotItem>(await latestNormalizedFile(kind))).map(hotspotFeedItem);
  return writeFeedFiles(kind, items);
}

export async function generateFeeds(kind?: FeedKind): Promise<{ generatedAt: string; outputs: FeedOutput[] }> {
  const kinds: FeedKind[] = kind ? [kind] : ["subscriptions", "hotspots"];
  const outputs = [];
  for (const current of kinds) outputs.push(await generateFeed(current));
  return { generatedAt: new Date().toISOString(), outputs };
}

export function isFeedKind(value: string | undefined): value is FeedKind {
  return value === "subscriptions" || value === "hotspots";
}
