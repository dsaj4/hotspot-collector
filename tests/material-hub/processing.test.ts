import { describe, expect, it } from "vitest";
import { buildMaterialRecord, classifySourceItem } from "../../src/material-hub/processing.js";
import { isMaterialRecord, type MaterialHubSourceItem } from "../../src/material-hub/types.js";

const sourceItem: MaterialHubSourceItem = {
  id: "src-link-1",
  sourceKind: "temporary-link",
  platform: "bilibili",
  provider: "public-api",
  title: "AI video commentary",
  url: "https://www.bilibili.com/video/BV123",
  capturedAt: "2026-06-08T00:00:00.000Z",
  rawRef: "https://www.bilibili.com/video/BV123",
  dedupeKey: "temporary-link:abc"
};

describe("material processing", () => {
  it("classifies Bilibili video links as opinion insights", () => {
    expect(classifySourceItem(sourceItem)).toBe("opinion_insight");
  });

  it("builds a reviewable material record with content output", () => {
    const record = buildMaterialRecord(sourceItem, { now: "2026-06-08T00:00:00.000Z" });

    expect(isMaterialRecord(record)).toBe(true);
    expect(record.processingStatus).toBe("needs-review");
    expect(record.imaBinding?.syncStatus).toBe("not-synced");
    expect(record.contentOutput?.keyPoints.length).toBeGreaterThan(0);
    expect(record.sourceTrace[0]?.url).toBe(sourceItem.url);
  });
});
