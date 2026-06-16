import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  extractBilibiliVideoId,
  formatVideoProcessingContent,
  intakeBilibiliVideo,
  intakeBilibiliVideoList,
  mapVideoProcessingResultToSourceItem
} from "../../src/video-notes/bilibili.js";
import {
  BiliSumClient,
  type BiliSumMindmapResponse,
  type BiliSumTaskDetail,
  type BiliSumVisualEvidenceResponse
} from "../../src/integrations/bilisum/client.js";
import type { VideoProcessingResult } from "../../src/video-notes/types.js";

async function tempWorkdir(name: string): Promise<string> {
  const dir = path.join(tmpdir(), `hotspot-video-intake-${name}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

class FakeBiliSumClient extends BiliSumClient {
  constructor() {
    super({ baseUrl: "http://127.0.0.1:3838", timeoutMs: 1000, pollIntervalMs: 1, visualNoteMode: "frame_insert" });
  }

  override async createBilibiliUrlTask(): Promise<BiliSumTaskDetail> {
    return { task_id: "task-1", status: "queued" };
  }

  override async waitForTask(): Promise<BiliSumTaskDetail> {
    return {
      task_id: "task-1",
      status: "completed",
      title: "AI toolchain video",
      result: {
        knowledge_note_markdown: "## Knowledge Note\nThe author explains collection, organization, and card generation.",
        transcript_text: "This is a video about an AI toolchain.\nThe author shows the path from source material to cards.",
        segments: [{ start: "00:00:01", end: "00:00:03", text: "This is a video about an AI toolchain." }],
        timeline: [{ title: "Opening", start: 1, summary: "The author frames the workflow." }],
        chapter_groups: [{ title: "Workflow", start: 1, summary: "Collection to cards.", children: [] }],
        llm_prompt_tokens: 123,
        llm_completion_tokens: 456,
        llm_total_tokens: 579,
        artifacts: {
          summary_path: "tasks/task-1/summary.json",
          visual_context_path: "tasks/task-1/visual_context.json",
          transcript_source_json: JSON.stringify({ provider: "bilibili-subtitle", source: "dm_view", lan: "ai-zh", lan_doc: "AI Chinese", is_ai: true, url_host: "i0.hdslb.com" }),
          llm_diagnostics_json: JSON.stringify({ enabled: true, used: true, provider: "openai-compatible", model: "deepseek-test" })
        }
      }
    };
  }

  override async generateMindmap(): Promise<BiliSumMindmapResponse> {
    return {
      task_id: "task-1",
      status: "ready",
      mindmap: {
        title: "AI toolchain video",
        root: "root",
        nodes: [
          {
            id: "root",
            label: "Material processing hub",
            type: "root",
            summary: "Connects collection, organization, and card generation.",
            children: [{ id: "leaf-1", label: "Card generation", type: "leaf", summary: "Outputs readable material cards.", children: [], time_anchor: 4 }]
          }
        ]
      }
    };
  }

  override async generateVisualEvidence(): Promise<BiliSumVisualEvidenceResponse> {
    return {
      task_id: "task-1",
      status: "ready",
      visual_note_markdown: "## Visual Note\nThe video shows the tool UI.",
      enhanced_note_markdown: "## Enhanced Note\nThe author demonstrates the route from material to cards.",
      context: {
        frame_index_path: "frame_index.json",
        visual_insert_plan_path: "visual_insert_plan.json",
        frames: [{ frame_id: "f0001", timestamp_seconds: 4, timestamp: "00:04", image_path: "frames/f0001.jpg" }],
        observations: [
          {
            frame_id: "f0001",
            timestamp_seconds: 4,
            caption: "Tool UI screenshot",
            ocr_text: "Material Card",
            key_facts: ["The UI shows Material Card"],
            semantic_summary: "The frame shows a material-card generation interface.",
            importance: 4,
            should_insert: true
          }
        ],
        warnings: []
      }
    };
  }
}

class UnsupportedVisualBiliSumClient extends FakeBiliSumClient {
  override async waitForTask(): Promise<BiliSumTaskDetail> {
    const taskRoot = path.join(process.cwd(), "data", "bilisum", "data", "tasks", "task-unsupported");
    const visualRoot = path.join(taskRoot, "visual_evidence");
    await mkdir(visualRoot, { recursive: true });
    await writeFile(path.join(taskRoot, "transcript.txt"), "transcript", "utf8");
    await writeFile(path.join(taskRoot, "knowledge_note.md"), "knowledge note", "utf8");
    await writeFile(path.join(visualRoot, "visual_context.json"), JSON.stringify({
      status: "unsupported",
      frame_count: 0,
      warnings: ["video download failed"],
      frame_index_path: "frame_index.json",
      visual_keyframe_plan_path: "visual_keyframe_plan.json"
    }), "utf8");
    await writeFile(path.join(visualRoot, "visual_keyframe_plan.json"), JSON.stringify({ keyframes: [{ timestamp_seconds: 1 }, { timestamp_seconds: 2 }] }), "utf8");
    return {
      task_id: "task-unsupported",
      status: "completed",
      title: "Unsupported visual video",
      result: {
        knowledge_note_markdown: "knowledge note",
        transcript_text: "transcript",
        segments: [{ start: "00:00:01", end: "00:00:02", text: "transcript" }],
        artifacts: { summary_path: path.join(taskRoot, "summary.json"), visual_context_path: path.join(visualRoot, "visual_context.json") }
      }
    };
  }

  override async generateVisualEvidence(): Promise<BiliSumVisualEvidenceResponse> {
    return {
      task_id: "task-unsupported",
      status: "unsupported",
      context: {
        status: "unsupported",
        warnings: ["video download failed"],
        visual_keyframe_plan_path: "visual_keyframe_plan.json",
        frames: [],
        observations: []
      }
    };
  }
}

describe("BiliSum Bilibili video intake", () => {
  it("extracts Bilibili video ids from video URLs", () => {
    expect(extractBilibiliVideoId("https://www.bilibili.com/video/BV1Fa4y1273F/?spm_id_from=333")).toBe("BV1Fa4y1273F");
    expect(extractBilibiliVideoId("https://www.bilibili.com/video/av123456")).toBe("av123456");
    expect(extractBilibiliVideoId("https://t.bilibili.com/123")).toBeNull();
  });

  it("normalizes BiliSum notes, mindmap, and visual evidence into a material source item", async () => {
    const root = await tempWorkdir("ok");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "AI toolchain video",
        client: new FakeBiliSumClient(),
        day: "2026-06-13"
      });

      expect(result.status).toBe("completed");
      expect(result.bilisumTaskId).toBe("task-1");
      expect(result.sourceItem?.provider).toBe("bilisum-video-intake");
      expect(result.sourceItem?.contentText).toContain("Enhanced Video Note");
      expect(result.sourceItem?.contentText).toContain("Material Card");
      expect(result.sourceItemRef).toContain("source-items.jsonl");
      expect(result.learningPackageRef).toContain("learning-package.json");
      expect(result.openableRefs.length).toBeGreaterThan(0);

      const saved = JSON.parse(await readFile(path.join(root, "data", "video-intake", "2026-06-13", path.basename(result.videoResultRef)), "utf8")) as VideoProcessingResult;
      expect(saved.visualEvidence[0]?.frameId).toBe("f0001");
      expect(saved.mindmap?.textSummary).toContain("Material processing hub");
      expect(saved.acquisition.transcriptKind).toBe("ai-subtitle");
      expect(saved.acquisition.transcriptSource?.lan).toBe("ai-zh");
      expect(saved.acquisition.llm?.used).toBe(true);
      expect(saved.videoNote.quality?.timelineCount).toBe(1);
    } finally {
      process.chdir(previous);
    }
  });

  it("supports standalone BiliSum notes without publishing to the material hub", async () => {
    const root = await tempWorkdir("notes-only");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "Standalone notes",
        client: new FakeBiliSumClient(),
        day: "2026-06-13",
        publishToMaterialHub: false
      });

      expect(result.status).toBe("completed");
      expect(result.sourceItem).toBeUndefined();
      expect(result.sourceItemRef).toBeUndefined();
      const manifest = await readFile(path.join(root, result.learningPackageRef), "utf8");
      expect(manifest).toContain('"writesToMaterialHub": false');
      expect(manifest).toContain('"transcriptSource"');
      expect(manifest).toContain('"noteQuality"');
    } finally {
      process.chdir(previous);
    }
  });

  it("keeps unsupported visual evidence status separate from planned keyframes", async () => {
    const root = await tempWorkdir("unsupported-visual");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "Unsupported visual",
        client: new UnsupportedVisualBiliSumClient(),
        day: "2026-06-13",
        publishToMaterialHub: false
      });
      const manifest = JSON.parse(await readFile(path.join(root, result.learningPackageRef), "utf8")) as Record<string, unknown>;

      expect(manifest.visualEvidenceStatus).toBe("unsupported");
      expect(manifest.visualEvidenceCount).toBe(0);
      expect(manifest.plannedVisualFrameCount).toBe(2);
      expect(manifest.visualWarnings).toContain("video download failed");
      expect(String(manifest.openableRefs)).toContain("visual_keyframe_plan.json");
    } finally {
      process.chdir(previous);
    }
  });

  it("returns failed when BiliSum cannot complete the task", async () => {
    class FailedBiliSumClient extends FakeBiliSumClient {
      override async waitForTask(): Promise<BiliSumTaskDetail> {
        return { task_id: "task-failed", status: "failed", error_message: "transcript unavailable" };
      }
    }

    const root = await tempWorkdir("failed-task");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "Failed task",
        client: new FailedBiliSumClient(),
        day: "2026-06-13"
      });

      expect(result.status).toBe("failed");
      expect(result.warnings).toContain("transcript unavailable");
      expect(result.sourceItem).toBeUndefined();
    } finally {
      process.chdir(previous);
    }
  });

  it("formats video processing content with note-first evidence order", () => {
    const source = mapVideoProcessingResultToSourceItem(
      {
        status: "completed",
        source: { platform: "bilibili", url: "https://www.bilibili.com/video/BV123", videoId: "BV123", title: "Video" },
        acquisition: { transcriptKind: "ai-subtitle", provider: "bilisum", usedAsr: false, warnings: [] },
        transcript: { text: "raw transcript", segments: [{ start: "00:01", end: "00:02", text: "raw transcript" }] },
        videoNote: { markdown: "knowledge note", enhancedMarkdown: "enhanced note" },
        visualEvidence: [{ frameId: "f1", timestamp: "00:01", timestampSeconds: 1, imageRef: "frames/f1.jpg", caption: "caption", source: "bilisum-visual-context" }],
        artifacts: []
      },
      { sourceKind: "temporary-link", rawRef: "data/video-intake/result.json" }
    );

    expect(source.dedupeKey).toBe("bilibili-video-intake:BV123");
    expect(formatVideoProcessingContent({
      status: "completed",
      source: { platform: "bilibili", url: "https://www.bilibili.com/video/BV123", videoId: "BV123", title: "Video" },
      acquisition: { transcriptKind: "ai-subtitle", provider: "bilisum", usedAsr: false, warnings: [] },
      transcript: { text: "raw transcript", segments: [{ start: "00:01", end: "00:02", text: "raw transcript" }] },
      videoNote: { markdown: "knowledge note", enhancedMarkdown: "enhanced note" },
      visualEvidence: [{ frameId: "f1", timestamp: "00:01", timestampSeconds: 1, imageRef: "frames/f1.jpg", caption: "caption", source: "bilisum-visual-context" }],
      artifacts: []
    })).toContain("## Enhanced Video Note");
  });

  it("processes a URL list JSON into a batch learning package index", async () => {
    const root = await tempWorkdir("batch-list");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const inputPath = path.join(root, "urls.json");
      await writeFile(inputPath, JSON.stringify({
        sourcePageUrl: "https://www.bilibili.com/favlist",
        items: [
          { title: "Video A", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
          { title: "Duplicate A", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
          { title: "Unsupported", url: "https://example.com/not-video" }
        ]
      }), "utf8");

      const result = await intakeBilibiliVideoList({
        inputPath,
        client: new FakeBiliSumClient(),
        day: "2026-06-13",
        limit: 10
      });

      expect(result.inputKind).toBe("url-list");
      expect(result.candidateCount).toBe(3);
      expect(result.processedCount).toBe(1);
      expect(result.completedCount).toBe(1);
      expect(result.skipped.map((item) => item.reason)).toContain("Duplicate Bilibili video.");
      expect(result.skipped.map((item) => item.reason)).toContain("Not a supported Bilibili video URL.");
      expect(await readFile(path.join(root, result.batchIndexRef), "utf8")).toContain("learningPackageRef");
    } finally {
      process.chdir(previous);
    }
  });

  it("accepts BrowserObservation JSON and applies the batch limit", async () => {
    const root = await tempWorkdir("batch-observation");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const inputPath = path.join(root, "observation.json");
      await writeFile(inputPath, JSON.stringify({
        sourceId: "bilibili-favorite",
        platform: "bilibili",
        streamType: "favorite",
        pageUrl: "https://space.bilibili.com/favlist",
        status: "ok",
        items: [
          { title: "Video A", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
          { title: "Video B", url: "https://www.bilibili.com/video/BV1Fb4y1273G" }
        ]
      }), "utf8");

      const result = await intakeBilibiliVideoList({
        inputPath,
        client: new FakeBiliSumClient(),
        day: "2026-06-13",
        limit: 1
      });

      expect(result.inputKind).toBe("browser-observation");
      expect(result.sourcePageUrl).toBe("https://space.bilibili.com/favlist");
      expect(result.processedCount).toBe(1);
      expect(result.skipped[0]?.reason).toBe("Skipped by batch limit.");
      expect(result.results[0]?.sourceItem).toBeUndefined();
    } finally {
      process.chdir(previous);
    }
  });
});
