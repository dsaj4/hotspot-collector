import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HotspotItem, SocialItem, SourceHealth, SubscriptionItem } from "../types.js";
import { dateFolder, safeTimestamp } from "./time.js";
import { sourceSafeName } from "./hash.js";
import { artifactPath } from "./paths.js";

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeRawSnapshot(sourceId: string, payload: unknown): Promise<string> {
  const rel = path.join("data", "raw", dateFolder(), `${sourceSafeName(sourceId)}-${safeTimestamp()}.json`);
  const abs = artifactPath(rel);
  await ensureDir(path.dirname(abs));
  await writeFile(abs, JSON.stringify(payload, null, 2), "utf8");
  return rel.replaceAll("\\", "/");
}

export async function appendJsonl<T>(relPath: string, items: T[]): Promise<string> {
  const abs = artifactPath(relPath);
  await ensureDir(path.dirname(abs));
  if (!items.length) {
    await writeFile(abs, "", { encoding: "utf8", flag: "a" });
    return relPath.replaceAll("\\", "/");
  }
  const body = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
  await writeFile(abs, body, { encoding: "utf8", flag: "a" });
  return relPath.replaceAll("\\", "/");
}

export async function appendJsonlUnique<T extends { dedupeKey: string }>(relPath: string, items: T[]): Promise<string> {
  const abs = artifactPath(relPath);
  const existing = new Set<string>();
  try {
    const text = await readFile(abs, "utf8");
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      const item = JSON.parse(line) as { dedupeKey?: string };
      if (item.dedupeKey) existing.add(item.dedupeKey);
    }
  } catch {
    // The first write creates the file.
  }
  return appendJsonl(relPath, items.filter((item) => !existing.has(item.dedupeKey)));
}

export async function appendSubscriptions(items: SubscriptionItem[]): Promise<string> {
  return appendJsonl(path.join("data", "normalized", dateFolder(), "subscriptions.jsonl"), items);
}

export async function appendHotspots(items: HotspotItem[]): Promise<string> {
  return appendJsonl(path.join("data", "normalized", dateFolder(), "hotspots.jsonl"), items);
}

export async function appendSocialItems(items: SocialItem[]): Promise<string> {
  return appendJsonlUnique(path.join("data", "normalized", dateFolder(), "social-items.jsonl"), items);
}

export async function writeHealth(health: SourceHealth[], pruneSourceIds: string[] = []): Promise<string> {
  const rel = path.join("data", "health", "source-health.json");
  const abs = artifactPath(rel);
  await ensureDir(path.dirname(abs));

  let previous: SourceHealth[] = [];
  try {
    previous = JSON.parse(await readFile(abs, "utf8")) as SourceHealth[];
  } catch {
    previous = [];
  }

  const bySource = new Map<string, SourceHealth>();
  for (const item of previous) bySource.set(item.sourceId, item);
  for (const sourceId of pruneSourceIds) bySource.delete(sourceId);
  for (const item of health) {
    const previousItem = bySource.get(item.sourceId);
    const successful = item.status === "ok" || item.status === "empty" || item.status === "cache";
    const lastSuccessAt = successful ? item.checkedAt : item.lastSuccessAt ?? previousItem?.lastSuccessAt;
    const lastErrorAt = item.status === "error" || item.status === "unavailable" ? item.checkedAt : item.lastErrorAt ?? previousItem?.lastErrorAt;
    const successWindowHours = item.successWindowHours ?? previousItem?.successWindowHours;
    const meetsSuccessSla = successWindowHours && lastSuccessAt
      ? Date.parse(item.checkedAt) - Date.parse(lastSuccessAt) <= successWindowHours * 3_600_000
      : item.meetsSuccessSla;
    bySource.set(item.sourceId, { ...item, lastSuccessAt, lastErrorAt, successWindowHours, meetsSuccessSla });
  }

  await writeFile(abs, JSON.stringify([...bySource.values()], null, 2), "utf8");
  return rel.replaceAll("\\", "/");
}

export async function writeReportPlaceholder(): Promise<string> {
  const rel = path.join("reports", "daily", `${dateFolder()}.json`);
  const abs = artifactPath(rel);
  await ensureDir(path.dirname(abs));
  await writeFile(
    abs,
    JSON.stringify(
      {
        status: "not implemented",
        generatedAt: new Date().toISOString(),
        message: "Daily report analysis is intentionally reserved for a later phase."
      },
      null,
      2
    ),
    "utf8"
  );
  return rel.replaceAll("\\", "/");
}
