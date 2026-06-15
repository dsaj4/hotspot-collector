import { describe, expect, it } from "vitest";
import { isMaterialRecord, isSourceDigest, isSourceItem } from "../../src/material-hub/types.js";

describe("material hub types", () => {
  it("accepts a minimal source item with traceability fields", () => {
    expect(
      isSourceItem({
        id: "src_20260606_abc",
        sourceKind: "subscription",
        platform: "bilibili",
        provider: "public-api",
        title: "Video title",
        url: "https://www.bilibili.com/video/BV123",
        capturedAt: "2026-06-06T00:00:00.000Z",
        rawRef: "data/raw/2026-06-06/example.json",
        normalizedRef: "data/normalized/2026-06-06/subscriptions.jsonl",
        dedupeKey: "bilibili:BV123"
      })
    ).toBe(true);
  });

  it("rejects a material record without sourceRefs", () => {
    expect(
      isMaterialRecord({
        id: "mat_abc",
        title: "Missing source refs",
        materialType: "news_brief"
      })
    ).toBe(false);
  });

  it("accepts a source digest with traceability and verification fields", () => {
    expect(
      isSourceDigest({
        id: "dig_abc",
        sourceItemId: "src_abc",
        sourceRef: "material-hub-workspace/00-source-items/2026-06-08/source-items.jsonl",
        platform: "zhihu",
        provider: "public-api",
        title: "Example",
        url: "https://example.com",
        capturedAt: "2026-06-08T00:00:00.000Z",
        digestStatus: "generated",
        contentTypeCandidates: ["news_brief"],
        templateCandidates: ["intelligence_brief"],
        summary: "A short faithful summary.",
        systemTags: ["热榜"],
        taxonomyTags: ["新闻"],
        topicTags: ["AI agents"],
        factualPoints: [{ text: "A point from the source.", support: "direct" }],
        claims: [{ text: "A claim.", claimType: "fact", confidence: "medium" }],
        entities: [{ name: "Example", type: "concept" }],
        tagsCandidate: ["zhihu"],
        narrativeLineCandidates: ["judgment-retention"],
        representativeSnippets: [{ text: "source words", reason: "review support" }],
        sourceReliability: "C",
        informationCredibility: "3",
        verificationIssues: ["Check original source."],
        biasOrFrameNotes: ["Single-source digest."],
        generatedAt: "2026-06-08T00:00:00.000Z"
      })
    ).toBe(true);
  });
});
