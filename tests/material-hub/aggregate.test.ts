import { describe, expect, it } from "vitest";
import { buildAggregatedMaterialCard, buildAggregatedMaterialCardsWithDeepSeek } from "../../src/material-hub/aggregate.js";
import { buildSourceDigest } from "../../src/material-hub/digest.js";
import { isMaterialRecord, type MaterialHubSourceItem, type SourceDigest } from "../../src/material-hub/types.js";

function item(id: string, sourceKind: MaterialHubSourceItem["sourceKind"], platform: string, title: string, summary: string): MaterialHubSourceItem {
  return {
    id,
    sourceKind,
    platform,
    provider: platform === "local" ? "official-doc" : "public-api",
    title,
    url: platform === "local" ? `file:///E:/Project/vision-lib/${id}.md` : `https://example.com/${id}`,
    capturedAt: "2026-06-08T00:00:00.000Z",
    summary,
    rawRef: `raw/${id}.json`,
    normalizedRef: `normalized/${id}.jsonl`,
    dedupeKey: `${platform}:${id}`
  };
}

const news = buildSourceDigest(item("news-1", "hotspot", "zhihu", "AI coding agents enter background workflow", "A tool ships background task execution and repository-aware context."));
const project = buildSourceDigest(item("project-1", "temporary-link", "local", "Material hub implementation plan", "The project plan says LLM work should move from card annotation to source digest and aggregation."));
const opinion = buildSourceDigest(item("opinion-1", "temporary-link", "bilibili", "Creator says review is the bottleneck", "A creator argues that AI coding agents shift work from writing code to judging patches."));

describe("aggregated material cards", () => {
  it("builds an Option B readable card with used and discarded source decisions", () => {
    const weakDigest: SourceDigest = {
      ...opinion,
      id: "dig-weak",
      digestStatus: "failed",
      summary: "",
      sourceItemId: "src-weak"
    };
    const card = buildAggregatedMaterialCard([news, weakDigest], { now: "2026-06-08T00:00:00.000Z" });

    expect(isMaterialRecord(card)).toBe(true);
    expect(card.processingTemplate).toBe("intelligence_brief");
    expect(card.cardBody).toContain("待核验的来源信号");
    expect(card.systemTags?.length).toBeGreaterThan(0);
    expect(card.taxonomyTags?.length).toBeGreaterThan(0);
    expect(card.usedSources?.length).toBe(1);
    expect(card.discardedSources?.[0]?.sourceItemId).toBe("src-weak");
    expect(card.sourceCoverage?.sufficiency).toBe("thin");
  });

  it("produces structurally different same-source cards for different templates", () => {
    const intelligence = buildAggregatedMaterialCard([news, opinion], { template: "intelligence_brief" });
    const structured = buildAggregatedMaterialCard([news, opinion], { template: "structured_summary" });
    const research = buildAggregatedMaterialCard([news, opinion], { template: "research_note" });
    const incubator = buildAggregatedMaterialCard([news, opinion], { template: "opinion_incubator" });

    expect(intelligence.cardBody).toContain("待核验的来源信号");
    expect(structured.cardBody).toContain("可管理的整理卡");
    expect(research.cardBody).toContain("提出的问题比它直接给出的答案更有价值");
    expect(incubator.cardBody).toContain("值得留下的张力");
    expect(new Set([intelligence.title, structured.title, research.title, incubator.title]).size).toBe(4);
  });

  it("defaults project docs to structured summaries", () => {
    const card = buildAggregatedMaterialCard([project]);

    expect(card.materialType).toBe("project_doc");
    expect(card.processingTemplate).toBe("structured_summary");
    expect(card.riskLevel).toBe("low");
    expect(card.systemTags).toContain("项目文档");
  });

  it("keeps local-rule card prose from ending on a truncated sentence", () => {
    const digest: SourceDigest = {
      ...opinion,
      summary: "完整素材第一句说明汇率压力会传导到进口成本。完整素材第二句说明居民购买力和市场叙事之间存在错位。完整素材第三句说明审核时需要把事实、观点和情绪表达分开。",
      factualPoints: [
        {
          text: "完整素材第一句说明汇率压力会传导到进口成本。完整素材第二句说明居民购买力和市场叙事之间存在错位。完整素材第三句说明审核时需要把事实、观点和情绪表达分开。",
          support: "direct"
        }
      ]
    };
    const card = buildAggregatedMaterialCard([digest], { template: "structured_summary" });

    expect(card.cardBody).toContain("完整素材第三句说明审核时需要把事实、观点和情绪表达分开。");
    expect(card.cardBody?.trim()).not.toMatch(/购买力$/);
  });

  it("normalizes DeepSeek JSON into multiple aggregated cards", async () => {
    let calls = 0;
    const client = {
      chat: async (messages: Array<{ content: string }>) => {
        calls += 1;
        if (calls === 1) {
          expect(messages[0]?.content).toContain("readable Chinese short article");
          expect(messages[1]?.content).toContain('"readerPromise"');
          expect(messages[1]?.content).toContain('"opinion_incubator"');
        } else {
          expect(messages[1]?.content).toContain("Repair only the listed writing-quality problems");
          expect(messages[1]?.content).toContain("too-short");
          expect(messages[1]?.content).toContain('"sourceDigests"');
        }
        return {
          model: "deepseek-test",
          content: JSON.stringify({
          cards: [
            {
              title: "AI coding agents 的评审负担正在变成主题",
              materialType: "opinion_insight",
              processingTemplate: "opinion_incubator",
              topic: "coding agent review burden",
              cardBody: "这组材料里最有用的不是 agent 会不会写代码，而是人怎么判断它写出来的东西。产品在推进后台任务，创作者强调小团队效率，讨论区则提醒评审负担并没有消失。",
              tags: ["ai-agents"],
              narrativeLines: ["judgment-retention"],
              usedSources: [{ digestId: news.id, reason: "提供产品变化背景。", supportedPoints: ["后台任务"] }],
              discardedSources: [{ digestId: project.id, reason: "项目计划文档与这张观点卡主题不一致。" }],
              sourceConflictNotes: ["产品叙事和用户讨论重点不同。"],
              sourceCoverage: { sufficiency: "usable", missingAngles: ["缺少实测数据"] },
              editorNotes: ["保留为观点卡。"],
              riskNotes: ["不要说成效率已被证明提升。"],
              continuationAngles: ["找一个具体开发任务做对照。"]
            },
            {
              title: "Material hub 计划需要单独归档",
              materialType: "project_doc",
              processingTemplate: "structured_summary",
              topic: "material hub plan",
              cardBody: "这条项目文档更适合单独归档。它说明 LLM 工作要从素材卡注释前移到 source digest 和 aggregation，不应该混进外部热点卡里。",
              tags: ["material-hub"],
              narrativeLines: ["structured-thinking"],
              usedSources: [{ digestId: project.id, reason: "它是项目计划来源。", supportedPoints: ["LLM 前移"] }],
              discardedSources: [{ digestId: news.id, reason: "外部热点与项目文档管理不属于同一卡。" }],
              sourceConflictNotes: ["无直接冲突。"],
              sourceCoverage: { sufficiency: "thin", missingAngles: ["需要更多项目状态文件"] },
              editorNotes: ["内部项目卡。"],
              riskNotes: [],
              continuationAngles: ["补充 progress 和 runbook。"]
            }
          ]
          })
        };
      }
    };

    const cards = await buildAggregatedMaterialCardsWithDeepSeek([news, project], client);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.generation?.provider).toBe("deepseek");
    expect(cards[0]?.usedSources?.[0]?.digestId).toBe(news.id);
    expect(cards[1]?.materialType).toBe("project_doc");
    expect(cards[1]?.discardedSources?.[0]?.digestId).toBe(news.id);
    expect(calls).toBe(2);
  });
});
