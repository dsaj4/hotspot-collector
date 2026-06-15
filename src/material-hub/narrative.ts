import type { MaterialHubSourceItem, MaterialRecord } from "./types.js";

export type NarrativeLine = {
  id: string;
  title: string;
  description: string;
  allowedAngles: string[];
  avoidClaims: string[];
  defaultTags: string[];
};

export const narrativeLines: NarrativeLine[] = [
  {
    id: "cognition-augmentation",
    title: "Cognition Augmentation",
    description: "VisionTree helps people keep and strengthen their own thinking position while using AI.",
    allowedAngles: ["AI as thinking aid", "structured reflection", "user keeps judgment"],
    avoidClaims: ["AI replaces thinking", "automatic decisions", "mature second brain"],
    defaultTags: ["cognition augmentation", "structured thinking"]
  },
  {
    id: "judgment-retention",
    title: "Judgment Retention",
    description: "Useful AI workflows preserve the human decision point instead of hiding it.",
    allowedAngles: ["decision boundaries", "verification before action", "human agency"],
    avoidClaims: ["hands-free decisions", "fully autonomous judgment"],
    defaultTags: ["judgment", "decision boundaries"]
  },
  {
    id: "verification-over-citation",
    title: "Verification Over Citation",
    description: "Citations and summaries are useful only when they lead back to source checking.",
    allowedAngles: ["source tracing", "two-source verification", "citation is not proof"],
    avoidClaims: ["citation equals truth", "platform heat equals fact"],
    defaultTags: ["verification", "source tracing"]
  },
  {
    id: "agent-boundaries",
    title: "Agent Boundaries",
    description: "Agent systems need clear scopes, responsibilities, and recovery paths.",
    allowedAngles: ["agent orchestration", "workflow boundaries", "human review"],
    avoidClaims: ["more agents always better", "autonomous replacement"],
    defaultTags: ["agents", "boundaries"]
  },
  {
    id: "structured-thinking",
    title: "Structured Thinking",
    description: "Good tools make assumptions, options, and tradeoffs visible.",
    allowedAngles: ["argument maps", "decision frames", "thinking structure"],
    avoidClaims: ["one-click clarity", "instant expertise"],
    defaultTags: ["thinking structure", "tradeoffs"]
  },
  {
    id: "human-experience-value",
    title: "Human Experience Value",
    description: "Real experience, context, and judgment become more valuable when generated content is abundant.",
    allowedAngles: ["lived experience", "context quality", "content credibility"],
    avoidClaims: ["anti-AI content stance", "human content is automatically true"],
    defaultTags: ["human experience", "content credibility"]
  }
];

const allowedIds = new Set(narrativeLines.map((line) => line.id));

function textOf(value: Pick<MaterialHubSourceItem, "title" | "summary" | "contentText" | "platform"> | MaterialRecord): string {
  if ("tags" in value) return [value.title, value.summary, value.tags.join(" "), value.narrativeLines.join(" ")].join(" ");
  return [value.title, value.summary, value.contentText, value.platform].filter(Boolean).join(" ");
}

export function assignNarrativeLines(value: Pick<MaterialHubSourceItem, "title" | "summary" | "contentText" | "platform"> | MaterialRecord): string[] {
  const text = textOf(value).toLowerCase();
  const ids: string[] = [];

  if (/(ai|人工智能|模型|agent|智能体|工具|bilibili|github)/i.test(text)) ids.push("cognition-augmentation");
  if (/(判断|decision|选择|边界|取舍|review|审核)/i.test(text)) ids.push("judgment-retention");
  if (/(引用|citation|source|来源|验证|核验|trace|追溯|新闻|hot|热点)/i.test(text)) ids.push("verification-over-citation");
  if (/(agent|智能体|workflow|orchestrat|自动化)/i.test(text)) ids.push("agent-boundaries");
  if (/(结构|框架|thinking|思考|argument|tradeoff|取舍)/i.test(text)) ids.push("structured-thinking");
  if (/(体验|经验|human|creator|内容|video|视频|commentary)/i.test(text)) ids.push("human-experience-value");

  const unique = [...new Set(ids)].filter((id) => allowedIds.has(id));
  return unique.length ? unique.slice(0, 3) : ["cognition-augmentation", "judgment-retention"];
}

export function tagsForNarrative(lineIds: string[]): string[] {
  return [
    ...new Set(
      lineIds.flatMap((lineId) => narrativeLines.find((line) => line.id === lineId)?.defaultTags ?? [])
    )
  ];
}
