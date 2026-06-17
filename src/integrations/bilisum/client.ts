import type { BiliSumClientConfig } from "../../video-notes/types.js";

export type BiliSumTaskDetail = {
  task_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
  title?: string | null;
  source?: string;
  result?: BiliSumTaskResult | null;
  error_message?: string | null;
};

export type BiliSumTaskResult = {
  overview?: string;
  knowledge_note_markdown?: string;
  note_variants?: BiliSumNoteVariant[];
  primary_note_mode?: string;
  transcript_text?: string;
  segments?: Array<Record<string, unknown>>;
  segment_summaries?: string[];
  key_points?: string[];
  timeline?: Array<Record<string, unknown>>;
  chapter_groups?: Array<Record<string, unknown>>;
  artifacts?: Record<string, string>;
  llm_prompt_tokens?: number | null;
  llm_completion_tokens?: number | null;
  llm_total_tokens?: number | null;
  mindmap_status?: string;
  mindmap_artifact_path?: string | null;
  visual_note_status?: string;
  visual_note_artifact_path?: string | null;
  visual_enhanced_note_artifact_path?: string | null;
  visual_frame_count?: number;
  visual_insert_count?: number;
};

export type BiliSumNoteVariant = {
  id: string;
  label: string;
  status: string;
  markdown?: string;
  artifact_path?: string | null;
  structured_artifact_path?: string | null;
  content_type?: string;
  structured?: Record<string, unknown> | null;
  error_message?: string | null;
  quality?: Record<string, unknown>;
};

export type BiliSumMindmapResponse = {
  task_id: string;
  status: string;
  error_message?: string | null;
  mindmap?: unknown;
};

export type BiliSumVisualEvidenceResponse = {
  task_id: string;
  mode?: string;
  status: string;
  error_message?: string | null;
  frame_count?: number;
  insert_count?: number;
  visual_note_markdown?: string;
  enhanced_note_markdown?: string;
  context?: Record<string, unknown> | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class BiliSumClient {
  constructor(private readonly config: BiliSumClientConfig) {}

  async createBilibiliUrlTask(input: { url: string; title?: string; visualNoteMode?: string; noteModes?: string[]; primaryNoteMode?: string }): Promise<BiliSumTaskDetail> {
    return this.requestJson<BiliSumTaskDetail>("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        input_type: "url",
        source: input.url,
        title: input.title,
        platform_hint: "bilibili",
        options: {
          language: "zh",
          summary_mode: "auto",
          prefer_subtitles: true,
          visual_note_mode: input.visualNoteMode ?? this.config.visualNoteMode,
          note_modes: input.noteModes?.length ? input.noteModes : undefined,
          primary_note_mode: input.primaryNoteMode,
          export_formats: ["md", "json"]
        }
      })
    });
  }

  async getTask(taskId: string): Promise<BiliSumTaskDetail> {
    return this.requestJson<BiliSumTaskDetail>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  async waitForTask(taskId: string): Promise<BiliSumTaskDetail> {
    const started = Date.now();
    while (Date.now() - started <= this.config.timeoutMs) {
      const detail = await this.getTask(taskId);
      if (detail.status === "completed" || detail.status === "failed" || detail.status === "cancelled") return detail;
      await sleep(this.config.pollIntervalMs);
    }
    throw new Error(`BiliSum task timed out after ${this.config.timeoutMs}ms: ${taskId}`);
  }

  async generateMindmap(taskId: string): Promise<BiliSumMindmapResponse> {
    return this.requestJson<BiliSumMindmapResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}/mindmap`, { method: "POST" });
  }

  async getMindmap(taskId: string): Promise<BiliSumMindmapResponse> {
    return this.requestJson<BiliSumMindmapResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}/mindmap`);
  }

  async waitForMindmap(taskId: string, initial?: BiliSumMindmapResponse): Promise<BiliSumMindmapResponse> {
    return this.waitForGeneratedArtifact(initial ?? await this.getMindmap(taskId), () => this.getMindmap(taskId), `mindmap:${taskId}`);
  }

  async generateVisualEvidence(taskId: string, mode = this.config.visualNoteMode): Promise<BiliSumVisualEvidenceResponse> {
    return this.requestJson<BiliSumVisualEvidenceResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}/visual-evidence?mode=${encodeURIComponent(mode)}`, {
      method: "POST"
    });
  }

  async getVisualEvidence(taskId: string): Promise<BiliSumVisualEvidenceResponse> {
    return this.requestJson<BiliSumVisualEvidenceResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}/visual-evidence`);
  }

  async waitForVisualEvidence(taskId: string, initial?: BiliSumVisualEvidenceResponse): Promise<BiliSumVisualEvidenceResponse> {
    return this.waitForGeneratedArtifact(initial ?? await this.getVisualEvidence(taskId), () => this.getVisualEvidence(taskId), `visual-evidence:${taskId}`);
  }

  private async waitForGeneratedArtifact<T extends { status: string }>(initial: T, get: () => Promise<T>, label: string): Promise<T> {
    let value = initial;
    const started = Date.now();
    while (value.status === "generating" || value.status === "idle") {
      if (Date.now() - started > this.config.timeoutMs) throw new Error(`BiliSum artifact timed out after ${this.config.timeoutMs}ms: ${label}`);
      await sleep(this.config.pollIntervalMs);
      value = await get();
    }
    return value;
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined)
    };
    if (this.config.accessToken) headers.Authorization = `Bearer ${this.config.accessToken}`;
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`BiliSum HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
      }
      const value = await response.json();
      if (!isRecord(value)) throw new Error(`BiliSum returned non-object JSON for ${path}`);
      return value as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
