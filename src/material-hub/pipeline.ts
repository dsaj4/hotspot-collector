import type { CollectionResult } from "../types.js";
import type { ExportSourceItemsResult } from "./export-source-items.js";
import { exportNormalizedSourceItems } from "./export-source-items.js";
import type { ProcessMaterialsResult } from "./processing.js";
import { processMaterialRecords } from "./processing.js";
import { dateFolder } from "../core/time.js";
import type { MaterialHubSourceItem } from "./types.js";
import { hubDayPath, latestDatedDir, materialHubRoot, readJsonl } from "./utils.js";
import path from "node:path";

export type MaterialPipelineCollectMode = "skip" | "hotspots" | "subscriptions" | "all";

export type RunMaterialPipelineOptions = {
  collect?: MaterialPipelineCollectMode;
  day?: string;
  limit?: number;
  subtitleLimit?: number;
};

export type RunMaterialPipelineResult = {
  generatedAt: string;
  collectMode: MaterialPipelineCollectMode;
  collection: {
    subscriptions?: CollectionResult;
    hotspots?: CollectionResult;
    bilibiliSubtitles?: CollectionResult;
  };
  sourceExport: ExportSourceItemsResult;
  processing: ProcessMaterialsResult;
};

async function runCollection(mode: MaterialPipelineCollectMode, subtitleLimit?: number): Promise<RunMaterialPipelineResult["collection"]> {
  if (mode === "skip") return {};
  if (mode === "hotspots") {
    const { collectHotspots } = await import("../collectors/hotspots.js");
    return { hotspots: await collectHotspots() };
  }
  if (mode === "subscriptions") {
    const { collectSubscriptions } = await import("../collectors/subscriptions.js");
    return { subscriptions: await collectSubscriptions() };
  }

  const { collectSubscriptions } = await import("../collectors/subscriptions.js");
  const { collectHotspots } = await import("../collectors/hotspots.js");
  const { collectBilibiliSubtitlesFromLatest } = await import("../collectors/bilibili-subtitles.js");
  const subscriptions = await collectSubscriptions();
  const hotspots = await collectHotspots();
  const bilibiliSubtitles = await collectBilibiliSubtitlesFromLatest({ limit: subtitleLimit });
  return { subscriptions, hotspots, bilibiliSubtitles };
}

async function existingSourceItemsSummary(day?: string): Promise<ExportSourceItemsResult> {
  const resolvedDay = day ?? (await latestDatedDir(path.join(materialHubRoot, "00-source-items"))) ?? dateFolder();
  const abs = hubDayPath("00-source-items", resolvedDay, "source-items.jsonl");
  const items = await readJsonl<MaterialHubSourceItem>(abs);
  const outputRef = `material-hub-workspace/00-source-items/${resolvedDay}/source-items.jsonl`;
  return {
    day: resolvedDay,
    outputRef,
    reportRef: outputRef,
    itemCount: items.length,
    inputRefs: [outputRef],
    acquisition: {
      mode: "existing-source-items",
      sourceFiles: [{ ref: outputRef, count: items.length }],
      exportedAt: new Date().toISOString()
    }
  };
}

export async function runMaterialPipeline(options: RunMaterialPipelineOptions = {}): Promise<RunMaterialPipelineResult> {
  const collectMode = options.collect ?? "skip";
  const collection = await runCollection(collectMode, options.subtitleLimit);
  const sourceExport = collectMode === "skip" ? await existingSourceItemsSummary(options.day) : await exportNormalizedSourceItems({ day: options.day });
  const processing = await processMaterialRecords({ day: sourceExport.day, limit: options.limit });
  return {
    generatedAt: new Date().toISOString(),
    collectMode,
    collection,
    sourceExport,
    processing
  };
}
