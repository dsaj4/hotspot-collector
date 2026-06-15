import { describe, expect, it } from "vitest";
import { buildSourceDigest, buildSourceDigestWithDeepSeek, digestBriefMarkdown, templateByType } from "../../src/material-hub/digest.js";
import { isSourceDigest, type MaterialHubSourceItem } from "../../src/material-hub/types.js";

const sourceItem: MaterialHubSourceItem = {
  id: "src-hot-1",
  sourceKind: "hotspot",
  platform: "zhihu",
  provider: "public-api",
  title: "AI agents reshape knowledge workflows",
  url: "https://example.com/ai-agents",
  capturedAt: "2026-06-08T00:00:00.000Z",
  summary: "AI agents are being discussed as workflow companions. heat: 12345",
  rawRef: "data/raw/ai-agents.json",
  normalizedRef: "data/normalized/hotspots.jsonl",
  dedupeKey: "hotspot:ai-agents"
};

describe("source digest", () => {
  it("builds a conservative source digest from a source item", () => {
    const digest = buildSourceDigest(sourceItem, { now: "2026-06-08T00:00:00.000Z" });

    expect(isSourceDigest(digest)).toBe(true);
    expect(digest.sourceItemId).toBe(sourceItem.id);
    expect(digest.contentTypeCandidates).toEqual(["news_brief"]);
    expect(digest.templateCandidates).toEqual(["intelligence_brief"]);
    expect(digest.systemTags).toContain("热榜");
    expect(digest.taxonomyTags.length).toBeGreaterThan(0);
    expect(Array.isArray(digest.topicTags)).toBe(true);
    expect(digest.attentionSignal?.caveat).toContain("not factual verification");
    expect(digest.verificationIssues.length).toBeGreaterThan(0);
  });

  it("maps content types to the four processing templates", () => {
    expect(templateByType.news_brief).toBe("intelligence_brief");
    expect(templateByType.project_doc).toBe("structured_summary");
    expect(templateByType.deep_article).toBe("research_note");
    expect(templateByType.opinion_insight).toBe("opinion_incubator");
  });

  it("normalizes DeepSeek JSON into a source digest", async () => {
    const client = {
      chat: async () => ({
        model: "deepseek-test",
        content: JSON.stringify({
          summary: "这条来源讨论 AI agents 如何进入知识工作流。",
          contentTypeCandidates: ["deep_article"],
          templateCandidates: ["research_note"],
          factualPoints: [{ text: "来源提到 AI agents 与知识工作流。", support: "direct" }],
          claims: [{ text: "工作瓶颈转向判断质量。", claimType: "opinion", confidence: "medium" }],
          entities: [{ name: "AI agents", type: "concept" }],
          taxonomyTags: ["AI"],
          topicTags: ["knowledge workflow", "judgment retention"],
          representativeSnippets: [{ text: "workflow companions", reason: "核心措辞" }],
          verificationIssues: ["缺少外部交叉验证。"],
          biasOrFrameNotes: ["创作者表达可能带有个人判断。"]
        })
      })
    };

    const digest = await buildSourceDigestWithDeepSeek(sourceItem, client);

    expect(isSourceDigest(digest)).toBe(true);
    expect(digest.digestModel).toBe("deepseek-test");
    expect(digest.contentTypeCandidates).toEqual(["deep_article"]);
    expect(digest.templateCandidates).toEqual(["research_note"]);
    expect(digest.taxonomyTags).toContain("AI");
    expect(digest.topicTags).toContain("knowledge workflow");
  });

  it("renders a human-readable digest topic brief", () => {
    const digest = buildSourceDigest(sourceItem, { now: "2026-06-08T00:00:00.000Z" });
    const markdown = digestBriefMarkdown("2026-06-08", [digest]);
    expect(markdown).toContain("Digest 主题简报");
    expect(markdown).toContain(sourceItem.title);
    expect(markdown).toContain("待核验");
  });

  it("prefers full content text over shortened source summaries", () => {
    const digest = buildSourceDigest({
      ...sourceItem,
      summary: "这是一段被截断的摘要：第一点还没说",
      contentText: "完整正文第一句说明背景已经成立。完整正文第二句补充影响路径。完整正文第三句给出审核边界。",
      title: "完整正文优先测试"
    });

    expect(digest.summary).toContain("完整正文第一句");
    expect(digest.summary).toContain("完整正文第三句给出审核边界。");
    expect(digest.summary).not.toContain("还没说");
  });
});
