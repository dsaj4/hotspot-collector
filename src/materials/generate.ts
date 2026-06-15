import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { visionLibRoot } from "../config.js";
import { sha1 } from "../core/hash.js";
import { dateFolder, safeTimestamp } from "../core/time.js";
import type { CandidateAsset, HotspotItem } from "../types.js";

type MaterialGenerationResult = {
  snapshotRef: string;
  candidateRefs: string[];
  syncPackageRef: string;
  candidateCount: number;
  readyForContentSystemCount: number;
};

const projectRoot = process.cwd();

function relFromVisionLib(abs: string): string {
  return path.relative(visionLibRoot, abs).replaceAll("\\", "/");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

function stableTitle(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase();
}

function latestSnapshotItems(items: HotspotItem[]): HotspotItem[] {
  const latestBySource = new Map<string, string>();
  for (const item of items) {
    const current = latestBySource.get(item.sourceId);
    if (!current || item.capturedAt > current) latestBySource.set(item.sourceId, item.capturedAt);
  }
  return items.filter((item) => latestBySource.get(item.sourceId) === item.capturedAt);
}

async function readHotspots(): Promise<HotspotItem[]> {
  const file = path.join(projectRoot, "data", "normalized", dateFolder(), "hotspots.jsonl");
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HotspotItem);
}

function relevanceScore(group: HotspotItem[]): number {
  const text = group.map((item) => item.title).join(" ");
  let score = 0;
  for (const keyword of ["AI", "人工智能", "模型", "机器人", "解题", "高考", "盲文", "认知", "学习", "半导体"]) {
    if (text.includes(keyword)) score += 18;
  }
  score += Math.max(0, 20 - Math.min(...group.map((item) => item.rank)));
  score += Math.min(30, group.length * 15);
  return score;
}

function hasVisionTreeDomainSignal(title: string): boolean {
  return ["AI", "人工智能", "模型", "机器人", "解题", "高考", "盲文", "认知", "学习", "半导体"].some((keyword) =>
    title.includes(keyword)
  );
}

function recommendedAccounts(title: string): string[] {
  if (title.includes("高考") || title.includes("解题") || title.includes("学习")) return ["AI Doubt Notes", "Thinking Lab"];
  if (title.includes("机器人") || title.includes("半导体") || title.includes("模型")) return ["Milo Reed", "VisionTree"];
  if (title.includes("盲文")) return ["The Thinking Tree", "AI Doubt Notes"];
  return ["AI Doubt Notes"];
}

function angleFor(title: string): string {
  if (title.includes("高考") || title.includes("解题")) {
    return "把这个热点转成一个判断问题：当 AI 能直接给答案时，教育场景到底需要禁止工具，还是重新训练提问、验证和独立判断？";
  }
  if (title.includes("机器人")) {
    return "把这个热点转成一个判断问题：当硬件自动化成为公共叙事，人还需要保留哪些不可外包的目标设定和现场判断？";
  }
  if (title.includes("模型")) {
    return "把这个热点转成一个判断问题：模型降价后，真正稀缺的是算力成本，还是把模型嵌入稳定工作流的判断结构？";
  }
  if (title.includes("盲文")) {
    return "把这个热点转成一个判断问题：技术和公共表达怎样避免把辅助工具变成对少数体验的误读？";
  }
  return "把这个热点转成一个判断问题：热度背后暴露了用户在哪个环节缺少判断框架？";
}

function buildCandidate(group: HotspotItem[]): CandidateAsset {
  const sorted = [...group].sort((a, b) => a.rank - b.rank);
  const primary = sorted[0];
  const sourceIds = new Set(group.map((item) => item.sourceId));
  const evidenceLevel = sourceIds.size >= 2 ? "L2 cross-checked" : "L1 visible-source";
  const riskLevel = evidenceLevel === "L2 cross-checked" ? "medium" : "high";
  const freshness = primary.capturedAt.slice(0, 10);
  const slug = sha1(`${primary.title}:${freshness}`).slice(0, 10);
  const assetId = `trend-${freshness.replaceAll("-", "")}-${slug}`;
  const score = Math.max(70, Math.min(95, Math.round(relevanceScore(group))));
  const accounts = recommendedAccounts(primary.title);

  return {
    candidateId: assetId,
    title: primary.title,
    sourceItems: sorted,
    captureWindow: `${freshness} latest snapshot`,
    evidenceLevel,
    riskLevel,
    riskNotes: [
      "热点排名只证明平台当时有热度，不证明事件事实完整。",
      evidenceLevel === "L2 cross-checked" ? "已有至少两个来源出现同一标题，但发布前仍需打开原始链接核验上下文。" : "当前只有单一来源，不能直接进入 content-system。",
      "不得写成 VisionTree 已具备相关成熟产品能力。"
    ],
    visionTreeAngle: angleFor(primary.title),
    recommendedAccounts: accounts,
    contentSystemMapping: {
      id: assetId,
      title: `热点素材：${primary.title}`,
      theme: primary.title.includes("AI") || primary.title.includes("模型") ? "AI 与判断力" : "认知增强与公共判断",
      source: "trend-intake-workspace",
      format: "hotspot snapshot",
      freshness,
      score,
      tags: ["热点", "趋势采集", "判断力", ...accounts],
      summary: `来自 ${[...sourceIds].join(" / ")} 的热点信号。建议只作为创作入口：讨论 ${angleFor(primary.title)}`,
      owner: accounts[0],
      palette: "mint",
      notes: [
        `适用范围：用于把“${primary.title}”转成判断力、学习或认知增强相关的选题入口。`,
        `使用边界：不要把平台热度写成已证实事实；发布前至少打开两个来源交叉验证。`,
        `风险说明：${riskLevel === "medium" ? "中风险，已有多源信号但仍缺原文核验。" : "高风险，单源或弱相关热点只能进入准备区。"}`,
        "同步边界：只同步素材卡，不生成内容草稿，不写平台指标。"
      ],
      resources: sorted.slice(0, 5).map((item, index) => ({
        id: `${assetId}-source-${index + 1}`,
        title: `${item.sourceId} #${item.rank}: ${item.title}`,
        kind: "web",
        url: item.url,
        source: `${item.platform}/${item.provider}`,
        updated: item.capturedAt.slice(0, 10),
        summary: `采集自 ${item.sourceId}，排名 ${item.rank}，raw snapshot: ${item.rawRef}`,
        highlights: [
          `capture: ${item.capturedAt}`,
          `source: ${item.sourceId}`,
          `rawRef: ${item.rawRef}`
        ]
      }))
    },
    syncStatus: evidenceLevel === "L2 cross-checked" && hasVisionTreeDomainSignal(primary.title) ? "ready-for-content-system" : "ready-for-prep"
  };
}

function toMarkdown(candidate: CandidateAsset): string {
  return `# ${candidate.title}

- candidateId: \`${candidate.candidateId}\`
- evidenceLevel: ${candidate.evidenceLevel}
- riskLevel: ${candidate.riskLevel}
- syncStatus: ${candidate.syncStatus}
- captureWindow: ${candidate.captureWindow}
- recommendedAccounts: ${candidate.recommendedAccounts.join(", ")}

## VisionTree Angle

${candidate.visionTreeAngle}

## Source Items

${candidate.sourceItems.map((item) => `- ${item.sourceId} #${item.rank}: [${item.title}](${item.url})，capturedAt: \`${item.capturedAt}\`, rawRef: \`${item.rawRef}\``).join("\n")}

## Risk Notes

${candidate.riskNotes.map((note) => `- ${note}`).join("\n")}

## Content-System Mapping

\`\`\`json
${JSON.stringify(candidate.contentSystemMapping, null, 2)}
\`\`\`
`;
}

export async function generateMaterialCards(limit = 3): Promise<MaterialGenerationResult> {
  const items = latestSnapshotItems(await readHotspots());
  const byTitle = new Map<string, HotspotItem[]>();
  for (const item of items) {
    const key = stableTitle(item.title);
    const group = byTitle.get(key) ?? [];
    group.push(item);
    byTitle.set(key, group);
  }

  const candidates = [...byTitle.values()]
    .filter((group) => relevanceScore(group) >= 35)
    .map(buildCandidate)
    .sort((a, b) => b.contentSystemMapping.score - a.contentSystemMapping.score)
    .slice(0, limit);

  const stamp = safeTimestamp();
  const day = dateFolder();
  const snapshotAbs = path.join(visionLibRoot, "trend-intake-workspace", "02-hotspot-snapshots", day, `snapshot-${stamp}.json`);
  const candidateDir = path.join(visionLibRoot, "trend-intake-workspace", "03-candidate-assets", day);
  const syncPackageAbs = path.join(visionLibRoot, "trend-intake-workspace", "04-sync-packages", day, `sync-${stamp}.json`);

  await ensureDir(path.dirname(snapshotAbs));
  await ensureDir(candidateDir);
  await ensureDir(path.dirname(syncPackageAbs));

  await writeFile(
    snapshotAbs,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "hotspot-collector",
        itemCount: items.length,
        items
      },
      null,
      2
    ),
    "utf8"
  );

  const candidateRefs: string[] = [];
  for (const candidate of candidates) {
    const jsonAbs = path.join(candidateDir, `${candidate.candidateId}.json`);
    const mdAbs = path.join(candidateDir, `${candidate.candidateId}.md`);
    await writeFile(jsonAbs, JSON.stringify(candidate, null, 2), "utf8");
    await writeFile(mdAbs, toMarkdown(candidate), "utf8");
    candidateRefs.push(relFromVisionLib(jsonAbs), relFromVisionLib(mdAbs));
  }

  const readyAssets = candidates
    .filter((candidate) => candidate.syncStatus === "ready-for-content-system")
    .map((candidate) => candidate.contentSystemMapping);
  await writeFile(
    syncPackageAbs,
    JSON.stringify(
      {
        packageId: `sync-${stamp}`,
        generatedAt: new Date().toISOString(),
        target: "content-system.assets",
        syncStatus: readyAssets.length ? "ready-for-content-system" : "ready-for-prep",
        assets: readyAssets,
        skippedCandidates: candidates
          .filter((candidate) => candidate.syncStatus !== "ready-for-content-system")
          .map((candidate) => ({
            candidateId: candidate.candidateId,
            syncStatus: candidate.syncStatus,
            reason: "Needs stronger evidence before direct content-system sync."
          }))
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    snapshotRef: relFromVisionLib(snapshotAbs),
    candidateRefs,
    syncPackageRef: relFromVisionLib(syncPackageAbs),
    candidateCount: candidates.length,
    readyForContentSystemCount: readyAssets.length
  };
}
