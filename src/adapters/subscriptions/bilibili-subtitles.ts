import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha1 } from "../../core/hash.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { nowIso } from "../../core/time.js";
import type { SourceHealth, TranscriptSegment, VideoTranscriptItem } from "../../types.js";
import { collectBilibiliPlayerSubtitle } from "./bilibili-player-subtitles.js";

export type BilibiliSubtitleCandidate = {
  sourceItemId: string;
  title: string;
  url: string;
};

export type YtdlpRunner = (input: {
  url: string;
  outputBase: string;
  languages: string[];
}) => Promise<{ code: number; stdout: string; stderr: string }>;

type SubtitleFile = {
  fileName: string;
  language: string;
  content: string;
};

const sourceId = "bilibili-video-subtitles";
const provider = "yt-dlp-platform-subtitle";
const defaultLanguages = ["ai-zh", "zh-CN", "zh-Hans", "zh", "en"];

export function extractBilibiliVideoId(url: string): string | null {
  const bv = url.match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1] ?? url.match(/\b(BV[0-9A-Za-z]+)\b/i)?.[1];
  if (bv) return bv;
  const av = url.match(/\/video\/(av\d+)/i)?.[1] ?? url.match(/\b(av\d+)\b/i)?.[1];
  return av ?? null;
}

function stripSubtitleMarkup(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseSubtitleText(content: string): { text: string; segments: TranscriptSegment[] } {
  const normalized = content.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const segments: TranscriptSegment[] = [];
  const timePattern = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[.,]\d{3})/;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== "WEBVTT" && !line.startsWith("NOTE") && !line.startsWith("STYLE") && !/^\d+$/.test(line));
    const timeIndex = lines.findIndex((line) => timePattern.test(line));
    if (timeIndex < 0) continue;
    const match = lines[timeIndex].match(timePattern);
    if (!match) continue;
    const text = stripSubtitleMarkup(lines.slice(timeIndex + 1).join(" "));
    if (!text) continue;
    segments.push({ start: match[1], end: match[2], text });
  }

  return { segments, text: segments.map((segment) => segment.text).join("\n") };
}

function languageFromFileName(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length >= 3 ? parts.at(-2) ?? "unknown" : "unknown";
}

async function readSubtitleFiles(dir: string): Promise<SubtitleFile[]> {
  const files = (await readdir(dir)).filter((file) => /\.(vtt|srt)$/i.test(file));
  const subtitles: SubtitleFile[] = [];
  for (const fileName of files.sort()) {
    subtitles.push({
      fileName,
      language: languageFromFileName(fileName),
      content: await readFile(path.join(dir, fileName), "utf8")
    });
  }
  return subtitles;
}

function defaultYtdlpRunner(input: { url: string; outputBase: string; languages: string[] }): Promise<{ code: number; stdout: string; stderr: string }> {
  const args = [
    "--write-subs",
    "--write-auto-subs",
    "--skip-download",
    "--sub-langs",
    input.languages.join(","),
    "--sub-format",
    "vtt/srt",
    "--output",
    input.outputBase,
    input.url
  ];

  return new Promise((resolve) => {
    const child = spawn("yt-dlp", args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => resolve({ code: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) =>
      resolve({ code: code ?? 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") })
    );
  });
}

export async function collectBilibiliSubtitle(
  candidate: BilibiliSubtitleCandidate,
  runner: YtdlpRunner = defaultYtdlpRunner,
  languages = defaultLanguages
): Promise<{ item: VideoTranscriptItem | null; rawRef: string; health: SourceHealth }> {
  const capturedAt = nowIso();
  const videoId = extractBilibiliVideoId(candidate.url);
  if (!videoId) {
    return {
      item: null,
      rawRef: "",
      health: {
        sourceId,
        status: "empty",
        checkedAt: capturedAt,
        provider,
        successWindowHours: 6,
        message: `No Bilibili video id found in ${candidate.url}.`
      }
    };
  }

  try {
    const playerSubtitle = await collectBilibiliPlayerSubtitle(videoId);
    if (playerSubtitle) {
      const rawRef = await writeRawSnapshot(sourceId, {
        provider: "bilibili-player-ai-subtitle",
        videoId,
        url: candidate.url,
        track: playerSubtitle.track,
        payload: playerSubtitle.payload
      });
      const dedupeKey = `bilibili-transcript:${videoId}:${playerSubtitle.track.lan}`;
      return {
        item: {
          id: `bilibili-transcript-${sha1(dedupeKey).slice(0, 12)}`,
          sourceId,
          platform: "bilibili",
          provider: "bilibili-player-ai-subtitle",
          videoId,
          title: candidate.title,
          url: candidate.url,
          language: playerSubtitle.track.lan,
          transcriptKind: "ai-subtitle",
          capturedAt,
          text: playerSubtitle.text,
          segments: playerSubtitle.segments,
          rawRef,
          dedupeKey
        },
        rawRef,
        health: {
          sourceId,
          status: "ok",
          checkedAt: capturedAt,
          provider: "bilibili-player-ai-subtitle",
          itemCount: 1,
          successWindowHours: 6
        }
      };
    }
  } catch {
    // Fall through to yt-dlp when the local CDP session is unavailable or has no AI track.
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "hotspot-bilibili-subtitles-"));
  const outputBase = path.join(tempDir, "subtitle");
  try {
    const run = await runner({ url: candidate.url, outputBase, languages });
    const subtitles = await readSubtitleFiles(tempDir);
    if (!subtitles.length) {
      return {
        item: null,
        rawRef: "",
        health: {
          sourceId,
          status: run.code === 0 ? "empty" : "unavailable",
          checkedAt: capturedAt,
          provider,
          successWindowHours: 6,
          message: run.stderr || "No platform subtitle files were available."
        }
      };
    }

    const subtitle = subtitles.find((item) => item.language.toLowerCase().startsWith("ai-")) ?? subtitles[0];
    const parsed = parseSubtitleText(subtitle.content);
    if (!parsed.text) {
      return {
        item: null,
        rawRef: "",
        health: {
          sourceId,
          status: "empty",
          checkedAt: capturedAt,
          provider,
          successWindowHours: 6,
          message: "Subtitle file contained no readable text."
        }
      };
    }

    const rawRef = await writeRawSnapshot(sourceId, {
      provider,
      videoId,
      url: candidate.url,
      fileName: subtitle.fileName,
      language: subtitle.language,
      content: subtitle.content
    });
    const dedupeKey = `bilibili-transcript:${videoId}:${subtitle.language}`;
    return {
      item: {
        id: `bilibili-transcript-${sha1(dedupeKey).slice(0, 12)}`,
        sourceId,
        platform: "bilibili",
        provider,
        videoId,
        title: candidate.title,
        url: candidate.url,
        language: subtitle.language,
        transcriptKind: subtitle.language.toLowerCase().startsWith("ai-") ? "ai-subtitle" : "platform-subtitle",
        capturedAt,
        text: parsed.text,
        segments: parsed.segments,
        rawRef,
        dedupeKey
      },
      rawRef,
      health: { sourceId, status: "ok", checkedAt: capturedAt, provider, itemCount: 1, successWindowHours: 6 }
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
