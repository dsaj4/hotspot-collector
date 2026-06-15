import { describe, expect, it } from "vitest";
import { assessMaterialCardWriting, normalizeMaterialCardWriting } from "../../src/material-hub/writing-quality.js";
import { editorialKernel, writingProfileFor, writingProfiles } from "../../src/material-hub/writing-profiles.js";

describe("material card writing profiles", () => {
  it("defines visibly different editorial progressions for every template", () => {
    expect(Object.keys(writingProfiles)).toEqual([
      "intelligence_brief",
      "structured_summary",
      "research_note",
      "opinion_incubator"
    ]);
    expect(writingProfileFor("intelligence_brief").bodyProgression).toContain("confirmed facts");
    expect(writingProfileFor("structured_summary").bodyProgression).toContain("confirmed decisions");
    expect(writingProfileFor("research_note").bodyProgression).toContain("counterexample or alternative explanation");
    expect(writingProfileFor("opinion_incubator").bodyProgression).toContain("strongest counterpoint");
    expect(new Set(Object.values(writingProfiles).map((profile) => profile.openingMove)).size).toBe(4);
  });

  it("keeps the common kernel focused on readable cards rather than downstream writing instructions", () => {
    const kernel = editorialKernel.join("\n");
    expect(kernel).toContain("readable Chinese short article");
    expect(kernel).toContain("Do not include calls to action");
    expect(kernel).toContain("Never invent personal experience");
  });

  it("flags short summaries, CTAs, writing instructions, and invented first-person experience", () => {
    const body = "我亲身测试了这个工具。建议创作者可以写成一篇帖子，欢迎在评论区关注我们。";
    const issues = assessMaterialCardWriting(body, "opinion_incubator");
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["too-short", "cta", "writing-instruction", "invented-first-person", "empty-paragraphs"])
    );
  });

  it("accepts a sufficiently developed multi-paragraph card without platform language", () => {
    const paragraph =
      "这批材料讨论的是代码代理进入后台工作流之后，人的工作是否真的减少。产品说明展示了任务执行能力，创作者则把注意力放在小团队效率上。两种来源说的是同一项变化，却没有回答评审成本由谁承担。";
    const body = [paragraph, paragraph, paragraph, paragraph].join("\n\n");
    expect(assessMaterialCardWriting(body, "research_note")).toEqual([]);
  });

  it("allows a concise single-source card instead of forcing unsupported padding", () => {
    const paragraph =
      "《遗忘之海》宣布公测定档7月，并发布船员集结摇滚MV「燥」。现有来源能够确认的内容限于月份、MV标题和B站热度，尚不能据此判断游戏品质或公测表现。";
    const body = [paragraph, paragraph].join("\n\n");
    expect(assessMaterialCardWriting(body, "intelligence_brief", { sourceCount: 1 })).toEqual([]);
  });

  it("rejects single-source speculation and coverage gaps written as real-world facts", () => {
    const paragraph = "具体日期尚未公布，摇滚风格可能暗示海上冒险，旨在营造热烈气氛。";
    const body = [paragraph, paragraph, paragraph, paragraph, paragraph].join("\n\n");
    const issues = assessMaterialCardWriting(body, "intelligence_brief", { sourceCount: 1 });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["coverage-as-fact", "speculative-padding"]));
  });

  it("normalizes single-source coverage language without inventing replacement facts", () => {
    const normalized = normalizeMaterialCardWriting(
      "目前公开的信息仅包含公测月份，具体日期尚未披露，MV暂无详细描述。后续可关注官方渠道获取更新。",
      { sourceCount: 1 }
    );
    expect(normalized).toContain("当前 Digest 仅记录了");
    expect(normalized).toContain("当前 Digest 未提供");
    expect(normalized).not.toContain("后续可关注");
    expect(normalized).not.toContain("尚未披露");
  });
});
