export type MaterialType = "news_brief" | "project_doc" | "deep_article" | "opinion_insight";

export type ProcessingTemplate = "intelligence_brief" | "structured_summary" | "research_note" | "opinion_incubator";

export type ProcessingStatus = "new" | "processing" | "processed" | "needs-review" | "approved" | "rejected";

export type ImaSyncStatus = "not-synced" | "queued" | "synced" | "pull-only" | "error";

export type ImaReconcileStatus =
  | "linked"
  | "missing-in-ima"
  | "ima-only"
  | "duplicate-title"
  | "needs-local-card"
  | "needs-resync";

export type MaterialHubSourceKind = "subscription" | "hotspot" | "temporary-link" | "ima";

export type MaterialHubSourceItem = {
  id: string;
  sourceKind: MaterialHubSourceKind;
  platform: string;
  provider: string;
  title: string;
  url: string;
  authorId?: string;
  authorName?: string;
  publishedAt?: string | null;
  capturedAt: string;
  summary?: string;
  contentText?: string;
  media?: string[];
  rawRef?: string;
  normalizedRef?: string;
  dedupeKey: string;
};

export type SourceDigest = {
  id: string;
  sourceItemId: string;
  sourceRef: string;
  platform: string;
  provider: string;
  url: string;
  title: string;
  authorName?: string;
  publishedAt?: string | null;
  capturedAt: string;
  digestStatus: "generated" | "needs-review" | "failed";
  contentTypeCandidates: MaterialType[];
  templateCandidates: ProcessingTemplate[];
  summary: string;
  systemTags: string[];
  taxonomyTags: string[];
  topicTags: string[];
  factualPoints: Array<{
    text: string;
    support: "direct" | "inferred-from-source" | "needs-verification";
    sourceSpan?: string;
  }>;
  claims: Array<{
    text: string;
    claimType: "fact" | "opinion" | "prediction" | "metric" | "quote";
    confidence: "low" | "medium" | "high";
  }>;
  entities: Array<{
    name: string;
    type: "person" | "org" | "product" | "place" | "project" | "concept" | "other";
  }>;
  tagsCandidate: string[];
  narrativeLineCandidates: string[];
  representativeSnippets: Array<{
    text: string;
    reason: string;
  }>;
  sourceReliability: "A" | "B" | "C" | "D" | "E" | "F";
  informationCredibility: "1" | "2" | "3" | "4" | "5" | "6";
  attentionSignal?: {
    metric?: string;
    value?: string;
    caveat: string;
  };
  verificationIssues: string[];
  biasOrFrameNotes: string[];
  digestModel?: string;
  generatedAt: string;
};

export type MaterialRecord = {
  id: string;
  title: string;
  materialType: MaterialType;
  processingTemplate?: ProcessingTemplate;
  sourceRefs: string[];
  digestRefs?: string[];
  createdAt: string;
  updatedAt: string;
  processingStatus: ProcessingStatus;
  evidenceLevel: "L0 raw" | "L1 visible-source" | "L2 cross-checked" | "L3 publication-ready";
  riskLevel: "low" | "medium" | "high";
  tags: string[];
  systemTags?: string[];
  taxonomyTags?: string[];
  topicTags?: string[];
  narrativeLines: string[];
  summary: string;
  cardBody?: string;
  usedSources?: Array<{
    digestId: string;
    sourceItemId: string;
    reason: string;
    supportedPoints: string[];
  }>;
  discardedSources?: Array<{
    digestId: string;
    sourceItemId: string;
    reason: string;
  }>;
  sourceConflictNotes?: string[];
  sourceCoverage?: {
    sufficiency: "thin" | "usable" | "strong";
    missingAngles: string[];
  };
  editorNotes?: string[];
  riskNotes?: string[];
  continuationAngles?: string[];
  generation?: {
    provider: "deepseek" | "openai" | "local-rule" | "other";
    model: string;
    promptProfile: string;
    generatedAt: string;
  };
  contentOutput?: {
    headline: string;
    opening: string;
    keyPoints: string[];
    suggestedFormat: string;
    doNotSay: string[];
  };
  sourceTrace: Array<{ sourceItemId: string; url: string; title?: string; rawRef?: string; capturedAt: string }>;
  imaBinding?: {
    knowledgeBaseId: string;
    mediaId?: string;
    imaUrl?: string;
    syncStatus: ImaSyncStatus;
    reconcileStatus?: ImaReconcileStatus;
    lastSyncedAt?: string;
    lastInventoryAt?: string;
    lastError?: string;
  };
};

const sourceKinds = new Set<MaterialHubSourceKind>(["subscription", "hotspot", "temporary-link", "ima"]);
const materialTypes = new Set<MaterialType>(["news_brief", "project_doc", "deep_article", "opinion_insight"]);
const processingTemplates = new Set<ProcessingTemplate>(["intelligence_brief", "structured_summary", "research_note", "opinion_incubator"]);
const processingStatuses = new Set<ProcessingStatus>(["new", "processing", "processed", "needs-review", "approved", "rejected"]);
const evidenceLevels = new Set<MaterialRecord["evidenceLevel"]>([
  "L0 raw",
  "L1 visible-source",
  "L2 cross-checked",
  "L3 publication-ready"
]);
const riskLevels = new Set<MaterialRecord["riskLevel"]>(["low", "medium", "high"]);
const imaSyncStatuses = new Set<ImaSyncStatus>(["not-synced", "queued", "synced", "pull-only", "error"]);
const imaReconcileStatuses = new Set<ImaReconcileStatus>([
  "linked",
  "missing-in-ima",
  "ima-only",
  "duplicate-title",
  "needs-local-card",
  "needs-resync"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
}

function isSourceTrace(value: unknown): value is MaterialRecord["sourceTrace"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        isNonEmptyString(item.sourceItemId) &&
        isNonEmptyString(item.url) &&
        isNonEmptyString(item.capturedAt) &&
        (item.title === undefined || typeof item.title === "string") &&
        (item.rawRef === undefined || typeof item.rawRef === "string")
    )
  );
}

function isContentOutput(value: unknown): value is NonNullable<MaterialRecord["contentOutput"]> {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.opening) &&
    isStringArray(value.keyPoints) &&
    isNonEmptyString(value.suggestedFormat) &&
    isStringArray(value.doNotSay)
  );
}

function isUsedSources(value: unknown): value is NonNullable<MaterialRecord["usedSources"]> {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          isNonEmptyString(item.digestId) &&
          isNonEmptyString(item.sourceItemId) &&
          isNonEmptyString(item.reason) &&
          isStringArray(item.supportedPoints)
      ))
  );
}

function isDiscardedSources(value: unknown): value is NonNullable<MaterialRecord["discardedSources"]> {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          isNonEmptyString(item.digestId) &&
          isNonEmptyString(item.sourceItemId) &&
          isNonEmptyString(item.reason)
      ))
  );
}

function isSourceCoverage(value: unknown): value is NonNullable<MaterialRecord["sourceCoverage"]> {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (value.sufficiency === "thin" || value.sufficiency === "usable" || value.sufficiency === "strong") && isStringArray(value.missingAngles);
}

function isGeneration(value: unknown): value is NonNullable<MaterialRecord["generation"]> {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    (value.provider === "deepseek" || value.provider === "openai" || value.provider === "local-rule" || value.provider === "other") &&
    isNonEmptyString(value.model) &&
    isNonEmptyString(value.promptProfile) &&
    isNonEmptyString(value.generatedAt)
  );
}

function isImaBinding(value: unknown): value is MaterialRecord["imaBinding"] {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.knowledgeBaseId !== "string") return false;
  if (!imaSyncStatuses.has(value.syncStatus as ImaSyncStatus)) return false;
  if (value.mediaId !== undefined && typeof value.mediaId !== "string") return false;
  if (value.imaUrl !== undefined && typeof value.imaUrl !== "string") return false;
  if (value.reconcileStatus !== undefined && !imaReconcileStatuses.has(value.reconcileStatus as ImaReconcileStatus)) return false;
  if (value.lastSyncedAt !== undefined && typeof value.lastSyncedAt !== "string") return false;
  if (value.lastInventoryAt !== undefined && typeof value.lastInventoryAt !== "string") return false;
  if (value.lastError !== undefined && typeof value.lastError !== "string") return false;
  return true;
}

export function isSourceItem(value: unknown): value is MaterialHubSourceItem {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    sourceKinds.has(value.sourceKind as MaterialHubSourceKind) &&
    isNonEmptyString(value.platform) &&
    isNonEmptyString(value.provider) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.url) &&
    isNonEmptyString(value.capturedAt) &&
    isNonEmptyString(value.dedupeKey) &&
    (value.authorId === undefined || typeof value.authorId === "string") &&
    (value.authorName === undefined || typeof value.authorName === "string") &&
    (value.publishedAt === undefined || value.publishedAt === null || typeof value.publishedAt === "string") &&
    (value.summary === undefined || typeof value.summary === "string") &&
    (value.contentText === undefined || typeof value.contentText === "string") &&
    (value.media === undefined || isStringArray(value.media)) &&
    (value.rawRef === undefined || typeof value.rawRef === "string") &&
    (value.normalizedRef === undefined || typeof value.normalizedRef === "string")
  );
}

export function isSourceDigest(value: unknown): value is SourceDigest {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sourceItemId) &&
    isNonEmptyString(value.sourceRef) &&
    isNonEmptyString(value.platform) &&
    isNonEmptyString(value.provider) &&
    isNonEmptyString(value.url) &&
    isNonEmptyString(value.title) &&
    (value.authorName === undefined || typeof value.authorName === "string") &&
    (value.publishedAt === undefined || value.publishedAt === null || typeof value.publishedAt === "string") &&
    isNonEmptyString(value.capturedAt) &&
    (value.digestStatus === "generated" || value.digestStatus === "needs-review" || value.digestStatus === "failed") &&
    Array.isArray(value.contentTypeCandidates) &&
    value.contentTypeCandidates.every((item) => materialTypes.has(item as MaterialType)) &&
    Array.isArray(value.templateCandidates) &&
    value.templateCandidates.every((item) => processingTemplates.has(item as ProcessingTemplate)) &&
    isNonEmptyString(value.summary) &&
    isOptionalStringArray(value.systemTags) &&
    isOptionalStringArray(value.taxonomyTags) &&
    isOptionalStringArray(value.topicTags) &&
    Array.isArray(value.factualPoints) &&
    value.factualPoints.every(
      (item) =>
        isRecord(item) &&
        isNonEmptyString(item.text) &&
        (item.support === "direct" || item.support === "inferred-from-source" || item.support === "needs-verification") &&
        (item.sourceSpan === undefined || typeof item.sourceSpan === "string")
    ) &&
    Array.isArray(value.claims) &&
    value.claims.every(
      (item) =>
        isRecord(item) &&
        isNonEmptyString(item.text) &&
        (item.claimType === "fact" || item.claimType === "opinion" || item.claimType === "prediction" || item.claimType === "metric" || item.claimType === "quote") &&
        (item.confidence === "low" || item.confidence === "medium" || item.confidence === "high")
    ) &&
    Array.isArray(value.entities) &&
    value.entities.every(
      (item) =>
        isRecord(item) &&
        isNonEmptyString(item.name) &&
        (item.type === "person" || item.type === "org" || item.type === "product" || item.type === "place" || item.type === "project" || item.type === "concept" || item.type === "other")
    ) &&
    isStringArray(value.tagsCandidate) &&
    isStringArray(value.narrativeLineCandidates) &&
    Array.isArray(value.representativeSnippets) &&
    value.representativeSnippets.every((item) => isRecord(item) && isNonEmptyString(item.text) && isNonEmptyString(item.reason)) &&
    (value.sourceReliability === "A" || value.sourceReliability === "B" || value.sourceReliability === "C" || value.sourceReliability === "D" || value.sourceReliability === "E" || value.sourceReliability === "F") &&
    (value.informationCredibility === "1" || value.informationCredibility === "2" || value.informationCredibility === "3" || value.informationCredibility === "4" || value.informationCredibility === "5" || value.informationCredibility === "6") &&
    (value.attentionSignal === undefined ||
      (isRecord(value.attentionSignal) &&
        (value.attentionSignal.metric === undefined || typeof value.attentionSignal.metric === "string") &&
        (value.attentionSignal.value === undefined || typeof value.attentionSignal.value === "string") &&
        isNonEmptyString(value.attentionSignal.caveat))) &&
    isStringArray(value.verificationIssues) &&
    isStringArray(value.biasOrFrameNotes) &&
    (value.digestModel === undefined || typeof value.digestModel === "string") &&
    isNonEmptyString(value.generatedAt)
  );
}

export function isMaterialRecord(value: unknown): value is MaterialRecord {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    materialTypes.has(value.materialType as MaterialType) &&
    (value.processingTemplate === undefined || processingTemplates.has(value.processingTemplate as ProcessingTemplate)) &&
    isStringArray(value.sourceRefs) &&
    value.sourceRefs.length > 0 &&
    isOptionalStringArray(value.digestRefs) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    processingStatuses.has(value.processingStatus as ProcessingStatus) &&
    evidenceLevels.has(value.evidenceLevel as MaterialRecord["evidenceLevel"]) &&
    riskLevels.has(value.riskLevel as MaterialRecord["riskLevel"]) &&
    isStringArray(value.tags) &&
    isOptionalStringArray(value.systemTags) &&
    isOptionalStringArray(value.taxonomyTags) &&
    isOptionalStringArray(value.topicTags) &&
    isStringArray(value.narrativeLines) &&
    isNonEmptyString(value.summary) &&
    (value.cardBody === undefined || isNonEmptyString(value.cardBody)) &&
    isUsedSources(value.usedSources) &&
    isDiscardedSources(value.discardedSources) &&
    isOptionalStringArray(value.sourceConflictNotes) &&
    isSourceCoverage(value.sourceCoverage) &&
    isOptionalStringArray(value.editorNotes) &&
    isOptionalStringArray(value.riskNotes) &&
    isOptionalStringArray(value.continuationAngles) &&
    isGeneration(value.generation) &&
    isContentOutput(value.contentOutput) &&
    isSourceTrace(value.sourceTrace) &&
    isImaBinding(value.imaBinding)
  );
}
