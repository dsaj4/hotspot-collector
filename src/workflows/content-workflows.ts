import path from "node:path";
import { readFile } from "node:fs/promises";
import { visionLibRoot } from "../config.js";
import type { MaterialHubSourceItem, MaterialHubSourceKind, ProcessingTemplate } from "../material-hub/types.js";
import { aggregateMaterialCards } from "../material-hub/aggregate.js";
import { digestSources } from "../material-hub/digest.js";
import { exportNormalizedSourceItems } from "../material-hub/export-source-items.js";
import { intakeTemporaryLink } from "../material-hub/link-intake.js";
import { hubDayPath, writeJsonl } from "../material-hub/utils.js";
import { intakeBilibiliVideo } from "../video-intake/bilibili.js";

export type WorkflowStage = "collect" | "digest" | "material";

function absoluteVisionRef(ref: string): string {
  return path.isAbsolute(ref) ? ref : path.join(visionLibRoot, ref);
}

async function collectKind(kind: Exclude<MaterialHubSourceKind, "temporary-link" | "ima">): Promise<unknown> {
  if (kind === "hotspot") {
    const { collectHotspots } = await import("../collectors/hotspots.js");
    return collectHotspots();
  }
  const { collectSubscriptions } = await import("../collectors/subscriptions.js");
  return collectSubscriptions();
}

export async function runCollectionContentWorkflow(options: {
  kind: "hotspot" | "subscription";
  stage: WorkflowStage;
  day?: string;
  limit?: number;
  template?: ProcessingTemplate;
  mode?: "deepseek" | "local-rule";
}): Promise<Record<string, unknown>> {
  const collection = options.stage === "digest" ? undefined : await collectKind(options.kind);
  if (options.stage === "collect") return { stage: "collect", kind: options.kind, collection };

  const sourceExport = await exportNormalizedSourceItems({ day: options.day });
  const digest = await digestSources({
    day: sourceExport.day,
    limit: options.limit,
    sourceKind: options.kind,
    outputLabel: options.kind,
    mode: options.mode
  });
  if (options.stage === "digest") return { stage: "digest", kind: options.kind, sourceExport, digest };

  const aggregate = await aggregateMaterialCards({
    day: sourceExport.day,
    limit: options.limit,
    digestPath: absoluteVisionRef(digest.digestRef),
    template: options.template,
    mode: options.mode
  });
  return { stage: "material", kind: options.kind, collection, sourceExport, digest, aggregate };
}

async function isolatedSourceSet(day: string, label: string, items: MaterialHubSourceItem[]): Promise<string> {
  const ref = await writeJsonl(hubDayPath("02-processing-jobs", day, `source-set-${label}.jsonl`), items);
  return absoluteVisionRef(ref);
}

export async function createMaterialFromLink(options: {
  url: string;
  title?: string;
  limit?: number;
  template?: ProcessingTemplate;
  mode?: "deepseek" | "local-rule";
  contentFile?: string;
}): Promise<Record<string, unknown>> {
  const isBilibili = /(?:bilibili\.com\/video\/|b23\.tv\/)/i.test(options.url);
  let day: string;
  let sourceItem: MaterialHubSourceItem;
  let acquisition: unknown;
  if (isBilibili) {
    const result = await intakeBilibiliVideo({ url: options.url, title: options.title, publishToMaterialHub: true });
    if (!result.sourceItem) return { stage: "acquisition", platform: "bilibili", result };
    day = result.day;
    sourceItem = result.sourceItem;
    acquisition = result;
  } else {
    const contentText = options.contentFile ? await readFile(path.resolve(options.contentFile), "utf8") : undefined;
    const result = await intakeTemporaryLink(options.url, { title: options.title, contentText });
    day = result.item.capturedAt.slice(0, 10);
    sourceItem = result.item;
    acquisition = result;
  }

  const label = sourceItem.id.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const sourceItemsPath = await isolatedSourceSet(day, label, [sourceItem]);
  const digest = await digestSources({ day, limit: options.limit ?? 1, sourceItemsPath, outputLabel: label, mode: options.mode });
  const aggregate = await aggregateMaterialCards({
    day,
    limit: options.limit ?? 1,
    digestPath: absoluteVisionRef(digest.digestRef),
    template: options.template,
    mode: options.mode
  });
  return { stage: "material", acquisition, digest, aggregate };
}
