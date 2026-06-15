import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectBilibiliSubtitle,
  extractBilibiliVideoId,
  parseSubtitleText,
  type YtdlpRunner
} from "../src/adapters/subscriptions/bilibili-subtitles.js";
import { collectBilibiliSubtitlesFromLatest } from "../src/collectors/bilibili-subtitles.js";
import { appendVideoTranscripts } from "../src/core/storage.js";
import { dateFolder } from "../src/core/time.js";
import { decodeSubtitleTracks, normalizeSubtitleBody } from "../src/adapters/subscriptions/bilibili-player-subtitles.js";

describe("Bilibili subtitles", () => {
  it("extracts Bilibili video ids from video URLs", () => {
    expect(extractBilibiliVideoId("https://www.bilibili.com/video/BV1Fa4y1273F/?spm_id_from=333")).toBe("BV1Fa4y1273F");
    expect(extractBilibiliVideoId("https://www.bilibili.com/video/av123456")).toBe("av123456");
    expect(extractBilibiliVideoId("https://t.bilibili.com/123")).toBeNull();
  });

  it("decodes Bilibili subtitle protobuf tracks", () => {
    const text = new TextEncoder();
    const field = (id: number, value: Uint8Array) => Uint8Array.from([id << 3 | 2, value.length, ...value]);
    const varint = (id: number, value: number) => Uint8Array.from([id << 3, value]);
    const item = Uint8Array.from([
      ...field(3, text.encode("ai-zh")),
      ...field(4, text.encode("中文（自动生成）")),
      ...field(5, text.encode("//subtitle.bilibili.com/path")),
      ...varint(7, 1),
      ...varint(10, 2)
    ]);
    const video = field(3, item);
    const reply = field(1, video);
    expect(decodeSubtitleTracks(reply)[0]).toMatchObject({ lan: "ai-zh", type: 1, aiStatus: 2 });
  });

  it("normalizes Bilibili subtitle JSON bodies", () => {
    expect(normalizeSubtitleBody({ body: [{ from: 1.25, to: 2.5, content: "AI text" }] })).toEqual({
      text: "AI text",
      segments: [{ start: "00:00:01.250", end: "00:00:02.500", text: "AI text" }]
    });
  });

  it("parses VTT and SRT subtitles into text and segments", () => {
    const vtt = parseSubtitleText(`WEBVTT

00:00:01.000 --> 00:00:03.500
你好 <c>世界</c>

00:00:04.000 --> 00:00:05.000
第二句
`);
    expect(vtt.text).toBe("你好 世界\n第二句");
    expect(vtt.segments).toHaveLength(2);

    const srt = parseSubtitleText(`1
00:00:01,000 --> 00:00:02,000
hello
`);
    expect(srt.segments[0].start).toBe("00:00:01,000");
    expect(srt.text).toBe("hello");
  });

  it("returns empty health when yt-dlp finds no subtitle files", async () => {
    const runner: YtdlpRunner = async () => ({ code: 0, stderr: "", stdout: "" });
    const result = await collectBilibiliSubtitle(
      { sourceItemId: "hot-1", title: "No subtitles", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
      runner
    );

    expect(result.item).toBeNull();
    expect(result.health.status).toBe("empty");
    expect(result.health.successWindowHours).toBe(6);
    expect(result.rawRef).toBe("");
  });

  it("normalizes available subtitle files", async () => {
    const runner: YtdlpRunner = async ({ outputBase }) => {
      await writeFile(`${outputBase}.zh-CN.vtt`, "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n字幕内容\n", "utf8");
      return { code: 0, stderr: "", stdout: "" };
    };
    const result = await collectBilibiliSubtitle(
      { sourceItemId: "hot-1", title: "Has subtitles", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
      runner
    );

    expect(result.item?.videoId).toBe("BV1Fa4y1273F");
    expect(result.item?.text).toBe("字幕内容");
    expect(result.item?.transcriptKind).toBe("platform-subtitle");
    expect(result.health.status).toBe("ok");
    expect(result.rawRef).toMatch(/^data\/raw\//);
  });

  it("prefers AI subtitles and marks them as AI transcription", async () => {
    const runner: YtdlpRunner = async ({ outputBase }) => {
      await writeFile(`${outputBase}.zh-CN.vtt`, "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nmanual\n", "utf8");
      await writeFile(`${outputBase}.ai-zh.vtt`, "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nAI transcript\n", "utf8");
      return { code: 0, stderr: "", stdout: "" };
    };
    const result = await collectBilibiliSubtitle(
      { sourceItemId: "hot-1", title: "AI subtitles", url: "https://www.bilibili.com/video/BV1Fa4y1273F" },
      runner
    );
    expect(result.item?.text).toBe("AI transcript");
    expect(result.item?.transcriptKind).toBe("ai-subtitle");
  });

  it("collects candidates from latest normalized Bilibili items", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hotspot-bilibili-subtitles-"));
    const normalizedDir = path.join(root, "data", "normalized", "2026-06-05");
    await mkdir(normalizedDir, { recursive: true });
    await writeFile(
      path.join(normalizedDir, "hotspots.jsonl"),
      JSON.stringify({
        id: "hot-1",
        sourceId: "bilibili-popular",
        platform: "bilibili",
        provider: "platform-direct",
        rank: 1,
        title: "热门视频",
        url: "https://www.bilibili.com/video/BV1Fa4y1273F",
        category: "hotspot",
        capturedAt: "2026-06-05T00:00:00.000Z",
        rawRef: "data/raw/source.json",
        dedupeKey: "hot-1"
      }) + "\n",
      "utf8"
    );

    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const runner: YtdlpRunner = async ({ outputBase }) => {
        await writeFile(`${outputBase}.zh-CN.vtt`, "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n热门字幕\n", "utf8");
        return { code: 0, stderr: "", stdout: "" };
      };
      const result = await collectBilibiliSubtitlesFromLatest({ runner });
      expect(result.transcriptCount).toBe(1);
      const outputDay = dateFolder();
      expect(result.normalizedRefs).toContain(`data/normalized/${outputDay}/video-transcripts.jsonl`);
      const output = await readFile(path.join(root, "data", "normalized", outputDay, "video-transcripts.jsonl"), "utf8");
      await appendVideoTranscripts([JSON.parse(output.trim())]);
      const dedupedOutput = await readFile(path.join(root, "data", "normalized", outputDay, "video-transcripts.jsonl"), "utf8");
      expect(dedupedOutput.trim().split(/\r?\n/)).toHaveLength(1);
      expect(await readFile(path.join(root, "data", "normalized", outputDay, "video-transcripts.jsonl"), "utf8")).toContain("热门字幕");
    } finally {
      process.chdir(previousCwd);
    }
  });
});
