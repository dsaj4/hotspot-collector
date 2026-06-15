import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { materialWorkspaceRoot } from "../../config.js";
import { sha1 } from "../../core/hash.js";
import { artifactPath } from "../../core/paths.js";
import { dateFolder, safeTimestamp } from "../../core/time.js";
import type { CandidateAsset, HotspotItem } from "../../types.js";

type MaterialGenerationResult = {
  snapshotRef: string;
  candidateRefs: string[];
  syncPackageRef: string;
  candidateCount: number;
  readyForContentSystemCount: number;
};

function relFromMaterialWorkspace(abs: string): string {
  return path.relative(materialWorkspaceRoot, abs).replaceAll("\\", "/");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readHotspots(): Promise<HotspotItem[]> {
  const file = artifactPath(path.join("data", "normalized", dateFolder(), "hotspots.jsonl"));
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HotspotItem);
}

function latestSnapshotItems(items: HotspotItem[]): HotspotItem[] {
  const latestBySource = new Map<string, string>();
  for (const item of items) {
    const current = latestBySource.get(item.sourceId);
    if (!current || item.capturedAt > current) latestBySource.set(item.sourceId, item.capturedAt);
  }
  return items.filter((item) => latestBySource.get(item.sourceId) === item.capturedAt);
}

function stableTitle(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase();
}

function relevanceScore(group: HotspotItem[]): number {
  const text = group.map((item) => `${item.title} ${item.category} ${item.label ?? ""}`).join(" ");
  const keywords = ["AI", "model", "robot", "LLM", "learning", "education", "semiconductor"];
  const keywordScore = keywords.reduce((score, keyword) => score + (text.toLowerCase().includes(keyword.toLowerCase()) ? 12 : 0), 0);
  const rankScore = Math.max(0, 20 - Math.min(...group.map((item) => item.rank)));
  const sourceScore = Math.min(30, new Set(group.map((item) => item.sourceId)).size * 15);
  return keywordScore + rankScore + sourceScore;
}

function buildCandidate(group: HotspotItem[]): CandidateAsset {
  const sorted = [...group].sort((a, b) => a.rank - b.rank);
  const primary = sorted[0];
  const sourceIds = new Set(group.map((item) => item.sourceId));
  const evidenceLevel = sourceIds.size >= 2 ? "L2 cross-checked" : "L1 visible-source";
  const riskLevel = evidenceLevel === "L2 cross-checked" ? "medium" : "high";
  const freshness = primary.capturedAt.slice(0, 10);
  const candidateId = `trend-${freshness.replaceAll("-", "")}-${sha1(`${primary.title}:${freshness}`).slice(0, 10)}`;
  const score = Math.max(60, Math.min(95, Math.round(relevanceScore(group))));

  return {
    candidateId,
    title: primary.title,
    sourceItems: sorted,
    captureWindow: `${freshness} latest snapshot`,
    evidenceLevel,
    riskLevel,
    riskNotes: [
      "Platform heat is a signal, not verified fact.",
      evidenceLevel === "L2 cross-checked" ? "Multiple sources mention the topic, but original context still needs review." : "Single-source heat should stay in preparation until verified.",
      "Do not present collection output as publication-ready analysis."
    ],
    visionTreeAngle: `Use this hotspot as a question about judgement, workflow, or learning context: ${primary.title}`,
    recommendedAccounts: ["AI Doubt Notes"],
    contentSystemMapping: {
      id: candidateId,
      title: `Hotspot material: ${primary.title}`,
      theme: "Trend intake",
      source: "trend-intake-workspace",
      format: "hotspot snapshot",
      freshness,
      score,
      tags: ["hotspot", "trend-intake", ...sorted.map((item) => item.platform)],
      summary: `Collected from ${[...sourceIds].join(" / ")}. Treat as a material starting point, not a verified claim.`,
      owner: "AI Doubt Notes",
      palette: "mint",
      notes: [
        "Open the original links before using this for publication.",
        "Cross-check claims outside platform ranking lists.",
        "Keep raw snapshot references for audit."
      ],
      resources: sorted.slice(0, 5).map((item, index) => ({
        id: `${candidateId}-source-${index + 1}`,
        title: `${item.sourceId} #${item.rank}: ${item.title}`,
        kind: "web",
        url: item.url,
        source: `${item.platform}/${item.provider}`,
        updated: item.capturedAt.slice(0, 10),
        summary: `Captured from ${item.sourceId}; raw snapshot: ${item.rawRef}`,
        highlights: [`capture: ${item.capturedAt}`, `source: ${item.sourceId}`, `rawRef: ${item.rawRef}`]
      }))
    },
    syncStatus: evidenceLevel === "L2 cross-checked" ? "ready-for-content-system" : "ready-for-prep"
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

## Angle

${candidate.visionTreeAngle}

## Source Items

${candidate.sourceItems.map((item) => `- ${item.sourceId} #${item.rank}: [${item.title}](${item.url}), capturedAt: \`${item.capturedAt}\`, rawRef: \`${item.rawRef}\``).join("\n")}

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
    .filter((group) => relevanceScore(group) >= 20)
    .map(buildCandidate)
    .sort((a, b) => b.contentSystemMapping.score - a.contentSystemMapping.score)
    .slice(0, limit);

  const stamp = safeTimestamp();
  const day = dateFolder();
  const snapshotAbs = path.join(materialWorkspaceRoot, "trend-intake-workspace", "02-hotspot-snapshots", day, `snapshot-${stamp}.json`);
  const candidateDir = path.join(materialWorkspaceRoot, "trend-intake-workspace", "03-candidate-assets", day);
  const syncPackageAbs = path.join(materialWorkspaceRoot, "trend-intake-workspace", "04-sync-packages", day, `sync-${stamp}.json`);

  await ensureDir(path.dirname(snapshotAbs));
  await ensureDir(candidateDir);
  await ensureDir(path.dirname(syncPackageAbs));

  await writeFile(snapshotAbs, JSON.stringify({ generatedAt: new Date().toISOString(), source: "hotspot-collector", itemCount: items.length, items }, null, 2), "utf8");

  const candidateRefs: string[] = [];
  for (const candidate of candidates) {
    const jsonAbs = path.join(candidateDir, `${candidate.candidateId}.json`);
    const mdAbs = path.join(candidateDir, `${candidate.candidateId}.md`);
    await writeFile(jsonAbs, JSON.stringify(candidate, null, 2), "utf8");
    await writeFile(mdAbs, toMarkdown(candidate), "utf8");
    candidateRefs.push(relFromMaterialWorkspace(jsonAbs), relFromMaterialWorkspace(mdAbs));
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
          .map((candidate) => ({ candidateId: candidate.candidateId, syncStatus: candidate.syncStatus, reason: "Needs stronger evidence before content-system sync." }))
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    snapshotRef: relFromMaterialWorkspace(snapshotAbs),
    candidateRefs,
    syncPackageRef: relFromMaterialWorkspace(syncPackageAbs),
    candidateCount: candidates.length,
    readyForContentSystemCount: readyAssets.length
  };
}
