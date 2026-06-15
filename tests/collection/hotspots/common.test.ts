import { describe, expect, it } from "vitest";
import { hotspotDedupeKey, makeHotspotItem, normalizeTitle } from "../../../src/collection/hotspots/adapters/common.js";

describe("hotspot normalization", () => {
  it("keeps dedupe stable per source, date, rank and title", () => {
    const first = hotspotDedupeKey("weibo-hot", "2026-05-28T03:00:00.000Z", 1, "Test topic");
    const second = hotspotDedupeKey("weibo-hot", "2026-05-28T23:59:59.000Z", 1, "Test topic");
    expect(first).toBe(second);
  });

  it("creates normalized hotspot items with raw references", () => {
    const item = makeHotspotItem({
      sourceId: "github-trending",
      platform: "github",
      provider: "html-public",
      rank: 2,
      title: "repo/name",
      url: "https://github.com/repo/name",
      capturedAt: "2026-05-28T03:00:00.000Z",
      rawRef: "data/raw/sample.json",
      heat: "42 stars"
    });

    expect(item.rawRef).toBe("data/raw/sample.json");
    expect(item.dedupeKey).toContain("github-trending:2026-05-28:2:");
    expect(item.heat).toBe("42 stars");
  });

  it("normalizes unknown titles to empty strings", () => {
    expect(normalizeTitle(null)).toBe("");
  });
});
