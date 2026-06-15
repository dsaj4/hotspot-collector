import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { exportNormalizedSourceItems } from "../../src/material-hub/export-source-items.js";

async function tempDir(name: string): Promise<string> {
  const dir = path.join(tmpdir(), `hotspot-collector-${name}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("export normalized source items", () => {
  it("maps normalized subscriptions and hotspots into material hub source items", async () => {
    const normalizedRoot = await tempDir("normalized");
    const outputRoot = await tempDir("hub");
    const day = "2026-06-08";
    const dayDir = path.join(normalizedRoot, day);
    await mkdir(dayDir, { recursive: true });
    await writeFile(
      path.join(dayDir, "subscriptions.jsonl"),
      `${JSON.stringify({
        id: "sub1",
        sourceId: "bilisum-video-note",
        platform: "bilibili",
        provider: "public-api",
        authorId: "289842886",
        authorName: "Example",
        title: "Bilibili video",
        url: "https://www.bilibili.com/video/BV123",
        publishedAt: null,
        capturedAt: "2026-06-08T00:00:00.000Z",
        summary: "summary",
        media: [],
        rawRef: "data/raw/raw.json",
        dedupeKey: "bilibili:BV123"
      })}\n`,
      "utf8"
    );
    await writeFile(
      path.join(dayDir, "hotspots.jsonl"),
      `${JSON.stringify({
        id: "hot1",
        sourceId: "github-trending",
        platform: "github",
        provider: "public-api",
        rank: 1,
        title: "AI repo",
        url: "https://github.com/example/repo",
        category: "daily",
        capturedAt: "2026-06-08T00:00:00.000Z",
        rawRef: "data/raw/hot.json",
        dedupeKey: "github:repo"
      })}\n`,
      "utf8"
    );

    const result = await exportNormalizedSourceItems({ day, normalizedRoot, outputRoot });
    const output = await readFile(path.join(outputRoot, result.outputRef), "utf8");
    const rows = output.trim().split(/\r?\n/).map((line) => JSON.parse(line));

    expect(result.itemCount).toBe(2);
    expect(rows.map((row) => row.sourceKind).sort()).toEqual(["hotspot", "subscription"]);
    expect(rows[0].normalizedRef).toContain("subscriptions.jsonl");
  });

  it("preserves existing temporary link items when exporting normalized sources", async () => {
    const normalizedRoot = await tempDir("normalized-merge");
    const outputRoot = await tempDir("hub-merge");
    const day = "2026-06-08";
    const dayDir = path.join(normalizedRoot, day);
    const hubDayDir = path.join(outputRoot, "00-source-items", day);
    await mkdir(dayDir, { recursive: true });
    await mkdir(hubDayDir, { recursive: true });
    await writeFile(
      path.join(hubDayDir, "source-items.jsonl"),
      `${JSON.stringify({
        id: "src-link",
        sourceKind: "temporary-link",
        platform: "bilibili",
        provider: "public-api",
        title: "link",
        url: "https://space.bilibili.com/1",
        capturedAt: "2026-06-08T00:00:00.000Z",
        dedupeKey: "temporary-link:1"
      })}\n`,
      "utf8"
    );
    await writeFile(
      path.join(dayDir, "hotspots.jsonl"),
      `${JSON.stringify({
        id: "hot1",
        sourceId: "baidu-hot",
        platform: "baidu",
        provider: "public-api",
        rank: 1,
        title: "AI news",
        url: "https://example.com/ai",
        category: "daily",
        capturedAt: "2026-06-08T00:00:00.000Z",
        rawRef: "data/raw/hot.json",
        dedupeKey: "baidu:ai"
      })}\n`,
      "utf8"
    );

    const result = await exportNormalizedSourceItems({ day, normalizedRoot, outputRoot });
    const rows = (await readFile(path.join(outputRoot, result.outputRef), "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));

    expect(rows.map((row) => row.dedupeKey).sort()).toEqual(["baidu:ai", "temporary-link:1"]);
  });
});
