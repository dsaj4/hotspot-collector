import path from "node:path";
import { sha1 } from "../core/hash.js";
import { dateFolder, nowIso } from "../core/time.js";
import type { MaterialRecord, MaterialType, ProcessingTemplate, SourceDigest } from "./types.js";
import { isSourceDigest } from "./types.js";
import { mergeMaterialTags } from "./tagging.js";
import { hubDayPath, latestDatedDir, materialHubRoot, readJsonl, timestampedFile, writeJson, writeText } from "./utils.js";
import { templateByType } from "./digest.js";
import { DeepSeekClient, parseJsonObjectFromText, type DeepSeekChatResult } from "./deepseek-client.js";
import { assessMaterialCardWriting, normalizeMaterialCardWriting } from "./writing-quality.js";
import { editorialKernel, writingProfileFor, writingProfiles } from "./writing-profiles.js";
import { truncateAtSentence } from "./text-utils.js";

export type AggregateCardsOptions = {
  day?: string;
  limit?: number;
  digestPath?: string;
  template?: ProcessingTemplate;
  mode?: "deepseek" | "local-rule";
  client?: Pick<DeepSeekClient, "chat">;
};

export type AggregateCardsResult = {
  day: string;
  cardCount: number;
  materialRefs: string[];
  markdownRefs: string[];
  reportRef: string;
  generatedAt: string;
  samples: Array<{ id: string; title: string; materialType: MaterialType; processingTemplate: ProcessingTemplate; markdownRef: string }>;
};

async function resolveDay(day?: string): Promise<string> {
  if (day) return day;
  return (await latestDatedDir(path.join(materialHubRoot, "00-source-digests"))) ?? dateFolder();
}

async function readDigests(options: AggregateCardsOptions): Promise<{ day: string; digests: SourceDigest[]; inputRef: string }> {
  const day = await resolveDay(options.day);
  const inputRef = options.digestPath ?? hubDayPath("00-source-digests", day, "source-digests.jsonl");
  const digests = (await readJsonl<unknown>(inputRef)).filter(isSourceDigest);
  return { day, digests, inputRef };
}

function dominantType(digests: SourceDigest[]): MaterialType {
  const counts = new Map<MaterialType, number>();
  for (const digest of digests) {
    const type = digest.contentTypeCandidates[0] ?? "opinion_insight";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "opinion_insight";
}

function templateFor(type: MaterialType, override?: ProcessingTemplate): ProcessingTemplate {
  return override ?? templateByType[type];
}

function aggregateDigestView(digest: SourceDigest): Record<string, unknown> {
  return {
    id: digest.id,
    sourceItemId: digest.sourceItemId,
    title: digest.title,
    platform: digest.platform,
    contentTypeCandidates: digest.contentTypeCandidates,
    summary: digest.summary,
    systemTags: digest.systemTags,
    taxonomyTags: digest.taxonomyTags,
    topicTags: digest.topicTags,
    factualPoints: digest.factualPoints.slice(0, 4),
    claims: digest.claims.slice(0, 4),
    verificationIssues: digest.verificationIssues.slice(0, 3),
    biasOrFrameNotes: digest.biasOrFrameNotes.slice(0, 3),
    representativeSnippets: digest.representativeSnippets.slice(0, 2)
  };
}

function titleFor(digests: SourceDigest[], type: MaterialType, template: ProcessingTemplate): string {
  const topic = commonTopic(digests);
  if (template === "intelligence_brief") return `${topic}: 发生了什么，还需要核验什么`;
  if (template === "structured_summary") return `${topic}: 整理总结卡`;
  if (template === "research_note") return `${topic}: 问题意识与研究札记`;
  return `${topic}: 这组素材里的可用张力`;
}

function commonTopic(digests: SourceDigest[]): string {
  const first = digests[0]?.title ?? "Material bundle";
  const compact = first.replace(/[\r\n]+/g, " ").slice(0, 72);
  return compact || "Material bundle";
}

function useDecision(digest: SourceDigest, dominant: MaterialType): { used: boolean; reason: string } {
  if (digest.digestStatus !== "generated") return { used: false, reason: "Digest was not generated cleanly." };
  if (!digest.summary.trim()) return { used: false, reason: "Digest has no usable summary." };
  if (digest.contentTypeCandidates.includes(dominant)) return { used: true, reason: "Matches the dominant content type and adds usable source detail." };
  if (digest.topicTags.includes("无关")) return { used: false, reason: "Topic tags suggest it is off-topic for this card." };
  if (digest.systemTags.includes("热榜") && digest.contentTypeCandidates[0] !== dominant) return { used: true, reason: "Hotspot signal kept as a background angle." };
  return { used: true, reason: "Kept as a secondary angle or counterweight." };
}

function cardBody(digests: SourceDigest[], type: MaterialType, template: ProcessingTemplate): string {
  const lead = digests[0];
  const second = digests[1];
  const sourceLine = digests.map((digest) => truncateAtSentence(digest.summary, 360)).slice(0, 3);
  if (template === "intelligence_brief") {
    return [
      `${lead?.title ?? "这组来源"}可以先看作一条待核验的来源信号，而不是已经完成判断的结论。`,
      `目前最可用的细节是：${sourceLine[0] ?? "来源指向一个具体事件或说法"}。${second ? `另一条来源补充了：${second.summary}。` : "当前来源覆盖仍然偏薄。"}`,
      "审核时要把注意力信号和事实本身分开。平台热度、产品话术或创作者评论可以解释它为什么浮上来，但不能替代事实核验。"
    ].join("\n\n");
  }
  if (template === "structured_summary") {
    return [
      `这组素材更适合先作为一条可管理的整理卡保存。核心对象是 ${lead?.title ?? "这组来源"}，相关信息应按状态、背景和后续核验来归类。`,
      `直接摘要是：${sourceLine.join(" ")}`,
      "归档时保留来源、主题和审核状态。后续审核者不用先打开所有原始文件，也应该能看出哪些是捕获到的信息，哪些是推断，哪些还没有确认。"
    ].join("\n\n");
  }
  if (template === "research_note") {
    return [
      `这组素材提出的问题比它直接给出的答案更有价值。围绕 ${lead?.title ?? "这个主题"}，它不像是在证明一个事实，更像是在暴露一个值得继续测试的模式。`,
      `${sourceLine.join(" ")} 这些信息足够形成研究札记，但还不足以支撑强结论。`,
      "可复用的框架是：流程里到底发生了什么变化，谁承担新的判断成本，哪些部分仍然只是解释而不是事实。"
    ].join("\n\n");
  }
  return [
    "这组素材里有一个值得留下的张力：一边在说这个话题变得更重要，另一边要问证据是否真的撑得起这个重量。",
    `${sourceLine.join(" ")}`,
    "这个张力才是可用的部分。它可以作为观点种子保存：足够具体，能被记住；也足够谨慎，不把某个来源的态度直接当成事实。"
  ].join("\n\n");
}

function evidenceLevel(digests: SourceDigest[]): MaterialRecord["evidenceLevel"] {
  const usedCount = digests.length;
  const stronger = digests.some((digest) => digest.sourceReliability === "A" || digest.sourceReliability === "B");
  if (usedCount >= 2 && stronger) return "L2 cross-checked";
  return "L1 visible-source";
}

function sourceCoverageFor(digests: SourceDigest[]): NonNullable<MaterialRecord["sourceCoverage"]> {
  const sufficiency = digests.length >= 3 ? "strong" : digests.length >= 2 ? "usable" : "thin";
  const missingAngles: string[] = [];
  if (digests.length < 2) missingAngles.push("Need another independent source before stronger synthesis.");
  if (!digests.some((digest) => digest.contentTypeCandidates[0] === "project_doc")) missingAngles.push("No direct project-document source in the bundle.");
  return { sufficiency, missingAngles };
}

function materialTagLayers(digests: SourceDigest[]): { systemTags: string[]; taxonomyTags: string[]; topicTags: string[]; tags: string[] } {
  const systemTags = mergeMaterialTags(...digests.map((digest) => digest.systemTags));
  const taxonomyTags = mergeMaterialTags(...digests.map((digest) => digest.taxonomyTags));
  const topicTags = mergeMaterialTags(...digests.map((digest) => digest.topicTags));
  const tags = mergeMaterialTags(systemTags, taxonomyTags, topicTags, digests.map((digest) => digest.contentTypeCandidates[0] ?? "opinion_insight"), digests.map((digest) => digest.templateCandidates[0] ?? "opinion_incubator"));
  return { systemTags, taxonomyTags, topicTags, tags };
}

function materialMarkdown(record: MaterialRecord): string {
  return `# ${record.title}

- materialId: \`${record.id}\`
- materialType: ${record.materialType}
- processingTemplate: ${record.processingTemplate}
- processingStatus: ${record.processingStatus}
- evidenceLevel: ${record.evidenceLevel}
- riskLevel: ${record.riskLevel}
- systemTags: ${(record.systemTags ?? []).join(", ")}
- taxonomyTags: ${(record.taxonomyTags ?? []).join(", ")}
- topicTags: ${(record.topicTags ?? []).join(", ")}
- narrativeLines: ${record.narrativeLines.join(", ")}
- tags: ${record.tags.join(", ")}

## Material Card

${record.cardBody ?? record.summary}

## Used Sources

${(record.usedSources ?? []).map((source) => `- ${source.sourceItemId} / ${source.digestId}: ${source.reason}`).join("\n")}

## Discarded Sources

${(record.discardedSources ?? []).length ? record.discardedSources?.map((source) => `- ${source.sourceItemId} / ${source.digestId}: ${source.reason}`).join("\n") : "- None"}

## Conflict And Coverage

${(record.sourceConflictNotes ?? []).map((note) => `- ${note}`).join("\n")}

Coverage: ${record.sourceCoverage?.sufficiency ?? "thin"}

${(record.sourceCoverage?.missingAngles ?? []).map((note) => `- Missing: ${note}`).join("\n")}

## Source Trace

${record.sourceTrace.map((source) => `- [${source.title ?? source.sourceItemId}](${source.url}) capturedAt: \`${source.capturedAt}\``).join("\n")}
`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter((item) => item.trim()) : [];
}

function asMaterialType(value: unknown, fallback: MaterialType): MaterialType {
  return value === "news_brief" || value === "project_doc" || value === "deep_article" || value === "opinion_insight" ? value : fallback;
}

function asProcessingTemplate(value: unknown, fallback: ProcessingTemplate): ProcessingTemplate {
  return value === "intelligence_brief" || value === "structured_summary" || value === "research_note" || value === "opinion_incubator" ? value : fallback;
}

function aggregateSystemPrompt(): string {
  return [
    "You aggregate source digests into readable Chinese material cards.",
    "Return strict JSON only.",
    "You may create one or more cards. Do not merge unrelated digests.",
    ...editorialKernel,
    "Focus on readable prose and source selection; do not invent tags, confidence scores, evidence levels, or platform variants.",
    "Keep source decisions visible: usedSources, discardedSources, sourceConflictNotes.",
    "Before returning JSON, silently check the body against the selected writing profile. Do not output the checklist."
  ].join("\n");
}

function aggregateUserPrompt(digests: SourceDigest[], template?: ProcessingTemplate): string {
  const promptDigests = digests.map((digest) => aggregateDigestView(digest));
  return JSON.stringify(
    {
      task: "Group related digests and create aggregated material cards.",
      optionalTemplateOverride: template,
      editorialKernel,
      writingProfile: template ? writingProfileFor(template) : writingProfiles,
      sourceBudget: {
        rule: "Depth must follow source coverage. A single thin digest may produce a concise 140-500 Chinese character card. Never pad to a nominal length with unsupported reactions, motives, impact, or background.",
        availableDigestCount: promptDigests.length
      },
      requiredSchema: {
        cards: [
          {
            title: "readable Chinese title",
            materialType: "news_brief | project_doc | deep_article | opinion_insight",
            processingTemplate: "intelligence_brief | structured_summary | research_note | opinion_incubator",
            topic: "short topic",
            cardBody: "readable Chinese short article following the selected profile length and paragraph rules",
            usedSources: [{ digestId: "digest id", reason: "why used", supportedPoints: ["points"] }],
            discardedSources: [{ digestId: "digest id", reason: "why discarded for this card" }],
            sourceConflictNotes: ["conflicts or no conflict note"],
            editorNotes: ["review notes, not writing instructions"],
            continuationAngles: ["optional exploration angles, not commands"]
          }
        ]
      },
      digests: promptDigests
    },
    null,
    2
  );
}

function repairUserPrompt(
  cards: MaterialRecord[],
  issues: Array<{ cardId: string; issues: ReturnType<typeof assessMaterialCardWriting> }>,
  digests: SourceDigest[]
): string {
  return JSON.stringify(
    {
      task: "Repair only the listed writing-quality problems. Preserve source decisions, factual boundaries, card topic, material type, and processing template.",
      editorialKernel,
      sourceDigests: digests.map((digest) => aggregateDigestView(digest)),
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title,
        materialType: card.materialType,
        processingTemplate: card.processingTemplate,
        cardBody: card.cardBody,
        usedSources: card.usedSources,
        discardedSources: card.discardedSources,
        sourceConflictNotes: card.sourceConflictNotes,
        editorNotes: card.editorNotes,
        continuationAngles: card.continuationAngles
      })),
      issues,
      requiredSchema: {
        cards: [
          {
            id: "original card id",
            title: "revised title if necessary",
            materialType: "unchanged",
            processingTemplate: "unchanged",
            cardBody: "revised readable Chinese short article",
            usedSources: "unchanged source decisions",
            discardedSources: "unchanged source decisions",
            sourceConflictNotes: "unchanged unless prose repair exposes a wording conflict",
            editorNotes: "short review notes",
            continuationAngles: "optional exploration angles"
          }
        ]
      }
    },
    null,
    2
  );
}

type CardPayload = Record<string, unknown>;

function normalizeSourceDecision(value: unknown, digestsById: Map<string, SourceDigest>, fallbackIds: string[]): NonNullable<MaterialRecord["usedSources"]> {
  const rows = Array.isArray(value) ? value : fallbackIds.map((id) => ({ digestId: id, reason: "Selected by fallback normalization.", supportedPoints: [] }));
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)))
    .map((row) => {
      const digestId = String(row.digestId || "");
      const digest = digestsById.get(digestId);
      return {
        digestId,
        sourceItemId: String(row.sourceItemId || digest?.sourceItemId || digestId),
        reason: String(row.reason || "Selected for this card."),
        supportedPoints: asStringArray(row.supportedPoints).length ? asStringArray(row.supportedPoints) : digest?.factualPoints.map((point) => point.text).slice(0, 3) ?? []
      };
    })
    .filter((row) => row.digestId && digestsById.has(row.digestId));
}

function normalizeDiscarded(value: unknown, digestsById: Map<string, SourceDigest>): NonNullable<MaterialRecord["discardedSources"]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)))
    .map((row) => {
      const digestId = String(row.digestId || "");
      const digest = digestsById.get(digestId);
      return {
        digestId,
        sourceItemId: String(row.sourceItemId || digest?.sourceItemId || digestId),
        reason: String(row.reason || "Not selected for this card.")
      };
    })
    .filter((row) => row.digestId && digestsById.has(row.digestId));
}

function normalizeCardPayload(payload: CardPayload, allDigests: SourceDigest[], response: DeepSeekChatResult): MaterialRecord {
  const fallback = buildAggregatedMaterialCard(allDigests.slice(0, 1), { template: asProcessingTemplate(payload.processingTemplate, "intelligence_brief") });
  const digestsById = new Map(allDigests.map((digest) => [digest.id, digest]));
  const usedSources = normalizeSourceDecision(payload.usedSources, digestsById, [allDigests[0]?.id ?? ""]);
  const usedDigests = usedSources.map((source) => digestsById.get(source.digestId)).filter((digest): digest is SourceDigest => Boolean(digest));
  const materialType = asMaterialType(payload.materialType, usedDigests[0]?.contentTypeCandidates[0] ?? fallback.materialType);
  const processingTemplate = asProcessingTemplate(payload.processingTemplate, templateByType[materialType]);
  const now = nowIso();
  const id = `mat-agg-${sha1(`${processingTemplate}:${payload.title}:${usedSources.map((source) => source.digestId).join(":")}`).slice(0, 12)}`;
  const coverage = sourceCoverageFor(usedDigests.length ? usedDigests : allDigests);
  const tagLayers = materialTagLayers(usedDigests.length ? usedDigests : allDigests);
  const cardBody = normalizeMaterialCardWriting(
    String(payload.cardBody || fallback.cardBody || fallback.summary),
    { sourceCount: usedSources.length }
  );

  return {
    id,
    title: String(payload.title || fallback.title),
    materialType,
    processingTemplate,
    sourceRefs: usedDigests.map((digest) => digest.sourceItemId),
    digestRefs: usedDigests.map((digest) => digest.id),
    createdAt: now,
    updatedAt: now,
    processingStatus: "needs-review",
    evidenceLevel: evidenceLevel(usedDigests.length ? usedDigests : allDigests),
    riskLevel: materialType === "project_doc" ? "low" : coverage.sufficiency === "thin" ? "medium" : "medium",
    systemTags: tagLayers.systemTags,
    taxonomyTags: tagLayers.taxonomyTags,
    topicTags: tagLayers.topicTags,
    tags: tagLayers.tags,
    narrativeLines: [...new Set([...usedDigests.flatMap((digest) => digest.narrativeLineCandidates)])],
    summary: String(payload.topic || usedDigests.map((digest) => digest.summary).join(" ") || fallback.summary),
    cardBody,
    usedSources,
    discardedSources: normalizeDiscarded(payload.discardedSources, digestsById),
    sourceConflictNotes: asStringArray(payload.sourceConflictNotes).length ? asStringArray(payload.sourceConflictNotes) : ["No explicit source conflict noted by aggregation."],
    sourceCoverage: coverage,
    editorNotes: asStringArray(payload.editorNotes),
    riskNotes: [
      materialType === "project_doc" ? "Project-doc card; keep downstream usage conservative until approved." : "",
      coverage.sufficiency === "thin" ? "Source coverage is thin; strengthen before publication." : ""
    ].filter(Boolean),
    continuationAngles: asStringArray(payload.continuationAngles),
    generation: {
      provider: "deepseek",
      model: response.model,
      promptProfile: processingTemplate,
      generatedAt: now
    },
    sourceTrace: usedDigests.map((digest) => ({
      sourceItemId: digest.sourceItemId,
      url: digest.url,
      title: digest.title,
      rawRef: digest.sourceRef,
      capturedAt: digest.capturedAt
    })),
    imaBinding: {
      knowledgeBaseId: "",
      syncStatus: "not-synced"
    }
  };
}

export async function buildAggregatedMaterialCardsWithDeepSeek(digests: SourceDigest[], client: Pick<DeepSeekClient, "chat">, options: { template?: ProcessingTemplate } = {}): Promise<MaterialRecord[]> {
  const response = await client.chat(
    [
      { role: "system", content: aggregateSystemPrompt() },
      { role: "user", content: aggregateUserPrompt(digests, options.template) }
    ],
    { temperature: 0.25, maxTokens: 4000 }
  );
  const parsed = parseJsonObjectFromText(response.content);
  const cards = Array.isArray(parsed.cards) ? parsed.cards : [parsed];
  const normalized = cards
    .filter((card): card is CardPayload => Boolean(card && typeof card === "object" && !Array.isArray(card)))
    .map((card) => normalizeCardPayload(card, digests, response));
  const issues = normalized
    .map((card) => ({
      cardId: card.id,
      issues: assessMaterialCardWriting(
        card.cardBody ?? card.summary,
        card.processingTemplate ?? templateByType[card.materialType],
        { sourceCount: card.usedSources?.length ?? card.digestRefs?.length ?? 0 }
      )
    }))
    .filter((result) => result.issues.length > 0);

  if (issues.length === 0) return normalized;

  const repairResponse = await client.chat(
    [
      { role: "system", content: aggregateSystemPrompt() },
      { role: "user", content: repairUserPrompt(normalized, issues, digests) }
    ],
    { temperature: 0.15, maxTokens: 4000 }
  );
  const repairedPayload = parseJsonObjectFromText(repairResponse.content);
  const repairedCards = Array.isArray(repairedPayload.cards) ? repairedPayload.cards : [repairedPayload];
  return repairedCards
    .filter((card): card is CardPayload => Boolean(card && typeof card === "object" && !Array.isArray(card)))
    .map((card) => normalizeCardPayload(card, digests, repairResponse));
}

export function buildAggregatedMaterialCard(digests: SourceDigest[], options: { now?: string; template?: ProcessingTemplate } = {}): MaterialRecord {
  if (digests.length === 0) throw new Error("At least one source digest is required.");
  const now = options.now ?? nowIso();
  const materialType = dominantType(digests);
  const processingTemplate = templateFor(materialType, options.template);
  const decisions = digests.map((digest) => ({ digest, ...useDecision(digest, materialType) }));
  const used = decisions.filter((decision) => decision.used);
  const discarded = decisions.filter((decision) => !decision.used);
  const usedDigests = used.map((decision) => decision.digest);
  const sourceRefs = usedDigests.map((digest) => digest.sourceItemId);
  const tagLayers = materialTagLayers(usedDigests.length ? usedDigests : digests);
  const narrativeLines = [...new Set(usedDigests.flatMap((digest) => digest.narrativeLineCandidates))];
  const id = `mat-agg-${sha1(`${processingTemplate}:${usedDigests.map((digest) => digest.id).join(":")}`).slice(0, 12)}`;
  const conflictNotes = digests.some((digest) => digest.contentTypeCandidates[0] !== materialType)
    ? ["Source set contains multiple content-type candidates; aggregation kept secondary angles only when useful."]
    : ["No direct source conflict detected in digest metadata."];
  const coverage = sourceCoverageFor(usedDigests.length ? usedDigests : digests);

  return {
    id,
    title: titleFor(usedDigests.length ? usedDigests : digests, materialType, processingTemplate),
    materialType,
    processingTemplate,
    sourceRefs: sourceRefs.length ? sourceRefs : [digests[0]!.sourceItemId],
    digestRefs: usedDigests.map((digest) => digest.id),
    createdAt: now,
    updatedAt: now,
    processingStatus: "needs-review",
    evidenceLevel: evidenceLevel(usedDigests.length ? usedDigests : digests),
    riskLevel: materialType === "project_doc" ? "low" : coverage.sufficiency === "thin" ? "medium" : "medium",
    systemTags: tagLayers.systemTags,
    taxonomyTags: tagLayers.taxonomyTags,
    topicTags: tagLayers.topicTags,
    tags: tagLayers.tags,
    narrativeLines: narrativeLines.length ? narrativeLines : ["judgment-retention"],
    summary: usedDigests.map((digest) => digest.summary).join(" "),
    cardBody: cardBody(usedDigests.length ? usedDigests : digests, materialType, processingTemplate),
    usedSources: used.map((decision) => ({
      digestId: decision.digest.id,
      sourceItemId: decision.digest.sourceItemId,
      reason: decision.reason,
      supportedPoints: decision.digest.factualPoints.map((point) => point.text).slice(0, 3)
    })),
    discardedSources: discarded.map((decision) => ({
      digestId: decision.digest.id,
      sourceItemId: decision.digest.sourceItemId,
      reason: decision.reason
    })),
    sourceConflictNotes: conflictNotes,
    sourceCoverage: coverage,
    editorNotes: ["Generated as an Option B readable material card. Review source trace before downstream use."],
    continuationAngles: [
      processingTemplate === "opinion_incubator" ? "Look for the strongest counterexample before developing the insight." : "Check whether a primary source can strengthen the card."
    ],
    generation: {
      provider: "local-rule",
      model: "option-b-scaffold-v1",
      promptProfile: processingTemplate,
      generatedAt: now
    },
    sourceTrace: (usedDigests.length ? usedDigests : digests).map((digest) => ({
      sourceItemId: digest.sourceItemId,
      url: digest.url,
      title: digest.title,
      rawRef: digest.sourceRef,
      capturedAt: digest.capturedAt
    })),
    imaBinding: {
      knowledgeBaseId: "",
      syncStatus: "not-synced"
    }
  };
}

export async function aggregateMaterialCards(options: AggregateCardsOptions = {}): Promise<AggregateCardsResult> {
  const { day, digests, inputRef } = await readDigests(options);
  const selected = digests.slice(0, options.limit ?? 8);
  const mode = options.mode ?? "deepseek";
  const client = options.client ?? new DeepSeekClient();
  const materials = mode === "local-rule"
    ? selected.map((digest) => buildAggregatedMaterialCard([digest], { template: options.template }))
    : await buildAggregatedMaterialCardsWithDeepSeek(selected, client, { template: options.template });
  const materialRefs: string[] = [];
  const markdownRefs: string[] = [];
  for (const material of materials) {
    materialRefs.push(await writeJson(hubDayPath("01-material-records", day, `${material.id}.json`), material));
    markdownRefs.push(await writeText(hubDayPath("01-material-records", day, `${material.id}.md`), materialMarkdown(material)));
  }
  const generatedAt = nowIso();
  const report = {
    generatedAt,
    day,
    inputRef,
    mode,
    cardCount: materials.length,
    materialRefs,
    markdownRefs,
    options
  };
  const reportRef = await writeJson(path.join(materialHubRoot, "02-processing-jobs", day, timestampedFile("aggregate-cards", "json")), report);
  return {
    day,
    cardCount: materials.length,
    materialRefs,
    markdownRefs,
    reportRef,
    generatedAt,
    samples: materials.map((material, index) => ({
        id: material.id,
        title: material.title,
        materialType: material.materialType,
        processingTemplate: material.processingTemplate ?? templateByType[material.materialType],
        markdownRef: markdownRefs[index]!
      }))
  };
}
