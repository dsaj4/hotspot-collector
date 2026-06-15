import { describe, expect, it } from "vitest";
import { validateFixtures } from "../src/validators/fixtures.js";
import { validateBrowserObservation, validateHotspotItem, validateRawSnapshot, validateSourceHealth, validateSubscriptionItem } from "../src/validators/normalized.js";

describe("normalized validators", () => {
  it("accepts valid fixture files", async () => {
    const result = await validateFixtures("fixtures");
    expect(result.ok).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("rejects invalid subscription items", () => {
    const issues = validateSubscriptionItem({ title: "missing fields" }, "subscription");
    expect(issues.map((issue) => issue.message)).toContain("Missing string field: id");
    expect(issues.map((issue) => issue.message)).toContain("url must be an http(s) URL.");
  });

  it("rejects invalid hotspot ranks", () => {
    const issues = validateHotspotItem(
      {
        id: "x",
        sourceId: "source",
        platform: "platform",
        provider: "provider",
        title: "title",
        url: "https://example.com",
        rank: 0,
        category: "hotspot",
        capturedAt: "2026-05-28T09:00:00.000Z",
        rawRef: "raw.json",
        dedupeKey: "key"
      },
      "hotspot"
    );
    expect(issues.map((issue) => issue.message)).toContain("rank must be a positive number.");
  });

  it("rejects unknown health status values", () => {
    const issues = validateSourceHealth({ sourceId: "x", status: "maybe", checkedAt: "2026-05-28T09:00:00.000Z" }, "health");
    expect(issues.map((issue) => issue.message)).toContain("status must be a known SourceStatus.");
  });

  it("rejects empty raw snapshots", () => {
    const issues = validateRawSnapshot({ sourceId: "empty" }, "raw");
    expect(issues.map((issue) => issue.message)).toContain(
      "Raw snapshot must contain provider, payload, response, responses, xml, or items."
    );
  });

  it("requires Xiaohongshu browser observations to include body and an image", () => {
    const issues = validateBrowserObservation({
      sourceId: "xiaohongshu-home",
      platform: "xiaohongshu",
      streamType: "home-feed",
      pageUrl: "https://www.xiaohongshu.com/explore",
      status: "ok",
      items: [{ title: "note", url: "https://www.xiaohongshu.com/explore/1", body: "", media: [] }]
    });
    expect(issues.map((issue) => issue.message)).toContain("Xiaohongshu items require non-empty body.");
    expect(issues.map((issue) => issue.message)).toContain("Xiaohongshu items require at least one image URL.");
  });
});
