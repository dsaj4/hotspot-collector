import type { ProcessingTemplate } from "./types.js";
import { writingProfileFor } from "./writing-profiles.js";

export type WritingQualityIssue = {
  code:
    | "too-short"
    | "too-long"
    | "cta"
    | "writing-instruction"
    | "invented-first-person"
    | "empty-paragraphs"
    | "coverage-as-fact"
    | "speculative-padding";
  message: string;
};

const ctaPatterns = [/点赞/, /关注(我|我们|账号|公众号)/, /转发/, /立即行动/, /点击(链接|购买|进入)/, /欢迎在评论区/, /订阅/];
const instructionPatterns = [/建议创作者/, /写作时/, /可以写成/, /适合改写成/, /关键词布局/, /标题可以/, /封面文案/, /创作方向/];
const firstPersonPatterns = [/(我|我们)(亲眼|亲身|曾经|采访了|测试了|使用了|发现了|经历过)/];
const coverageAsFactPatterns = [/尚未(披露|公布|公开|说明|确认)/, /仍未(披露|公布|公开|说明|确认)/];
const speculativePaddingPatterns = [/可能(暗示|意味着|反映|表明)/, /旨在(营造|展示|强调|传达)/];

function chineseLength(value: string): number {
  return [...value.replace(/\s/g, "")].length;
}

export function normalizeMaterialCardWriting(cardBody: string, options: { sourceCount?: number } = {}): string {
  if (options.sourceCount !== 1) return cardBody.trim();
  return cardBody
    .replace(/目前公开的信息仅(包括|包含)/g, "当前 Digest 仅记录了")
    .replace(/尚未(披露|公布|公开|说明|确认)/g, "当前 Digest 未提供")
    .replace(/仍未(披露|公布|公开|说明|确认)/g, "当前 Digest 未提供")
    .replace(/暂无详细描述/g, "当前 Digest 未提供详细描述")
    .replace(/后续可关注[^。！？]*[。！？]?/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function assessMaterialCardWriting(
  cardBody: string,
  template: ProcessingTemplate,
  options: { sourceCount?: number } = {}
): WritingQualityIssue[] {
  const profile = writingProfileFor(template);
  const issues: WritingQualityIssue[] = [];
  const length = chineseLength(cardBody);
  const minimumLength = options.sourceCount === 1 ? Math.min(profile.targetLength.min, 140) : profile.targetLength.min;

  if (length < minimumLength) {
    issues.push({ code: "too-short", message: `正文仅 ${length} 字，当前来源预算下目标至少 ${minimumLength} 字，尚未形成完整短文。` });
  }
  if (length > profile.targetLength.max) {
    issues.push({ code: "too-long", message: `正文达到 ${length} 字，超过目标上限 ${profile.targetLength.max} 字。` });
  }
  if (ctaPatterns.some((pattern) => pattern.test(cardBody))) {
    issues.push({ code: "cta", message: "正文包含平台 CTA 或行动号召。" });
  }
  if (instructionPatterns.some((pattern) => pattern.test(cardBody))) {
    issues.push({ code: "writing-instruction", message: "正文包含面向创作者的写作指示。" });
  }
  if (firstPersonPatterns.some((pattern) => pattern.test(cardBody))) {
    issues.push({ code: "invented-first-person", message: "正文出现可能无法由来源支撑的第一人称经历。" });
  }
  if (!cardBody.trim() || cardBody.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length < 2) {
    issues.push({ code: "empty-paragraphs", message: "正文缺少至少两个自然段，阅读形态仍像字段摘要。" });
  }
  if (options.sourceCount === 1 && coverageAsFactPatterns.some((pattern) => pattern.test(cardBody))) {
    issues.push({ code: "coverage-as-fact", message: "单源正文把当前 Digest 未提供的信息写成了现实世界的未公布状态；应明确写成资料覆盖范围。" });
  }
  if (options.sourceCount === 1 && speculativePaddingPatterns.some((pattern) => pattern.test(cardBody))) {
    issues.push({ code: "speculative-padding", message: "单源正文使用推测性解释补充篇幅；删除推测，只保留来源支持的事实和资料缺口。" });
  }

  return issues;
}
