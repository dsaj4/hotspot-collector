import path from "node:path";
import { sha1 } from "../core/hash.js";
import { dateFolder, nowIso } from "../core/time.js";
import type { MaterialHubSourceItem, MaterialType, ProcessingTemplate, SourceDigest } from "./types.js";
import { isSourceItem } from "./types.js";
import { assignNarrativeLines } from "./narrative.js";
import { mergeMaterialTags, normalizeTaxonomyTags, normalizeTopicTags, systemTagsFor, taxonomyTagsForMaterialType } from "./tagging.js";
import { fileExists, hubDayPath, latestDatedDir, materialHubRoot, readJsonl, timestampedFile, writeJson, writeJsonl, writeText } from "./utils.js";
import { classifySourceItem } from "./processing.js";
import { DeepSeekClient, parseJsonObjectFromText, type DeepSeekChatResult } from "./deepseek-client.js";
import { sourceExcerpt, splitSentences, truncateAtSentence } from "./text-utils.js";

export type DigestSourcesOptions = {
  day?: string;
  limit?: number;
  sourceItemsPath?: string;
  mode?: "deepseek" | "local-rule";
  client?: Pick<DeepSeekClient, "chat">;
  sourceKind?: MaterialHubSourceItem["sourceKind"];
  outputLabel?: string;
};

export type DigestSourcesResult = {
  day: string;
  digestedCount: number;
  digestRef: string;
  reportRef: string;
  briefRef: string;
  generatedAt: string;
  samples: Array<{ id: string; title: string; contentTypeCandidates: MaterialType[]; templateCandidates: ProcessingTemplate[] }>;
};

function safeLabel(value: string | undefined): string {
  return value?.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "";
}

export function digestBriefMarkdown(day: string, digests: SourceDigest[]): string {
  const groups = new Map<string, SourceDigest[]>();
  for (const digest of digests) {
    const key = digest.taxonomyTags[0] ?? digest.topicTags[0] ?? "未分类";
    groups.set(key, [...(groups.get(key) ?? []), digest]);
  }
  const sections = [...groups.entries()].map(([topic, rows]) => [
    `## ${topic}`,
    "",
    ...rows.flatMap((digest) => [
      `### [${digest.title}](${digest.url})`,
      "",
      digest.summary,
      "",
      `- 标签：${[...digest.taxonomyTags, ...digest.topicTags].slice(0, 8).join("、") || "无"}`,
      `- 待核验：${digest.verificationIssues.slice(0, 3).join("；") || "无明确待核验项"}`,
      `- 成卡候选：${digest.templateCandidates.join("、")}`,
      ""
    ])
  ].join("\n"));
  return [`# ${day} Digest 主题简报`, "", `共 ${digests.length} 条来源，按首个分类标签聚类。该简报用于浏览和选材，不是素材卡。`, "", ...sections].join("\n");
}

const templateByType: Record<MaterialType, ProcessingTemplate> = {
  news_brief: "intelligence_brief",
  project_doc: "structured_summary",
  deep_article: "research_note",
  opinion_insight: "opinion_incubator"
};

async function resolveDay(day?: string): Promise<string> {
  if (day) return day;
  return (await latestDatedDir(path.join(materialHubRoot, "00-source-items"))) ?? dateFolder();
}

async function readSourceItems(options: DigestSourcesOptions): Promise<{ day: string; items: MaterialHubSourceItem[]; inputRef: string }> {
  const day = await resolveDay(options.day);
  const inputRef = options.sourceItemsPath ?? hubDayPath("00-source-items", day, "source-items.jsonl");
  if (!(await fileExists(inputRef))) throw new Error(`No material hub source items found: ${inputRef}`);
  const items = (await readJsonl<unknown>(inputRef)).filter(isSourceItem);
  return { day, items, inputRef };
}

function digestSummary(item: MaterialHubSourceItem): string {
  const text = item.contentText || item.summary || item.title;
  const parts = splitSentences(text);
  if (parts.length === 0) return item.title;
  return truncateAtSentence(parts.slice(0, 3).join(" "), 420);
}

function tagsFor(item: MaterialHubSourceItem, materialType: MaterialType): string[] {
  return [...new Set([item.platform, item.sourceKind, materialType, ...assignNarrativeLines(item)])];
}

function reliabilityFor(item: MaterialHubSourceItem): SourceDigest["sourceReliability"] {
  if (item.provider.includes("official") || item.platform === "local") return "B";
  if (item.sourceKind === "hotspot") return "C";
  if (item.platform === "bilibili" || item.platform === "weibo" || item.platform === "zhihu") return "C";
  return "D";
}

function credibilityFor(item: MaterialHubSourceItem): SourceDigest["informationCredibility"] {
  if (item.rawRef && item.normalizedRef) return "2";
  if (item.url) return "3";
  return "4";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter((item) => item.trim()) : [];
}

function asMaterialTypes(value: unknown, fallback: MaterialType): MaterialType[] {
  const valid = new Set<MaterialType>(["news_brief", "project_doc", "deep_article", "opinion_insight"]);
  const values = Array.isArray(value) ? value.filter((item): item is MaterialType => valid.has(item as MaterialType)) : [];
  return values.length ? values : [fallback];
}

function asTemplates(value: unknown, fallback: ProcessingTemplate): ProcessingTemplate[] {
  const valid = new Set<ProcessingTemplate>(["intelligence_brief", "structured_summary", "research_note", "opinion_incubator"]);
  const values = Array.isArray(value) ? value.filter((item): item is ProcessingTemplate => valid.has(item as ProcessingTemplate)) : [];
  return values.length ? values : [fallback];
}

function digestSystemPrompt(): string {
  return [
    "You create faithful single-source digests for a Chinese material processing hub.",
    "Return strict JSON only.",
    "Do not write a short article.",
    "Do not add VisionTree framing.",
    "Do not infer missing facts.",
    "Separate facts, opinions, metrics, predictions, snippets, verification issues, and source framing.",
    "Focus on faithful reading, not scoring or evidence grading.",
    "Use Chinese for human-readable fields unless the source text is only English."
  ].join("\n");
}

function digestUserPrompt(item: MaterialHubSourceItem, fallbackType: MaterialType, fallbackTemplate: ProcessingTemplate): string {
  return JSON.stringify(
    {
      task: "Create one conservative source digest.",
      requiredSchema: {
        summary: "faithful summary, 80-180 Chinese chars",
        factualPoints: [{ text: "fact from source", support: "direct | inferred-from-source | needs-verification", sourceSpan: "short source wording if available" }],
        claims: [{ text: "claim", claimType: "fact | opinion | prediction | metric | quote", confidence: "low | medium | high" }],
        entities: [{ name: "entity", type: "person | org | product | place | project | concept | other" }],
        taxonomyTags: ["时政 | 新闻 | AI | 访谈 | 产品 | 游戏 | 科技 | 研究 | 项目 | 文档 | 教程 | 观点 | 商业 | 设计 | 文化 | 教育 | 娱乐 | 社区 | 政策 | 市场 | 工具 | 运营 | 方法 | 复盘 | 财经 | 社会"],
        topicTags: ["free-form topical tags, concise and non-standardized"],
        representativeSnippets: [{ text: "short source snippet", reason: "why useful" }],
        verificationIssues: ["issues"],
        biasOrFrameNotes: ["notes"]
      },
      fallback: { contentType: fallbackType, processingTemplate: fallbackTemplate },
      source: item
    },
    null,
    2
  );
}

function normalizeDigestPayload(item: MaterialHubSourceItem, payload: Record<string, unknown>, response: DeepSeekChatResult, sourceRef?: string): SourceDigest {
  const fallback = buildSourceDigest(item, { sourceRef });
  const contentTypes = asMaterialTypes(payload.contentTypeCandidates, fallback.contentTypeCandidates[0]!);
  const templates = asTemplates(payload.templateCandidates, templateByType[contentTypes[0]!] ?? fallback.templateCandidates[0]!);
  const taxTags = normalizeTaxonomyTags(asStringArray(payload.taxonomyTags), `${item.title} ${item.summary ?? ""} ${item.contentText ?? ""}`);
  const resolvedTaxTags = taxTags.length ? taxTags : taxonomyTagsForMaterialType(contentTypes[0] ?? fallback.contentTypeCandidates[0]!);
  const topicTags = normalizeTopicTags(asStringArray(payload.topicTags), `${item.title} ${item.summary ?? ""} ${item.contentText ?? ""}`);
  const factualPoints: SourceDigest["factualPoints"] = Array.isArray(payload.factualPoints)
    ? payload.factualPoints
        .filter((point): point is Record<string, unknown> => Boolean(point && typeof point === "object" && !Array.isArray(point)))
        .map((point): SourceDigest["factualPoints"][number] => ({
          text: String(point.text || fallback.summary),
          support: point.support === "direct" || point.support === "inferred-from-source" || point.support === "needs-verification" ? point.support : "needs-verification",
          sourceSpan: point.sourceSpan === undefined ? undefined : String(point.sourceSpan)
        }))
    : fallback.factualPoints;
  const claims: SourceDigest["claims"] = Array.isArray(payload.claims)
    ? payload.claims
        .filter((claim): claim is Record<string, unknown> => Boolean(claim && typeof claim === "object" && !Array.isArray(claim)))
        .map((claim): SourceDigest["claims"][number] => ({
          text: String(claim.text || fallback.title),
          claimType: claim.claimType === "opinion" || claim.claimType === "prediction" || claim.claimType === "metric" || claim.claimType === "quote" || claim.claimType === "fact" ? claim.claimType : "fact",
          confidence: claim.confidence === "low" || claim.confidence === "high" || claim.confidence === "medium" ? claim.confidence : "medium"
        }))
    : fallback.claims;
  const entities: SourceDigest["entities"] = Array.isArray(payload.entities)
    ? payload.entities
        .filter((entity): entity is Record<string, unknown> => Boolean(entity && typeof entity === "object" && !Array.isArray(entity)))
        .map((entity): SourceDigest["entities"][number] => ({
          name: String(entity.name || fallback.title).slice(0, 80),
          type: entity.type === "person" || entity.type === "org" || entity.type === "product" || entity.type === "place" || entity.type === "project" || entity.type === "concept" || entity.type === "other" ? entity.type : "other"
        }))
    : fallback.entities;
  const snippets = Array.isArray(payload.representativeSnippets)
    ? payload.representativeSnippets
        .filter((snippet): snippet is Record<string, unknown> => Boolean(snippet && typeof snippet === "object" && !Array.isArray(snippet)))
        .map((snippet) => ({ text: sourceExcerpt(String(snippet.text || ""), 240), reason: String(snippet.reason || "Review support.") }))
        .filter((snippet) => snippet.text)
    : fallback.representativeSnippets;
  const systemTags = systemTagsFor(item, contentTypes[0] ?? fallback.contentTypeCandidates[0]!);

  return {
    ...fallback,
    digestStatus: "generated",
    contentTypeCandidates: contentTypes,
    templateCandidates: templates,
    summary: String(payload.summary || fallback.summary),
    systemTags,
    taxonomyTags: resolvedTaxTags,
    topicTags: topicTags.length ? topicTags : fallback.topicTags,
    factualPoints: factualPoints.length ? factualPoints : fallback.factualPoints,
    claims: claims.length ? claims : fallback.claims,
    entities: entities.length ? entities : fallback.entities,
    tagsCandidate: mergeMaterialTags(systemTags, resolvedTaxTags, topicTags, fallback.tagsCandidate),
    narrativeLineCandidates: [...new Set([...fallback.narrativeLineCandidates, ...assignNarrativeLines(item)])],
    representativeSnippets: snippets.length ? snippets : fallback.representativeSnippets,
    sourceReliability: reliabilityFor(item),
    informationCredibility: credibilityFor(item),
    verificationIssues: asStringArray(payload.verificationIssues).length ? asStringArray(payload.verificationIssues) : fallback.verificationIssues,
    biasOrFrameNotes: asStringArray(payload.biasOrFrameNotes).length ? asStringArray(payload.biasOrFrameNotes) : fallback.biasOrFrameNotes,
    digestModel: response.model,
    generatedAt: nowIso()
  };
}

export async function buildSourceDigestWithDeepSeek(item: MaterialHubSourceItem, client: Pick<DeepSeekClient, "chat">, options: { sourceRef?: string } = {}): Promise<SourceDigest> {
  const fallbackType = classifySourceItem(item);
  const fallbackTemplate = templateByType[fallbackType];
  const response = await client.chat(
    [
      { role: "system", content: digestSystemPrompt() },
      { role: "user", content: digestUserPrompt(item, fallbackType, fallbackTemplate) }
    ],
    { temperature: 0.1, maxTokens: 1800 }
  );
  return normalizeDigestPayload(item, parseJsonObjectFromText(response.content), response, options.sourceRef);
}

export function buildSourceDigest(item: MaterialHubSourceItem, options: { now?: string; sourceRef?: string } = {}): SourceDigest {
  const materialType = classifySourceItem(item);
  const template = templateByType[materialType];
  const summary = digestSummary(item);
  const text = item.contentText || item.summary || item.title;
  const snippets = splitSentences(text).slice(0, 2);
  const id = `dig-${sha1(`${item.id}:${item.dedupeKey}`).slice(0, 12)}`;
  const generatedAt = options.now ?? nowIso();
  const systemTags = systemTagsFor(item, materialType);
  const taxonomyTags = normalizeTaxonomyTags([], `${item.title} ${item.summary ?? ""} ${item.contentText ?? ""}`);
  const resolvedTaxonomyTags = taxonomyTags.length ? taxonomyTags : taxonomyTagsForMaterialType(materialType);
  const topicTags = normalizeTopicTags([], `${item.title} ${item.summary ?? ""} ${item.contentText ?? ""}`);
  const tags = mergeMaterialTags(systemTags, resolvedTaxonomyTags, topicTags, [item.platform, item.sourceKind, materialType, ...assignNarrativeLines(item)]);
  const heatMatch = item.summary?.match(/heat:\s*([^|]+)/i);

  return {
    id,
    sourceItemId: item.id,
    sourceRef: options.sourceRef ?? item.normalizedRef ?? item.rawRef ?? item.url,
    platform: item.platform,
    provider: item.provider,
    url: item.url,
    title: item.title,
    authorName: item.authorName,
    publishedAt: item.publishedAt,
    capturedAt: item.capturedAt,
    digestStatus: "generated",
    contentTypeCandidates: [materialType],
    templateCandidates: [template],
    summary,
    systemTags,
    taxonomyTags: resolvedTaxonomyTags,
    topicTags,
    factualPoints: [
      {
        text: summary,
        support: item.summary || item.contentText ? "direct" : "needs-verification",
        sourceSpan: snippets[0]
      }
    ],
    claims: [
      {
        text: materialType === "opinion_insight" ? `Source expresses or implies a viewpoint around: ${item.title}` : `Source reports material around: ${item.title}`,
        claimType: materialType === "opinion_insight" ? "opinion" : "fact",
        confidence: item.summary || item.contentText ? "medium" : "low"
      }
    ],
    entities: [{ name: item.title.slice(0, 80), type: materialType === "project_doc" ? "project" : "concept" }],
    tagsCandidate: tags,
    narrativeLineCandidates: assignNarrativeLines(item),
    representativeSnippets: snippets.map((snippet) => ({ text: sourceExcerpt(snippet, 240), reason: "Representative source wording for review." })),
    sourceReliability: reliabilityFor(item),
    informationCredibility: credibilityFor(item),
    attentionSignal: heatMatch ? { metric: "heat", value: heatMatch[1]?.trim(), caveat: "Platform heat is an attention signal, not factual verification." } : undefined,
    verificationIssues: [
      item.sourceKind === "hotspot" ? "Check original source behind platform ranking before publication." : "Review original source before public use.",
      materialType === "opinion_insight" ? "Keep opinion attributed; do not convert it into verified fact." : ""
    ].filter(Boolean),
    biasOrFrameNotes: [item.sourceKind === "hotspot" ? "Ranking/platform framing may amplify attention over importance." : "Single-source digest; aggregation should check fit with other sources."],
    digestModel: "local-rule-v1",
    generatedAt
  };
}

export async function digestSources(options: DigestSourcesOptions = {}): Promise<DigestSourcesResult> {
  const { day, items, inputRef } = await readSourceItems(options);
  const selected = items.filter((item) => !options.sourceKind || item.sourceKind === options.sourceKind).slice(0, options.limit ?? 20);
  const mode = options.mode ?? "deepseek";
  const client = options.client ?? new DeepSeekClient();
  const digests = mode === "local-rule"
    ? selected.map((item) => buildSourceDigest(item, { sourceRef: inputRef }))
    : await Promise.all(selected.map((item) => buildSourceDigestWithDeepSeek(item, client, { sourceRef: inputRef })));
  const generatedAt = nowIso();
  const label = safeLabel(options.outputLabel ?? options.sourceKind);
  const digestRef = await writeJsonl(hubDayPath("00-source-digests", day, label ? `source-digests-${label}.jsonl` : "source-digests.jsonl"), digests);
  const briefRef = await writeText(hubDayPath("00-source-digests", day, label ? `digest-brief-${label}.md` : "digest-brief.md"), digestBriefMarkdown(day, digests));
  const report = {
    generatedAt,
    day,
    inputRef,
    digestRef,
    briefRef,
    mode,
    digestedCount: digests.length,
    samples: digests.slice(0, 5).map((digest) => ({
      id: digest.id,
      title: digest.title,
      contentTypeCandidates: digest.contentTypeCandidates,
      templateCandidates: digest.templateCandidates
    }))
  };
  const reportRef = await writeJson(path.join(materialHubRoot, "02-processing-jobs", day, timestampedFile("digest-sources", "json")), report);

  return { ...report, reportRef };
}

export { templateByType };
