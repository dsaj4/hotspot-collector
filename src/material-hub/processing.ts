import path from "node:path";
import { sha1 } from "../core/hash.js";
import { dateFolder, nowIso } from "../core/time.js";
import type { MaterialType, MaterialHubSourceItem, MaterialRecord } from "./types.js";
import { assignNarrativeLines, tagsForNarrative } from "./narrative.js";
import { fileExists, hubDayPath, latestDatedDir, materialHubRoot, readJsonl, timestampedFile, writeJson, writeText } from "./utils.js";

export type ProcessMaterialsOptions = {
  day?: string;
  limit?: number;
  type?: MaterialType;
  sourceItemsPath?: string;
};

export type ProcessMaterialsResult = {
  day: string;
  processedCount: number;
  materialRefs: string[];
  markdownRefs: string[];
  jobRef: string;
  generatedAt: string;
  samples: Array<{ id: string; title: string; materialType: MaterialType; markdownRef: string }>;
};

async function resolveDay(options: ProcessMaterialsOptions): Promise<string> {
  if (options.day) return options.day;
  return (await latestDatedDir(path.join(materialHubRoot, "00-source-items"))) ?? dateFolder();
}

async function readSourceItems(options: ProcessMaterialsOptions): Promise<{ day: string; items: MaterialHubSourceItem[]; inputRef: string }> {
  const day = await resolveDay(options);
  const abs = options.sourceItemsPath ?? hubDayPath("00-source-items", day, "source-items.jsonl");
  if (!(await fileExists(abs))) {
    throw new Error(`No material hub source items found: ${abs}`);
  }
  return { day, items: await readJsonl<MaterialHubSourceItem>(abs), inputRef: abs };
}

export function classifySourceItem(item: MaterialHubSourceItem): MaterialType {
  const text = `${item.title} ${item.summary ?? ""} ${item.url}`.toLowerCase();
  if (item.platform === "local" || item.url.startsWith("file:") || item.url.includes("vision-lib")) return "project_doc";
  if (item.sourceKind === "hotspot") return "news_brief";
  if (item.contentText && item.contentText.length > 1000) return "deep_article";
  if (/(article|post|mp.weixin|newsletter|report|pdf|research)/i.test(text)) return "deep_article";
  if (/(bilibili|video|x.com|twitter|weibo|zhihu|commentary)/i.test(text)) return "opinion_insight";
  return "opinion_insight";
}

function evidenceFor(item: MaterialHubSourceItem): MaterialRecord["evidenceLevel"] {
  if (item.rawRef && item.normalizedRef) return "L1 visible-source";
  if (item.url) return "L1 visible-source";
  return "L0 raw";
}

function riskFor(item: MaterialHubSourceItem, materialType: MaterialType): MaterialRecord["riskLevel"] {
  if (item.sourceKind === "hotspot") return "medium";
  if (materialType === "opinion_insight") return "medium";
  return "low";
}

function summaryFor(item: MaterialHubSourceItem, materialType: MaterialType): string {
  const sourceText = item.summary || item.contentText?.slice(0, 220) || "No source summary captured yet.";
  if (materialType === "news_brief") return `A time-sensitive source signal from ${item.platform}: ${sourceText}`;
  if (materialType === "project_doc") return `A project material candidate that should be reviewed against ownership and current VisionTree boundaries: ${sourceText}`;
  if (materialType === "deep_article") return `A long-form material candidate for argument mapping and reusable thinking frames: ${sourceText}`;
  return `A viewpoint or commentary signal that may inspire a VisionTree angle after review: ${sourceText}`;
}

function contentOutputFor(item: MaterialHubSourceItem, materialType: MaterialType, narrativeLines: string[]): NonNullable<MaterialRecord["contentOutput"]> {
  const angle = narrativeLines[0]?.replaceAll("-", " ") ?? "judgment";
  const headlinePrefix = materialType === "news_brief" ? "Source Brief" : materialType === "deep_article" ? "Deep Reading Note" : materialType === "project_doc" ? "Project Material Note" : "Insight Seed";
  return {
    headline: `${headlinePrefix}: ${item.title}`,
    opening: `This source is useful only if we keep the human judgment point visible: what is being claimed, what is actually sourced, and what still needs checking.`,
    keyPoints: [
      `Source platform: ${item.platform} (${item.provider}).`,
      `Primary angle: ${angle}.`,
      `Review the original source before turning this into a public content draft.`
    ],
    suggestedFormat: materialType === "news_brief" ? "brief + verification checklist" : materialType === "deep_article" ? "argument map + reusable frame" : materialType === "project_doc" ? "internal material note" : "short insight post seed",
    doNotSay: [
      "Do not present platform heat as verified fact.",
      "Do not claim VisionTree makes automatic decisions.",
      "Do not remove source context or uncertainty."
    ]
  };
}

export function buildMaterialRecord(item: MaterialHubSourceItem, options: { materialType?: MaterialType; now?: string } = {}): MaterialRecord {
  const materialType = options.materialType ?? classifySourceItem(item);
  const now = options.now ?? nowIso();
  const narrativeLines = assignNarrativeLines(item);
  const baseTags = [
    item.platform,
    item.sourceKind,
    materialType,
    ...tagsForNarrative(narrativeLines)
  ];
  const id = `mat-${sha1(`${item.dedupeKey}:${materialType}`).slice(0, 12)}`;
  return {
    id,
    title: item.title,
    materialType,
    sourceRefs: [item.id],
    createdAt: now,
    updatedAt: now,
    processingStatus: "needs-review",
    evidenceLevel: evidenceFor(item),
    riskLevel: riskFor(item, materialType),
    tags: [...new Set(baseTags)],
    narrativeLines,
    summary: summaryFor(item, materialType),
    contentOutput: contentOutputFor(item, materialType, narrativeLines),
    sourceTrace: [
      {
        sourceItemId: item.id,
        url: item.url,
        title: item.title,
        rawRef: item.rawRef,
        capturedAt: item.capturedAt
      }
    ],
    imaBinding: {
      knowledgeBaseId: "",
      syncStatus: "not-synced"
    }
  };
}

function materialMarkdown(record: MaterialRecord): string {
  return `# ${record.contentOutput?.headline ?? record.title}

- materialId: \`${record.id}\`
- materialType: ${record.materialType}
- processingStatus: ${record.processingStatus}
- evidenceLevel: ${record.evidenceLevel}
- riskLevel: ${record.riskLevel}
- narrativeLines: ${record.narrativeLines.join(", ")}
- tags: ${record.tags.join(", ")}

## Summary

${record.summary}

## Content Seed

${record.contentOutput?.opening ?? ""}

${(record.contentOutput?.keyPoints ?? []).map((point) => `- ${point}`).join("\n")}

Suggested format: ${record.contentOutput?.suggestedFormat ?? "material note"}

## Source Trace

${record.sourceTrace.map((source) => `- [${source.sourceItemId}](${source.url}) capturedAt: \`${source.capturedAt}\`${source.rawRef ? `, rawRef: \`${source.rawRef}\`` : ""}`).join("\n")}

## Do Not Say

${(record.contentOutput?.doNotSay ?? []).map((note) => `- ${note}`).join("\n")}
`;
}

export async function processMaterialRecords(options: ProcessMaterialsOptions = {}): Promise<ProcessMaterialsResult> {
  const { day, items, inputRef } = await readSourceItems(options);
  const limit = options.limit ?? 20;
  const selected = items.filter((item) => !options.type || classifySourceItem(item) === options.type).slice(0, limit);
  const materialRefs: string[] = [];
  const markdownRefs: string[] = [];
  const samples: ProcessMaterialsResult["samples"] = [];

  for (const item of selected) {
    const material = buildMaterialRecord(item, { materialType: options.type });
    const materialRef = await writeJson(hubDayPath("01-material-records", day, `${material.id}.json`), material);
    const markdownRef = await writeText(hubDayPath("01-material-records", day, `${material.id}.md`), materialMarkdown(material));
    materialRefs.push(materialRef);
    markdownRefs.push(markdownRef);
    samples.push({ id: material.id, title: material.title, materialType: material.materialType, markdownRef });
  }

  const generatedAt = nowIso();
  const job = {
    generatedAt,
    day,
    inputRef,
    processedCount: materialRefs.length,
    materialRefs,
    markdownRefs,
    options
  };
  const jobRef = await writeJson(path.join(materialHubRoot, "02-processing-jobs", day, timestampedFile("job", "json")), job);

  return {
    day,
    processedCount: materialRefs.length,
    materialRefs,
    markdownRefs,
    jobRef,
    generatedAt,
    samples
  };
}
