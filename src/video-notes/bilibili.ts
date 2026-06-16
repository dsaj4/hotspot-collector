import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bilisumAccessToken, bilisumBaseUrl, bilisumPollIntervalMs, bilisumTaskTimeoutMs, bilisumVisualNoteMode } from "../config.js";
import { artifactPath } from "../core/paths.js";
import { appendJsonlUnique } from "../core/storage.js";
import { sha1 } from "../core/hash.js";
import { dateFolder, nowIso } from "../core/time.js";
import type { MaterialHubSourceItem, MaterialHubSourceKind } from "../material-hub/types.js";
import { hubDayPath, materialHubRoot, normalizeRelPath } from "../material-hub/utils.js";
import type { BrowserObservation, HotspotItem, SubscriptionItem, TranscriptSegment } from "../types.js";
import { BiliSumClient, type BiliSumMindmapResponse, type BiliSumTaskDetail, type BiliSumTaskResult, type BiliSumVisualEvidenceResponse } from "../integrations/bilisum/client.js";
import type { BiliSumClientConfig, VideoIntakeCandidate, VideoProcessingResult, VideoTranscriptKind } from "./types.js";

export type IntakeBilibiliVideoOptions = {
  url: string;
  title?: string;
  sourceKind?: MaterialHubSourceKind;
  authorId?: string;
  authorName?: string;
  publishedAt?: string | null;
  day?: string;
  client?: BiliSumClient;
  config?: Partial<BiliSumClientConfig>;
  publishToMaterialHub?: boolean;
};

export type IntakeBilibiliVideoResult = {
  day: string;
  status: VideoProcessingResult["status"];
  videoResultRef: string;
  sourceItemRef?: string;
  sourceItem?: MaterialHubSourceItem;
  bilisumTaskId?: string;
  warnings: string[];
  learningPackageRef: string;
  openableRefs: string[];
};

export type IntakeLatestBilibiliVideosResult = {
  processedCount: number;
  completedCount: number;
  needsAsrCount: number;
  failedCount: number;
  results: IntakeBilibiliVideoResult[];
};

export type IntakeBilibiliVideoListOptions = {
  inputPath: string;
  limit?: number;
  day?: string;
  client?: BiliSumClient;
  config?: Partial<BiliSumClientConfig>;
  publishToMaterialHub?: boolean;
};

export type BilibiliVideoListItem = {
  title?: string;
  url: string;
  authorId?: string;
  authorName?: string;
  publishedAt?: string | null;
};

export type IntakeBilibiliVideoListResult = {
  day: string;
  inputPath: string;
  inputKind: "url-list" | "browser-observation";
  sourcePageUrl?: string;
  candidateCount: number;
  selectedCount: number;
  processedCount: number;
  completedCount: number;
  needsAsrCount: number;
  failedCount: number;
  skipped: Array<{ url: string; title?: string; reason: string }>;
  results: IntakeBilibiliVideoResult[];
  batchIndexRef: string;
};

function defaultConfig(overrides: Partial<BiliSumClientConfig> = {}): BiliSumClientConfig {
  return {
    baseUrl: overrides.baseUrl ?? bilisumBaseUrl,
    accessToken: overrides.accessToken ?? bilisumAccessToken,
    timeoutMs: overrides.timeoutMs ?? bilisumTaskTimeoutMs,
    pollIntervalMs: overrides.pollIntervalMs ?? bilisumPollIntervalMs,
    visualNoteMode: overrides.visualNoteMode ?? bilisumVisualNoteMode
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return undefined;
  }
}

export function extractBilibiliVideoId(url: string): string | null {
  const match = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+|av\d+)/i);
  return match?.[1] ?? null;
}

async function latestNormalizedFile(fileName: string): Promise<string | null> {
  const dir = artifactPath(path.join("data", "normalized"));
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

async function findLatestBilibiliVideoCandidates(): Promise<VideoIntakeCandidate[]> {
  const subscriptions = await readJsonl<SubscriptionItem>(await latestNormalizedFile("subscriptions.jsonl"));
  const hotspots = await readJsonl<HotspotItem>(await latestNormalizedFile("hotspots.jsonl"));
  const seen = new Set<string>();
  const candidates: VideoIntakeCandidate[] = [];

  for (const item of [...subscriptions, ...hotspots]) {
    if (item.platform !== "bilibili") continue;
    const videoId = extractBilibiliVideoId(item.url);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    candidates.push({
      sourceItemId: item.id,
      sourceKind: "rank" in item ? "hotspot" : "subscription",
      title: item.title,
      url: item.url,
      authorId: "authorId" in item ? item.authorId : undefined,
      authorName: "authorName" in item ? item.authorName : undefined,
      publishedAt: "publishedAt" in item ? item.publishedAt : undefined
    });
  }

  return candidates;
}

function asVideoListItems(payload: unknown): { inputKind: "url-list" | "browser-observation"; sourcePageUrl?: string; items: BilibiliVideoListItem[] } {
  const record = asRecord(payload);
  if (!record) throw new Error("Bilibili video list input must be a JSON object.");
  const rawItems = Array.isArray(record.items) ? record.items : [];
  if (record.platform === "bilibili" || record.streamType || record.pageUrl) {
    const observation = record as unknown as BrowserObservation;
    return {
      inputKind: "browser-observation",
      sourcePageUrl: observation.pageUrl,
      items: rawItems
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
        .map((item) => ({
          title: asString(item.title),
          url: asString(item.url),
          authorId: asString(item.authorId) || undefined,
          authorName: asString(item.authorName) || undefined,
          publishedAt: item.publishedAt === null ? null : asString(item.publishedAt) || undefined
        }))
    };
  }
  return {
    inputKind: "url-list",
    sourcePageUrl: asString(record.sourcePageUrl) || undefined,
    items: rawItems
      .filter((item): item is Record<string, unknown> | string => typeof item === "string" || Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item) => typeof item === "string" ? { url: item } : {
        title: asString(item.title),
        url: asString(item.url),
        authorId: asString(item.authorId) || undefined,
        authorName: asString(item.authorName) || undefined,
        publishedAt: item.publishedAt === null ? null : asString(item.publishedAt) || undefined
      })
  };
}

function dedupeVideoItems(items: BilibiliVideoListItem[]): { selected: BilibiliVideoListItem[]; skipped: Array<{ url: string; title?: string; reason: string }> } {
  const seen = new Set<string>();
  const selected: BilibiliVideoListItem[] = [];
  const skipped: Array<{ url: string; title?: string; reason: string }> = [];
  for (const item of items) {
    const videoId = extractBilibiliVideoId(item.url);
    if (!videoId) {
      skipped.push({ url: item.url, title: item.title, reason: "Not a supported Bilibili video URL." });
      continue;
    }
    if (seen.has(videoId)) {
      skipped.push({ url: item.url, title: item.title, reason: "Duplicate Bilibili video." });
      continue;
    }
    seen.add(videoId);
    selected.push(item);
  }
  return { selected, skipped };
}

function segmentFromBiliSum(value: Record<string, unknown>): TranscriptSegment | null {
  const text = asString(value.text).trim();
  if (!text) return null;
  const start = asString(value.start) || asString(value.start_time) || String(value.start ?? "");
  const end = asString(value.end) || asString(value.end_time) || String(value.end ?? "");
  return { start, end, text };
}

function normalizeTranscriptKind(provider: string, fallback: VideoTranscriptKind): VideoTranscriptKind {
  if (provider.includes("ai")) return "ai-subtitle";
  if (provider.includes("yt-dlp")) return "yt-dlp-subtitle";
  if (provider.includes("subtitle")) return "platform-subtitle";
  return fallback;
}

function normalizeTranscriptSource(result: BiliSumTaskResult): NonNullable<VideoProcessingResult["acquisition"]["transcriptSource"]> | undefined {
  const metadata = parseJsonRecord(result.artifacts?.transcript_source_json) ?? parseJsonRecord(result.artifacts?.subtitle_metadata_json);
  const provider = asString(result.artifacts?.transcript_provider) || asString(result.artifacts?.subtitle_provider) || asString(metadata?.provider);
  if (!provider && !metadata) return undefined;
  const lan = asString(metadata?.lan) || undefined;
  const lanDoc = asString(metadata?.lan_doc) || asString(metadata?.lanDoc) || undefined;
  const source = asString(metadata?.source) || undefined;
  const urlHost = asString(metadata?.url_host) || asString(metadata?.urlHost) || undefined;
  return {
    provider: provider || "bilisum",
    source,
    lan,
    lanDoc,
    isAi: typeof metadata?.is_ai === "boolean" ? metadata.is_ai : typeof metadata?.isAi === "boolean" ? metadata.isAi : lan?.includes("ai-") || provider.includes("ai") || undefined,
    urlHost
  };
}

function normalizeLlmDiagnostics(result: BiliSumTaskResult): NonNullable<VideoProcessingResult["acquisition"]["llm"]> {
  const metadata = parseJsonRecord(result.artifacts?.llm_diagnostics_json);
  const promptTokens = asNumber(result.llm_prompt_tokens ?? metadata?.prompt_tokens ?? metadata?.promptTokens);
  const completionTokens = asNumber(result.llm_completion_tokens ?? metadata?.completion_tokens ?? metadata?.completionTokens);
  const totalTokens = asNumber(result.llm_total_tokens ?? metadata?.total_tokens ?? metadata?.totalTokens);
  const enabled = typeof metadata?.enabled === "boolean" ? metadata.enabled : asString(result.artifacts?.llm_enabled) === "true" || Boolean(promptTokens || completionTokens || totalTokens);
  return {
    enabled,
    used: Boolean(promptTokens || completionTokens || totalTokens || metadata?.used === true || asString(result.artifacts?.llm_used) === "true"),
    provider: asString(metadata?.provider) || asString(result.artifacts?.llm_provider) || undefined,
    model: asString(metadata?.model) || asString(result.artifacts?.llm_model) || undefined,
    fallbackReason: asString(metadata?.fallback_reason) || asString(metadata?.fallbackReason) || asString(result.artifacts?.llm_fallback_reason) || undefined,
    promptTokens,
    completionTokens,
    totalTokens
  };
}

function noteQuality(input: {
  transcriptText: string;
  segments: TranscriptSegment[];
  note: string;
  enhancedNote: string;
  result: BiliSumTaskResult;
  visualEvidenceCount: number;
}): NonNullable<VideoProcessingResult["videoNote"]["quality"]> {
  return {
    transcriptChars: input.transcriptText.length,
    segmentCount: input.segments.length,
    noteChars: input.note.length,
    enhancedNoteChars: input.enhancedNote.length,
    timelineCount: Array.isArray(input.result.timeline) ? input.result.timeline.length : 0,
    chapterGroupCount: Array.isArray(input.result.chapter_groups) ? input.result.chapter_groups.length : 0,
    visualEvidenceCount: input.visualEvidenceCount,
    hasLlmTokenUsage: Boolean(input.result.llm_prompt_tokens || input.result.llm_completion_tokens || input.result.llm_total_tokens)
  };
}

function summarizeMindmapNode(node: Record<string, unknown>, depth = 0): string[] {
  const label = asString(node.label).trim();
  const summary = asString(node.summary).trim();
  const time = asNumber(node.time_anchor);
  const prefix = `${"  ".repeat(depth)}-`;
  const line = [label, summary, time === undefined ? "" : `@${Math.round(time)}s`].filter(Boolean).join(" | ");
  const children = Array.isArray(node.children) ? node.children.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
  return [line ? `${prefix} ${line}` : "", ...children.slice(0, depth === 0 ? 8 : 4).flatMap((child) => summarizeMindmapNode(child, depth + 1))].filter(Boolean);
}

function summarizeMindmap(mindmap: unknown): string {
  if (!mindmap || typeof mindmap !== "object" || Array.isArray(mindmap)) return "";
  const payload = mindmap as Record<string, unknown>;
  const nodes = Array.isArray(payload.nodes) ? payload.nodes.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
  const rootId = asString(payload.root);
  const root = nodes.find((node) => asString(node.id) === rootId) ?? nodes[0];
  const title = asString(payload.title).trim();
  return [title ? `Mindmap: ${title}` : "", ...(root ? summarizeMindmapNode(root).slice(0, 36) : [])].filter(Boolean).join("\n");
}

function normalizeVisualEvidence(visual?: BiliSumVisualEvidenceResponse): VideoProcessingResult["visualEvidence"] {
  const context = visual?.context;
  const observations = Array.isArray(context?.observations) ? context.observations : [];
  const frames = new Map<string, Record<string, unknown>>();
  if (Array.isArray(context?.frames)) {
    for (const frame of context.frames) {
      if (frame && typeof frame === "object" && !Array.isArray(frame)) frames.set(asString((frame as Record<string, unknown>).frame_id), frame as Record<string, unknown>);
    }
  }
  return observations
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => {
      const frameId = asString(item.frame_id);
      const frame = frames.get(frameId);
      const timestampSeconds = asNumber(item.timestamp_seconds) ?? asNumber(frame?.timestamp_seconds) ?? 0;
      const imageRef = asString(frame?.image_path) || (frameId ? `frames/${frameId}.jpg` : "");
      return {
        frameId,
        timestamp: asString(frame?.timestamp) || formatSeconds(timestampSeconds),
        timestampSeconds,
        imageRef,
        analysisImageRef: asString(frame?.analysis_image_path) || undefined,
        caption: asString(item.caption) || undefined,
        ocrText: asString(item.ocr_text) || undefined,
        keyFacts: asStringArray(item.key_facts),
        semanticSummary: asString(item.semantic_summary) || undefined,
        importance: asNumber(item.importance),
        shouldInsert: typeof item.should_insert === "boolean" ? item.should_insert : undefined,
        source: "bilisum-visual-context" as const
      };
    })
    .filter((item) => item.frameId || item.imageRef);
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function artifact(kind: VideoProcessingResult["artifacts"][number]["kind"], ref: string | undefined | null): VideoProcessingResult["artifacts"][number] | null {
  return ref ? { kind, ref } : null;
}

function artifactsFrom(task: BiliSumTaskDetail | undefined, result: BiliSumTaskResult | undefined, mindmap: BiliSumMindmapResponse | undefined, visual: BiliSumVisualEvidenceResponse | undefined): VideoProcessingResult["artifacts"] {
  const rows = [
    artifact("task-result", task?.task_id ? `bilisum:task:${task.task_id}` : undefined),
    artifact("video-note", result?.artifacts?.summary_path ?? result?.artifacts?.knowledge_note_path),
    artifact("enhanced-video-note", result?.visual_enhanced_note_artifact_path ?? result?.artifacts?.visual_enhanced_note_path),
    artifact("mindmap", result?.mindmap_artifact_path ?? result?.artifacts?.mindmap_path ?? (mindmap?.status ? `bilisum:mindmap:${mindmap.status}` : undefined)),
    artifact("visual-context", result?.artifacts?.visual_context_path ?? asString(visual?.context?.visual_context_path)),
    artifact("frame-index", result?.artifacts?.visual_frame_index_path ?? asString(visual?.context?.frame_index_path)),
    artifact("visual-keyframe-plan", asString(visual?.context?.visual_keyframe_plan_path)),
    artifact("visual-insert-plan", result?.artifacts?.visual_insert_plan_path ?? asString(visual?.context?.visual_insert_plan_path))
  ].filter((item): item is VideoProcessingResult["artifacts"][number] => Boolean(item));

  for (const evidence of normalizeVisualEvidence(visual)) {
    rows.push({ kind: "screenshot", ref: evidence.imageRef });
  }
  return rows;
}

function buildVideoResult(input: {
  candidate: VideoIntakeCandidate;
  videoId: string | null;
  task: BiliSumTaskDetail;
  mindmap?: BiliSumMindmapResponse;
  visual?: BiliSumVisualEvidenceResponse;
  warnings: string[];
}): VideoProcessingResult {
  const result = input.task.result ?? {};
  const bilisumSegments = Array.isArray(result.segments)
    ? result.segments.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map(segmentFromBiliSum).filter((item): item is TranscriptSegment => Boolean(item))
    : [];
  const transcriptText = asString(result.transcript_text).trim();
  const transcriptProvider = asString(result.artifacts?.transcript_provider) || asString(result.artifacts?.subtitle_provider) || "bilisum";
  const transcriptSource = normalizeTranscriptSource(result);
  const transcriptKind = normalizeTranscriptKind([transcriptProvider, transcriptSource?.lan, transcriptSource?.source].filter(Boolean).join(" "), transcriptText ? "platform-subtitle" : "missing");
  const llm = normalizeLlmDiagnostics(result);
  const visualEvidence = normalizeVisualEvidence(input.visual);
  const enhanced = asString(input.visual?.enhanced_note_markdown).trim();
  const visualNote = asString(input.visual?.visual_note_markdown).trim();
  const knowledgeNote = asString(result.knowledge_note_markdown).trim();
  const selectedNote = visualNote || knowledgeNote;
  const mindmapSummary = summarizeMindmap(input.mindmap?.mindmap);
  return {
    status: input.task.status === "completed" && transcriptText ? "completed" : "failed",
    source: {
      platform: "bilibili",
      url: input.candidate.url,
      videoId: input.videoId ?? undefined,
      title: input.candidate.title || asString(input.task.title) || "Bilibili video",
      authorId: input.candidate.authorId,
      authorName: input.candidate.authorName,
      publishedAt: input.candidate.publishedAt
    },
    acquisition: {
      transcriptKind,
      provider: transcriptProvider,
      transcriptSource,
      llm,
      usedAsr: transcriptKind === "asr-transcript",
      warnings: input.warnings
    },
    transcript: { text: transcriptText, segments: bilisumSegments },
    videoNote: {
      markdown: selectedNote,
      enhancedMarkdown: enhanced || undefined,
      quality: noteQuality({ transcriptText, segments: bilisumSegments, note: selectedNote, enhancedNote: enhanced, result, visualEvidenceCount: visualEvidence.length })
    },
    mindmap: input.mindmap ? { status: input.mindmap.status, json: input.mindmap.mindmap, textSummary: mindmapSummary || undefined } : undefined,
    visualEvidence,
    artifacts: artifactsFrom(input.task, result, input.mindmap, input.visual)
  };
}

function transcriptExcerpt(segments: TranscriptSegment[], text: string): string {
  if (segments.length) {
    return segments
      .slice(0, 18)
      .map((segment) => `[${segment.start}-${segment.end}] ${segment.text}`)
      .join("\n");
  }
  return text.slice(0, 2400);
}

export function formatVideoProcessingContent(result: VideoProcessingResult): string {
  const visualLines = result.visualEvidence.slice(0, 12).map((item) =>
    [
      `[${item.timestamp}] ${item.caption ?? item.semanticSummary ?? item.frameId}`,
      item.ocrText ? `- OCR: ${item.ocrText}` : "",
      item.keyFacts?.length ? `- Key facts: ${item.keyFacts.join("; ")}` : "",
      item.imageRef ? `- Image: ${item.imageRef}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  );
  return [
    "# Bilibili Video Processing Package",
    "",
    `Title: ${result.source.title}`,
    `Author: ${result.source.authorName ?? result.source.authorId ?? ""}`,
    `URL: ${result.source.url}`,
    `Transcript source: ${result.acquisition.transcriptKind} / ${result.acquisition.provider}`,
    result.acquisition.transcriptSource ? `Transcript metadata: ${JSON.stringify(result.acquisition.transcriptSource)}` : "",
    result.acquisition.llm ? `LLM: enabled=${result.acquisition.llm.enabled ? "yes" : "no"} used=${result.acquisition.llm.used ? "yes" : "no"} model=${result.acquisition.llm.model ?? ""}${result.acquisition.llm.fallbackReason ? ` fallback=${result.acquisition.llm.fallbackReason}` : ""}` : "",
    `ASR used: ${result.acquisition.usedAsr ? "yes" : "no"}`,
    result.videoNote.quality ? `Quality: transcriptChars=${result.videoNote.quality.transcriptChars}; noteChars=${result.videoNote.quality.noteChars}; timeline=${result.videoNote.quality.timelineCount}; visuals=${result.videoNote.quality.visualEvidenceCount}` : "",
    result.acquisition.warnings.length ? `Warnings: ${result.acquisition.warnings.join(" | ")}` : "",
    "",
    "## Enhanced Video Note",
    "",
    result.videoNote.enhancedMarkdown ?? "",
    "",
    "## Knowledge Note",
    "",
    result.videoNote.markdown,
    "",
    "## Mindmap Summary",
    "",
    result.mindmap?.textSummary ?? "",
    "",
    "## Visual Evidence",
    "",
    visualLines.join("\n\n"),
    "",
    "## Transcript Excerpt",
    "",
    transcriptExcerpt(result.transcript.segments, result.transcript.text)
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function mapVideoProcessingResultToSourceItem(result: VideoProcessingResult, input: { sourceKind: MaterialHubSourceKind; rawRef: string; normalizedRef?: string }): MaterialHubSourceItem {
  const dedupeKey = `bilibili-video-intake:${result.source.videoId ?? sha1(result.source.url).slice(0, 16)}`;
  return {
    id: `src-video-${sha1(dedupeKey).slice(0, 12)}`,
    sourceKind: input.sourceKind,
    platform: "bilibili",
    provider: "bilisum-video-intake",
    title: result.source.title,
    url: result.source.url,
    authorId: result.source.authorId,
    authorName: result.source.authorName,
    publishedAt: result.source.publishedAt,
    capturedAt: nowIso(),
    summary: `BiliSum video package: ${result.acquisition.transcriptKind}; note=${Boolean(result.videoNote.markdown || result.videoNote.enhancedMarkdown)}; mindmap=${result.mindmap?.status ?? "missing"}; visuals=${result.visualEvidence.length}.`,
    contentText: formatVideoProcessingContent(result),
    rawRef: input.rawRef,
    normalizedRef: input.normalizedRef,
    dedupeKey
  };
}

async function appendMaterialSourceItem(day: string, item: MaterialHubSourceItem): Promise<string> {
  const abs = hubDayPath("00-source-items", day, "source-items.jsonl");
  await mkdir(path.dirname(abs), { recursive: true });
  const existing = new Map<string, MaterialHubSourceItem>();
  try {
    const text = await readFile(abs, "utf8");
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line) as MaterialHubSourceItem;
      if (row.dedupeKey) existing.set(row.dedupeKey, row);
    }
  } catch {
    // First write creates the file.
  }
  existing.set(item.dedupeKey, { ...item, normalizedRef: normalizeRelPath(path.relative(materialHubRoot, abs)) });
  await writeFile(abs, `${[...existing.values()].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  return `material-hub-workspace/${normalizeRelPath(path.relative(materialHubRoot, abs))}`;
}

async function writeVideoProcessingResult(day: string, result: VideoProcessingResult): Promise<string> {
  const rel = path.join("data", "video-intake", day, `bilibili-${sha1(`${result.source.url}:${nowIso()}`).slice(0, 12)}.json`);
  const abs = artifactPath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(result, null, 2), "utf8");
  return normalizeRelPath(rel);
}

async function writeLearningPackageManifest(day: string, result: VideoProcessingResult, taskId: string | undefined, videoResultRef: string): Promise<{ learningPackageRef: string; openableRefs: string[] }> {
  const directArtifacts = result.artifacts
    .map((item) => item.ref)
    .filter((ref) => !ref.startsWith("bilisum:") && path.isAbsolute(ref));
  const taskRoot = directArtifacts.length ? directArtifacts.map((ref) => ref.includes(`${path.sep}visual_evidence${path.sep}`) ? path.dirname(path.dirname(ref)) : path.dirname(ref)).find((candidate) => candidate.includes(`${path.sep}tasks${path.sep}`)) : undefined;
  const expectedArtifacts = taskRoot ? [
    path.join(taskRoot, "transcript.txt"),
    path.join(taskRoot, "knowledge_note.md"),
    path.join(taskRoot, "mindmap.json"),
    path.join(taskRoot, "visual_evidence", "visual_note.md"),
    path.join(taskRoot, "visual_evidence", "visual_enhanced_note.md"),
    path.join(taskRoot, "visual_evidence", "visual_context.json"),
    path.join(taskRoot, "visual_evidence", "frame_index.json"),
    path.join(taskRoot, "visual_evidence", "visual_keyframe_plan.json"),
    path.join(taskRoot, "visual_evidence", "visual_insert_plan.json")
  ] : [];
  const existingExpected: string[] = [];
  for (const artifactPath of expectedArtifacts) {
    try {
      await access(artifactPath);
      existingExpected.push(artifactPath);
    } catch {
      // Optional BiliSum artifacts may be absent on partial runs.
    }
  }
  let visualContext: Record<string, unknown> | undefined;
  const visualContextPath = existingExpected.find((ref) => path.basename(ref) === "visual_context.json");
  if (visualContextPath) {
    try {
      visualContext = asRecord(JSON.parse(await readFile(visualContextPath, "utf8")));
    } catch {
      visualContext = undefined;
    }
  }
  const visualWarnings = asStringArray(visualContext?.warnings);
  let plannedVisualFrameCount = 0;
  {
    const planPath = existingExpected.find((ref) => path.basename(ref) === "visual_keyframe_plan.json");
    if (planPath) {
      try {
        const plan = JSON.parse(await readFile(planPath, "utf8")) as Record<string, unknown>;
        plannedVisualFrameCount = Array.isArray(plan.keyframes) ? plan.keyframes.length : 0;
      } catch {
        plannedVisualFrameCount = 0;
      }
    }
  }
  const openableRefs = [...new Set([path.resolve(videoResultRef), ...existingExpected, ...directArtifacts])];
  const rel = path.join("data", "video-notes", day, `bilibili-${result.source.videoId ?? sha1(result.source.url).slice(0, 12)}-learning-package.json`);
  const abs = artifactPath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify({
    generatedAt: nowIso(),
    mode: "bilisum-video-notes",
    writesToMaterialHub: false,
    taskId,
    source: result.source,
    status: result.status,
    transcriptKind: result.acquisition.transcriptKind,
    transcriptSource: result.acquisition.transcriptSource,
    llm: result.acquisition.llm,
    noteQuality: result.videoNote.quality,
    mindmapStatus: result.mindmap?.status ?? "missing",
    visualEvidenceStatus: asString(visualContext?.status) || (result.visualEvidence.length ? "ready" : "missing"),
    visualEvidenceCount: result.visualEvidence.length,
    plannedVisualFrameCount,
    visualWarnings,
    videoResultRef: path.resolve(videoResultRef),
    openableRefs
  }, null, 2), "utf8");
  return { learningPackageRef: normalizeRelPath(rel), openableRefs: [abs, ...openableRefs] };
}

export async function intakeBilibiliVideo(options: IntakeBilibiliVideoOptions): Promise<IntakeBilibiliVideoResult> {
  const day = options.day ?? dateFolder();
  const candidate: VideoIntakeCandidate = {
    sourceKind: options.sourceKind ?? "temporary-link",
    url: options.url,
    title: options.title ?? options.url,
    authorId: options.authorId,
    authorName: options.authorName,
    publishedAt: options.publishedAt
  };
  const videoId = extractBilibiliVideoId(options.url);
  if (!videoId) throw new Error(`Not a Bilibili video URL: ${options.url}`);

  const warnings: string[] = [];
  let processing: VideoProcessingResult;
  let taskId: string | undefined;

  const client = options.client ?? new BiliSumClient(defaultConfig(options.config));
  const created = await client.createBilibiliUrlTask({ url: candidate.url, title: candidate.title, visualNoteMode: options.config?.visualNoteMode });
  taskId = created.task_id;
  const task = await client.waitForTask(created.task_id);
  if (task.status !== "completed") {
    warnings.push(task.error_message ?? `BiliSum task ended with status ${task.status}.`);
    processing = {
      status: "failed",
      source: {
        platform: "bilibili",
        url: candidate.url,
        videoId: videoId ?? undefined,
        title: candidate.title,
        authorId: candidate.authorId,
        authorName: candidate.authorName,
        publishedAt: candidate.publishedAt
      },
      acquisition: { transcriptKind: "missing", provider: "bilisum", usedAsr: false, warnings },
      transcript: { text: "", segments: [] },
      videoNote: { markdown: "" },
      visualEvidence: [],
      artifacts: artifactsFrom(task, task.result ?? undefined, undefined, undefined)
    };
  } else {
    let mindmap: BiliSumMindmapResponse | undefined;
    let visual: BiliSumVisualEvidenceResponse | undefined;
    try {
      mindmap = await client.generateMindmap(task.task_id);
      mindmap = await client.waitForMindmap(task.task_id, mindmap);
    } catch (error) {
      warnings.push(`Mindmap unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      visual = await client.generateVisualEvidence(task.task_id, options.config?.visualNoteMode);
      visual = await client.waitForVisualEvidence(task.task_id, visual);
    } catch (error) {
      warnings.push(`Visual evidence unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    processing = buildVideoResult({ candidate, videoId, task, mindmap, visual, warnings });
  }

  const videoResultRef = await writeVideoProcessingResult(day, processing);
  const learningPackage = await writeLearningPackageManifest(day, processing, taskId, videoResultRef);
  let sourceItem: MaterialHubSourceItem | undefined;
  let sourceItemRef: string | undefined;
  if (processing.status === "completed" && options.publishToMaterialHub !== false) {
    sourceItem = mapVideoProcessingResultToSourceItem(processing, { sourceKind: candidate.sourceKind, rawRef: videoResultRef });
    sourceItemRef = await appendMaterialSourceItem(day, sourceItem);
  }

  await appendJsonlUnique(path.join("data", "normalized", day, "video-processing-results.jsonl"), [{ ...processing, dedupeKey: `video-processing:${processing.source.videoId ?? processing.source.url}` }]);

  return {
    day,
    status: processing.status,
    videoResultRef,
    sourceItemRef,
    sourceItem,
    bilisumTaskId: taskId,
    warnings,
    ...learningPackage
  };
}

export async function intakeLatestBilibiliVideos(
  options: { limit?: number; day?: string; client?: BiliSumClient; config?: Partial<BiliSumClientConfig> } = {}
): Promise<IntakeLatestBilibiliVideosResult> {
  const candidates = await findLatestBilibiliVideoCandidates();
  const selected = candidates.slice(0, options.limit ?? 5);
  const results: IntakeBilibiliVideoResult[] = [];
  for (const candidate of selected) {
    results.push(
      await intakeBilibiliVideo({
        url: candidate.url,
        title: candidate.title,
        sourceKind: "subscription",
        day: options.day,
        client: options.client,
        config: options.config
      })
    );
  }
  return {
    processedCount: results.length,
    completedCount: results.filter((item) => item.status === "completed").length,
    needsAsrCount: results.filter((item) => item.status === "needs_asr").length,
    failedCount: results.filter((item) => item.status === "failed").length,
    results
  };
}

export async function intakeBilibiliVideoList(options: IntakeBilibiliVideoListOptions): Promise<IntakeBilibiliVideoListResult> {
  const day = options.day ?? dateFolder();
  const payload = JSON.parse(await readFile(options.inputPath, "utf8")) as unknown;
  const parsed = asVideoListItems(payload);
  const { selected, skipped } = dedupeVideoItems(parsed.items);
  const limited = selected.slice(0, options.limit ?? 10);
  const overflow = selected.slice(limited.length).map((item) => ({ url: item.url, title: item.title, reason: "Skipped by batch limit." }));
  const results: IntakeBilibiliVideoResult[] = [];
  for (const item of limited) {
    results.push(await intakeBilibiliVideo({
      url: item.url,
      title: item.title,
      authorId: item.authorId,
      authorName: item.authorName,
      publishedAt: item.publishedAt,
      sourceKind: "temporary-link",
      day,
      client: options.client,
      config: options.config,
      publishToMaterialHub: options.publishToMaterialHub ?? false
    }));
  }
  const rel = path.join("data", "video-notes", day, `bilibili-batch-${sha1(`${options.inputPath}:${nowIso()}`).slice(0, 12)}-learning-package-index.json`);
  const abs = artifactPath(rel);
  const result: IntakeBilibiliVideoListResult = {
    day,
    inputPath: path.resolve(options.inputPath),
    inputKind: parsed.inputKind,
    sourcePageUrl: parsed.sourcePageUrl,
    candidateCount: parsed.items.length,
    selectedCount: limited.length,
    processedCount: results.length,
    completedCount: results.filter((item) => item.status === "completed").length,
    needsAsrCount: results.filter((item) => item.status === "needs_asr").length,
    failedCount: results.filter((item) => item.status === "failed").length,
    skipped: [...skipped, ...overflow],
    results,
    batchIndexRef: normalizeRelPath(rel)
  };
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(result, null, 2), "utf8");
  return result;
}
