import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { collectBilibiliSubtitle, extractBilibiliVideoId, type BilibiliSubtitleCandidate, type YtdlpRunner } from "../adapters/subscriptions/bilibili-subtitles.js";
import { appendVideoTranscripts, writeHealth } from "../core/storage.js";
import type { CollectionResult, HotspotItem, SubscriptionItem, VideoTranscriptItem } from "../types.js";

type CollectOptions = {
  runner?: YtdlpRunner;
  limit?: number;
};

async function latestNormalizedFile(fileName: string): Promise<string | null> {
  const dir = path.join(process.cwd(), "data", "normalized");
  let dates: string[] = [];
  try {
    dates = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  } catch {
    return null;
  }

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

function candidateFromItem(item: SubscriptionItem | HotspotItem): BilibiliSubtitleCandidate | null {
  if (item.platform !== "bilibili") return null;
  if (!extractBilibiliVideoId(item.url)) return null;
  return { sourceItemId: item.id, title: item.title, url: item.url };
}

export async function findLatestBilibiliSubtitleCandidates(): Promise<BilibiliSubtitleCandidate[]> {
  const subscriptions = await readJsonl<SubscriptionItem>(await latestNormalizedFile("subscriptions.jsonl"));
  const hotspots = await readJsonl<HotspotItem>(await latestNormalizedFile("hotspots.jsonl"));
  const seen = new Set<string>();
  const candidates: BilibiliSubtitleCandidate[] = [];

  for (const item of [...subscriptions, ...hotspots]) {
    const candidate = candidateFromItem(item);
    if (!candidate) continue;
    const videoId = extractBilibiliVideoId(candidate.url);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    candidates.push(candidate);
  }

  return candidates;
}

export async function collectBilibiliSubtitlesFromLatest(options: CollectOptions = {}): Promise<CollectionResult> {
  const candidates = await findLatestBilibiliSubtitleCandidates();
  const limit = options.limit ?? 20;
  const items: VideoTranscriptItem[] = [];
  const rawRefs: string[] = [];
  const health: CollectionResult["health"] = [];

  for (const candidate of candidates.slice(0, limit)) {
    const result = await collectBilibiliSubtitle(candidate, options.runner);
    if (result.item) items.push(result.item);
    if (result.rawRef) rawRefs.push(result.rawRef);
    health.push(result.health);
  }

  const normalizedRef = await appendVideoTranscripts(items);
  const healthRef = await writeHealth(health);
  return {
    rawRefs,
    normalizedRefs: [normalizedRef, healthRef],
    health,
    transcriptCount: items.length,
    aiTranscriptCount: items.filter((item) => item.transcriptKind === "ai-subtitle").length
  };
}
