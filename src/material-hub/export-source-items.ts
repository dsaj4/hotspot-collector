import path from "node:path";
import { sha1 } from "../core/hash.js";
import { dateFolder, nowIso } from "../core/time.js";
import type { HotspotItem, SubscriptionItem, VideoTranscriptItem } from "../types.js";
import type { MaterialHubSourceItem, MaterialHubSourceKind } from "./types.js";
import { fileExists, hubDayPath, latestDatedDir, materialHubRoot, normalizeRelPath, readJsonl, writeJson, writeJsonl } from "./utils.js";

export type ExportSourceItemsOptions = {
  day?: string;
  normalizedRoot?: string;
  outputRoot?: string;
};

export type ExportSourceItemsResult = {
  day: string;
  outputRef: string;
  reportRef: string;
  itemCount: number;
  inputRefs: string[];
  acquisition: {
    mode: "normalized-export" | "existing-source-items";
    sourceFiles: Array<{ ref: string; count: number }>;
    exportedAt: string;
  };
};

type NormalizedKind = "subscriptions" | "hotspots" | "video-transcripts";

type NormalizedSpec = {
  fileName: string;
  kind: NormalizedKind;
  sourceKind: MaterialHubSourceKind;
};

const normalizedSpecs: NormalizedSpec[] = [
  { fileName: "subscriptions.jsonl", kind: "subscriptions", sourceKind: "subscription" },
  { fileName: "hotspots.jsonl", kind: "hotspots", sourceKind: "hotspot" },
  { fileName: "video-transcripts.jsonl", kind: "video-transcripts", sourceKind: "subscription" }
];

function normalizedRoot(options: ExportSourceItemsOptions): string {
  return options.normalizedRoot ?? path.join(process.cwd(), "data", "normalized");
}

async function resolveDay(options: ExportSourceItemsOptions): Promise<string> {
  if (options.day) return options.day;
  return (await latestDatedDir(normalizedRoot(options))) ?? dateFolder();
}

function mapSubscription(item: SubscriptionItem, normalizedRef: string): MaterialHubSourceItem {
  return {
    id: `src-sub-${sha1(item.dedupeKey).slice(0, 12)}`,
    sourceKind: "subscription",
    platform: item.platform,
    provider: item.provider,
    title: item.title,
    url: item.url,
    authorId: item.authorId,
    authorName: item.authorName,
    publishedAt: item.publishedAt,
    capturedAt: item.capturedAt,
    summary: item.summary,
    media: item.media,
    rawRef: item.rawRef,
    normalizedRef,
    dedupeKey: item.dedupeKey
  };
}

function mapHotspot(item: HotspotItem, normalizedRef: string): MaterialHubSourceItem {
  return {
    id: `src-hot-${sha1(item.dedupeKey).slice(0, 12)}`,
    sourceKind: "hotspot",
    platform: item.platform,
    provider: item.provider,
    title: item.title,
    url: item.url,
    capturedAt: item.capturedAt,
    summary: [item.category, item.label, item.heat === undefined ? "" : `heat: ${item.heat}`].filter(Boolean).join(" | "),
    rawRef: item.rawRef,
    normalizedRef,
    dedupeKey: item.dedupeKey
  };
}

function mapTranscript(item: VideoTranscriptItem, normalizedRef: string): MaterialHubSourceItem {
  return {
    id: `src-transcript-${sha1(item.dedupeKey).slice(0, 12)}`,
    sourceKind: "subscription",
    platform: item.platform,
    provider: item.provider,
    title: item.title,
    url: item.url,
    capturedAt: item.capturedAt,
    contentText: item.text,
    summary: `Bilibili subtitle transcript (${item.language}).`,
    rawRef: item.rawRef,
    normalizedRef,
    dedupeKey: item.dedupeKey
  };
}

function mapItem(item: SubscriptionItem | HotspotItem | VideoTranscriptItem, spec: NormalizedSpec, normalizedRef: string): MaterialHubSourceItem {
  if (spec.kind === "subscriptions") return mapSubscription(item as SubscriptionItem, normalizedRef);
  if (spec.kind === "hotspots") return mapHotspot(item as HotspotItem, normalizedRef);
  return mapTranscript(item as VideoTranscriptItem, normalizedRef);
}

export async function exportNormalizedSourceItems(options: ExportSourceItemsOptions = {}): Promise<ExportSourceItemsResult> {
  const day = await resolveDay(options);
  const inputDir = path.join(normalizedRoot(options), day);
  const byDedupe = new Map<string, MaterialHubSourceItem>();
  const sourceFiles: Array<{ ref: string; count: number }> = [];
  const inputRefs: string[] = [];

  for (const spec of normalizedSpecs) {
    const abs = path.join(inputDir, spec.fileName);
    if (!(await fileExists(abs))) continue;
    const normalizedRef = path.relative(process.cwd(), abs).replaceAll("\\", "/");
    const rows = await readJsonl<SubscriptionItem | HotspotItem | VideoTranscriptItem>(abs);
    inputRefs.push(normalizedRef);
    sourceFiles.push({ ref: normalizedRef, count: rows.length });
    for (const row of rows) {
      const mapped = mapItem(row, spec, normalizedRef);
      byDedupe.set(mapped.dedupeKey, mapped);
    }
  }

  const outputAbs = options.outputRoot
    ? path.join(options.outputRoot, "00-source-items", day, "source-items.jsonl")
    : hubDayPath("00-source-items", day, "source-items.jsonl");
  if (await fileExists(outputAbs)) {
    const existing = await readJsonl<MaterialHubSourceItem>(outputAbs);
    for (const item of existing) {
      if (!byDedupe.has(item.dedupeKey)) byDedupe.set(item.dedupeKey, item);
    }
  }
  await writeJsonl(outputAbs, [...byDedupe.values()]);
  const outputRef = options.outputRoot ? normalizeRelPath(path.relative(options.outputRoot, outputAbs)) : normalizeRelPath(path.relative(materialHubRoot, outputAbs)).startsWith("..") ? outputAbs.replaceAll("\\", "/") : `material-hub-workspace/${normalizeRelPath(path.relative(materialHubRoot, outputAbs))}`;
  const reportAbs = path.join(options.outputRoot ?? materialHubRoot, "00-source-items", day, "source-export-report.json");
  const report = {
    generatedAt: nowIso(),
    day,
    inputRefs,
    outputRef: options.outputRoot ? path.relative(options.outputRoot, outputAbs).replaceAll("\\", "/") : outputRef,
    itemCount: byDedupe.size,
    acquisition: {
      mode: "normalized-export" as const,
      sourceFiles,
      exportedAt: nowIso()
    }
  };
  const reportRef = options.outputRoot ? await writeJson(reportAbs, report).then(() => normalizeRelPath(path.relative(options.outputRoot!, reportAbs))) : await writeJson(reportAbs, report);

  return {
    day,
    outputRef,
    reportRef,
    itemCount: byDedupe.size,
    inputRefs,
    acquisition: report.acquisition
  };
}
