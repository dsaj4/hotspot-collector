import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { intakeBilibiliVideo, intakeBilibiliVideoList, mapVideoProcessingResultToSourceItem, formatVideoProcessingContent } from "../src/video-intake/bilibili.js";
import { BiliSumClient, type BiliSumMindmapResponse, type BiliSumTaskDetail, type BiliSumVisualEvidenceResponse } from "../src/video-intake/bilisum-client.js";
import type { VideoProcessingResult } from "../src/video-intake/types.js";
import type { YtdlpRunner } from "../src/adapters/subscriptions/bilibili-subtitles.js";

async function tempWorkdir(name: string): Promise<string> {
  const dir = path.join(tmpdir(), `hotspot-video-intake-${name}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

const subtitleRunner: YtdlpRunner = async ({ outputBase }) => {
  await mkdir(path.dirname(outputBase), { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      `${outputBase}.ai-zh.vtt`,
      `WEBVTT

00:00:01.000 --> 00:00:03.000
这是一段关于 AI 工具链的视频。

00:00:04.000 --> 00:00:07.000
作者展示了从素材到卡片的流程。
`,
      "utf8"
    )
  );
  return { code: 0, stdout: "", stderr: "" };
};

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
      title: "AI 工具链视频",
      result: {
        knowledge_note_markdown: "## 视频笔记\n作者讲了素材采集、整理和卡片生成。",
        transcript_text: "这是一段关于 AI 工具链的视频。\n作者展示了从素材到卡片的流程。",
        segments: [{ start: "00:00:01", end: "00:00:03", text: "这是一段关于 AI 工具链的视频。" }],
        artifacts: { summary_path: "tasks/task-1/summary.json", visual_context_path: "tasks/task-1/visual_context.json" }
      }
    };
  }

  override async generateMindmap(): Promise<BiliSumMindmapResponse> {
    return {
      task_id: "task-1",
      status: "ready",
      mindmap: {
        title: "AI 工具链视频",
        root: "root",
        nodes: [
          {
            id: "root",
            label: "素材处理中枢",
            type: "root",
            summary: "把采集、整理和卡片生成串起来。",
            children: [{ id: "leaf-1", label: "卡片生成", type: "leaf", summary: "输出可读素材卡。", children: [], time_anchor: 4 }]
          }
        ]
      }
    };
  }

  override async generateVisualEvidence(): Promise<BiliSumVisualEvidenceResponse> {
    return {
      task_id: "task-1",
      status: "ready",
      visual_note_markdown: "## 图文笔记\n视频展示了工具界面。",
      enhanced_note_markdown: "## 增强笔记\n作者用界面演示素材到卡片的路径。",
      context: {
        frame_index_path: "frame_index.json",
        visual_insert_plan_path: "visual_insert_plan.json",
        frames: [{ frame_id: "f0001", timestamp_seconds: 4, timestamp: "00:04", image_path: "frames/f0001.jpg" }],
        observations: [
          {
            frame_id: "f0001",
            timestamp_seconds: 4,
            caption: "工具界面截图",
            ocr_text: "Material Card",
            key_facts: ["界面出现 Material Card"],
            semantic_summary: "画面显示素材卡生成界面",
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
  it("normalizes BiliSum notes, mindmap, and visual evidence into a material source item", async () => {
    const root = await tempWorkdir("ok");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "AI 工具链视频",
        client: new FakeBiliSumClient(),
        runner: subtitleRunner,
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
      expect(saved.mindmap?.textSummary).toContain("素材处理中枢");
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
        runner: subtitleRunner,
        day: "2026-06-13",
        publishToMaterialHub: false
      });

      expect(result.status).toBe("completed");
      expect(result.sourceItem).toBeUndefined();
      expect(result.sourceItemRef).toBeUndefined();
      expect(await readFile(path.join(root, result.learningPackageRef), "utf8")).toContain('"writesToMaterialHub": false');
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
        runner: subtitleRunner,
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

  it("returns needs_asr without calling BiliSum when subtitles are unavailable", async () => {
    const root = await tempWorkdir("needs-asr");
    const previous = process.cwd();
    process.chdir(root);
    const create = vi.spyOn(FakeBiliSumClient.prototype, "createBilibiliUrlTask");
    try {
      const result = await intakeBilibiliVideo({
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        title: "No subtitles",
        client: new FakeBiliSumClient(),
        runner: async () => ({ code: 0, stdout: "", stderr: "" }),
        day: "2026-06-13"
      });

      expect(result.status).toBe("needs_asr");
      expect(create).not.toHaveBeenCalled();
      expect(result.sourceItem).toBeUndefined();
    } finally {
      process.chdir(previous);
      create.mockRestore();
    }
  });

  it("formats video processing content with note-first evidence order", () => {
    const source = mapVideoProcessingResultToSourceItem(
      {
        status: "completed",
        source: { platform: "bilibili", url: "https://www.bilibili.com/video/BV123", videoId: "BV123", title: "Video" },
        acquisition: { transcriptKind: "ai-subtitle", provider: "bilibili-player-ai-subtitle", usedAsr: false, warnings: [] },
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
      acquisition: { transcriptKind: "ai-subtitle", provider: "bilibili-player-ai-subtitle", usedAsr: false, warnings: [] },
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
        runner: subtitleRunner,
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
        runner: subtitleRunner,
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
