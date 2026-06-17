import type { MaterialHubSourceKind } from "../material-hub/types.js";
import type { TranscriptSegment } from "../types.js";

export type VideoProcessingStatus = "completed" | "needs_asr" | "failed";

export type VideoTranscriptKind = "ai-subtitle" | "platform-subtitle" | "yt-dlp-subtitle" | "asr-transcript" | "missing";

export type VideoIntakeCandidate = {
  sourceItemId?: string;
  sourceKind: MaterialHubSourceKind;
  url: string;
  title: string;
  authorId?: string;
  authorName?: string;
  publishedAt?: string | null;
};

export type VideoProcessingResult = {
  status: VideoProcessingStatus;
  source: {
    platform: "bilibili";
    url: string;
    videoId?: string;
    title: string;
    authorId?: string;
    authorName?: string;
    publishedAt?: string | null;
  };
  acquisition: {
    transcriptKind: VideoTranscriptKind;
    provider: string;
    transcriptSource?: {
      provider: string;
      source?: string;
      lan?: string;
      lanDoc?: string;
      isAi?: boolean;
      urlHost?: string;
    };
    llm?: {
      enabled: boolean;
      used: boolean;
      provider?: string;
      model?: string;
      fallbackReason?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    usedAsr: boolean;
    warnings: string[];
  };
  transcript: {
    text: string;
    segments: TranscriptSegment[];
  };
  videoNote: {
    markdown: string;
    enhancedMarkdown?: string;
    primaryMode?: string;
    variants?: Array<{
      id: string;
      label: string;
      status: string;
      markdown?: string;
      artifactPath?: string | null;
      structuredArtifactPath?: string | null;
      contentType?: string;
      errorMessage?: string | null;
      quality?: Record<string, unknown>;
    }>;
    quality?: {
      transcriptChars: number;
      segmentCount: number;
      noteChars: number;
      enhancedNoteChars: number;
      timelineCount: number;
      chapterGroupCount: number;
      visualEvidenceCount: number;
      hasLlmTokenUsage: boolean;
    };
  };
  mindmap?: {
    status: string;
    json?: unknown;
    textSummary?: string;
  };
  visualEvidence: Array<{
    frameId: string;
    timestamp: string;
    timestampSeconds: number;
    imageRef: string;
    analysisImageRef?: string;
    caption?: string;
    ocrText?: string;
    keyFacts?: string[];
    semanticSummary?: string;
    importance?: number;
    shouldInsert?: boolean;
    source: "bilisum-visual-context";
  }>;
  artifacts: Array<{
    kind:
      | "task-result"
      | "transcript"
      | "video-note"
      | "note-variant"
      | "note-variant-json"
      | "enhanced-video-note"
      | "mindmap"
      | "visual-context"
      | "frame-index"
      | "visual-keyframe-plan"
      | "visual-insert-plan"
      | "screenshot";
    ref: string;
  }>;
};

export type BiliSumClientConfig = {
  baseUrl: string;
  accessToken?: string;
  timeoutMs: number;
  pollIntervalMs: number;
  visualNoteMode: string;
};
