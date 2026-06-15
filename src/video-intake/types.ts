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
