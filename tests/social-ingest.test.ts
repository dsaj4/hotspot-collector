import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestBrowserObservation } from "../src/social/ingest.js";
import { dateFolder } from "../src/core/time.js";
import { artifactPath } from "../src/core/paths.js";

describe("browser social ingest", () => {
  it("writes social truth and compatibility output without duplicating repeated observations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "social-ingest-"));
    const previous = process.cwd();
    process.chdir(root);
    try {
      const observation = {
        sourceId: "xiaohongshu-home",
        platform: "xiaohongshu" as const,
        streamType: "home-feed" as const,
        pageUrl: "https://www.xiaohongshu.com/explore",
        status: "ok" as const,
        capturedAt: "2026-06-11T00:00:00.000Z",
        items: [{ title: "AI note", url: "https://www.xiaohongshu.com/explore/1", body: "Useful body", media: ["https://example.com/1.jpg"] }]
      };
      await ingestBrowserObservation(observation);
      await ingestBrowserObservation(observation);
      const day = dateFolder();
      const social = await readFile(artifactPath(`data/normalized/${day}/social-items.jsonl`), "utf8");
      const subscriptions = await readFile(artifactPath(`data/normalized/${day}/subscriptions.jsonl`), "utf8");
      expect(social.trim().split(/\r?\n/)).toHaveLength(1);
      expect(subscriptions.trim().split(/\r?\n/)).toHaveLength(1);
    } finally {
      process.chdir(previous);
    }
  });

  it("rejects Xiaohongshu items without both body and image", async () => {
    await expect(ingestBrowserObservation({
      sourceId: "xiaohongshu-home",
      platform: "xiaohongshu",
      streamType: "home-feed",
      pageUrl: "https://www.xiaohongshu.com/explore",
      status: "ok",
      items: [{ title: "Incomplete", url: "https://www.xiaohongshu.com/explore/1", body: "", media: [] }]
    })).rejects.toThrow("Xiaohongshu items require non-empty body");
  });

  it("only requests fallback for unavailable or error observations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "social-empty-"));
    const previous = process.cwd();
    process.chdir(root);
    try {
      const empty = await ingestBrowserObservation({
        sourceId: "weibo-home",
        platform: "weibo",
        streamType: "home-feed",
        pageUrl: "https://weibo.com",
        status: "empty",
        items: []
      });
      expect(empty.fallbackRequired).toBe(false);
      const unavailable = await ingestBrowserObservation({
        sourceId: "weibo-home",
        platform: "weibo",
        streamType: "home-feed",
        pageUrl: "https://weibo.com",
        status: "unavailable",
        items: [],
        message: "Login expired"
      });
      expect(unavailable.fallbackRequired).toBe(true);
      const health = JSON.parse(await readFile(artifactPath("data/health/source-health.json"), "utf8")) as Array<{
        lastSuccessAt?: string;
        meetsSuccessSla?: boolean;
      }>;
      expect(health[0].lastSuccessAt).toBeDefined();
      expect(health[0].meetsSuccessSla).toBe(true);
    } finally {
      process.chdir(previous);
    }
  });
});
