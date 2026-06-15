import type { MaterialHubSourceItem, MaterialType } from "./types.js";

export const taxonomyTagVocabulary = [
  "时政",
  "新闻",
  "AI",
  "访谈",
  "产品",
  "游戏",
  "科技",
  "研究",
  "项目",
  "文档",
  "教程",
  "观点",
  "商业",
  "设计",
  "文化",
  "教育",
  "娱乐",
  "社区",
  "政策",
  "市场",
  "工具",
  "运营",
  "方法",
  "复盘",
  "财经",
  "社会"
] as const;

type TaxonomyTag = (typeof taxonomyTagVocabulary)[number];

const taxonomyLookup: Record<string, TaxonomyTag> = {
  ai: "AI",
  "人工智能": "AI",
  llm: "AI",
  model: "AI",
  models: "AI",
  "大模型": "AI",
  "时政": "时政",
  "政治": "时政",
  politics: "时政",
  policy: "政策",
  "新闻": "新闻",
  news: "新闻",
  "访谈": "访谈",
  interview: "访谈",
  "产品": "产品",
  product: "产品",
  "游戏": "游戏",
  game: "游戏",
  "科技": "科技",
  tech: "科技",
  technology: "科技",
  "研究": "研究",
  research: "研究",
  "项目": "项目",
  project: "项目",
  "文档": "文档",
  document: "文档",
  docs: "文档",
  "教程": "教程",
  tutorial: "教程",
  "观点": "观点",
  opinion: "观点",
  "商业": "商业",
  business: "商业",
  "设计": "设计",
  design: "设计",
  "文化": "文化",
  culture: "文化",
  "教育": "教育",
  education: "教育",
  "娱乐": "娱乐",
  entertainment: "娱乐",
  "社区": "社区",
  community: "社区",
  "市场": "市场",
  market: "市场",
  "工具": "工具",
  tool: "工具",
  "运营": "运营",
  operations: "运营",
  "方法": "方法",
  method: "方法",
  "复盘": "复盘",
  review: "复盘",
  retro: "复盘",
  "财经": "财经",
  finance: "财经",
  "社会": "社会",
  society: "社会"
};

const topicTagRules: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /内卷|焦虑|压力|倦怠/, tags: ["内卷", "焦虑"] },
  { pattern: /降本|提效|效率|工作流|workflow/i, tags: ["效率", "工作流"] },
  { pattern: /agent|agents|智能体/i, tags: ["智能体", "工作流"] },
  { pattern: /AI|模型|大模型|LLM/i, tags: ["AI", "大模型"] },
  { pattern: /游戏|实机|公测|试玩/, tags: ["游戏", "实机"] },
  { pattern: /政策|通报|监管|时政/, tags: ["政策", "时政"] },
  { pattern: /访谈|对谈|采访/, tags: ["访谈"] },
  { pattern: /文档|方案|计划|复盘|runbook|wiki/i, tags: ["项目", "文档"] },
  { pattern: /产品|发布|版本|上线/, tags: ["产品"] },
  { pattern: /研究|论文|报告/, tags: ["研究"] },
  { pattern: /观点|评论|锐评|洞察/, tags: ["观点"] },
  { pattern: /市场|商业|财务|收入|增长/, tags: ["商业", "市场"] },
  { pattern: /创作|内容|素材|总结|整理/, tags: ["内容", "整理"] }
];

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueTags(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalizeKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function textOf(item: Pick<MaterialHubSourceItem, "title" | "summary" | "contentText" | "platform" | "provider">): string {
  return [item.title, item.summary, item.contentText, item.platform, item.provider].filter(Boolean).join(" ");
}

export function systemTagsFor(item: Pick<MaterialHubSourceItem, "sourceKind" | "platform" | "provider" | "contentText" | "summary" | "title">, materialType: MaterialType): string[] {
  const tags = new Set<string>();
  const text = textOf(item);

  if (item.platform === "bilibili") tags.add("B站");
  if (item.provider.includes("official") || /官方|official/i.test(text)) tags.add("官方媒体");
  if (item.sourceKind === "hotspot") tags.add("热榜");
  if (item.sourceKind === "temporary-link") tags.add("临时链接");
  if (item.sourceKind === "subscription") tags.add("订阅源");
  if (item.sourceKind === "ima") tags.add("IMA");
  if (materialType === "project_doc") tags.add("项目文档");
  if (materialType === "deep_article" || (item.contentText?.length ?? 0) > 1000) tags.add("长文");
  if (materialType === "opinion_insight") tags.add("观点");
  if (materialType === "news_brief") tags.add("资讯");

  return [...tags];
}

export function normalizeTaxonomyTags(tags: string[], fallbackText: string): string[] {
  const text = fallbackText.toLowerCase();
  const output: string[] = [];
  for (const tag of tags) {
    const key = normalizeKey(tag);
    const canonical = taxonomyLookup[key] ?? taxonomyLookup[tag] ?? taxonomyTagVocabulary.find((item) => normalizeKey(item) === key);
    if (canonical && !output.includes(canonical)) output.push(canonical);
  }
  if (output.length === 0) {
    for (const [pattern, canonicalTags] of [
      [/ai|模型|大模型|llm/i, ["AI"]],
      [/新闻|热点|时政|政策/i, ["新闻", "时政"]],
      [/访谈|对谈|采访/i, ["访谈"]],
      [/产品|发布|上线|版本/i, ["产品"]],
      [/游戏|实机|试玩|公测/i, ["游戏"]],
      [/文档|方案|计划|复盘|wiki/i, ["项目", "文档"]],
      [/研究|报告|论文/i, ["研究"]],
      [/观点|评论|锐评|洞察/i, ["观点"]],
      [/商业|市场|财务|增长/i, ["商业", "市场"]]
    ] as const) {
      if (pattern.test(text)) output.push(...canonicalTags.filter((tag) => !output.includes(tag)));
    }
  }
  return uniqueTags(output).filter((tag): tag is TaxonomyTag => taxonomyTagVocabulary.includes(tag as TaxonomyTag));
}

export function taxonomyTagsForMaterialType(materialType: MaterialType): string[] {
  if (materialType === "news_brief") return ["新闻"];
  if (materialType === "project_doc") return ["项目", "文档"];
  if (materialType === "deep_article") return ["研究"];
  return ["观点"];
}

export function normalizeTopicTags(tags: string[], fallbackText: string): string[] {
  const base = uniqueTags(tags.map((tag) => tag.trim()).filter(Boolean));
  if (base.length > 0) return base.slice(0, 8);

  const text = fallbackText.replace(/\s+/g, " ");
  const candidates: string[] = [];
  for (const rule of topicTagRules) {
    if (rule.pattern.test(text)) candidates.push(...rule.tags);
  }
  const fallbackParts = text
    .split(/[、，。；:：\-/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 12)
    .slice(0, 4);
  candidates.push(...fallbackParts);
  return uniqueTags(candidates).slice(0, 8);
}

export function mergeMaterialTags(...groups: Array<string[] | undefined>): string[] {
  return uniqueTags(groups.flatMap((group) => group ?? []));
}
