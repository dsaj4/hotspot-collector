import path from "node:path";
import { sha1 } from "../core/hash.js";
import { nowIso, dateFolder } from "../core/time.js";
import { detectSource } from "../sources/detect.js";
import type { MaterialHubSourceItem } from "./types.js";
import { hubDayPath, readJsonl, writeJsonl, writeJson, fileExists } from "./utils.js";
import { sourceExcerpt } from "./text-utils.js";

export type LinkIntakeResult = {
  item: MaterialHubSourceItem;
  outputRef: string;
  reportRef: string;
  acquisition: {
    mode: "temporary-link";
    platform: string;
    provider: string;
    sourceId: string;
    capturedAt: string;
  };
};

function titleFromUrl(inputUrl: string, fallback: string): string {
  const url = new URL(inputUrl);
  const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  return lastSegment || fallback;
}

export function buildTemporaryLinkSourceItem(inputUrl: string, capturedAt = nowIso(), options: { title?: string; contentText?: string } = {}): MaterialHubSourceItem {
  const detected = detectSource(inputUrl);
  const url = new URL(inputUrl);
  const slug = sha1(`${inputUrl}:${capturedAt.slice(0, 10)}`).slice(0, 12);
  return {
    id: `src-link-${capturedAt.slice(0, 10).replaceAll("-", "")}-${slug}`,
    sourceKind: "temporary-link",
    platform: detected.platform,
    provider: detected.source.fetchMode,
    title: options.title || titleFromUrl(inputUrl, detected.displayName || url.hostname),
    url: inputUrl,
    capturedAt,
    summary: options.contentText ? sourceExcerpt(options.contentText, 360) : `Temporary link captured from ${detected.platform}.`,
    contentText: options.contentText,
    rawRef: inputUrl,
    dedupeKey: `temporary-link:${sha1(inputUrl)}`
  };
}

export async function intakeTemporaryLink(inputUrl: string, options: { title?: string; contentText?: string } = {}): Promise<LinkIntakeResult> {
  const item = buildTemporaryLinkSourceItem(inputUrl, nowIso(), options);
  const outputAbs = hubDayPath("00-source-items", dateFolder(new Date(item.capturedAt)), "source-items.jsonl");
  const existing = (await fileExists(outputAbs)) ? await readJsonl<MaterialHubSourceItem>(outputAbs) : [];
  const byDedupe = new Map(existing.map((existingItem) => [existingItem.dedupeKey, existingItem]));
  byDedupe.set(item.dedupeKey, item);
  const outputRef = await writeJsonl(outputAbs, [...byDedupe.values()]);
  const reportAbs = path.join(path.dirname(outputAbs), `link-intake-${item.id}.json`);
  const reportRef = await writeJson(reportAbs, {
    generatedAt: new Date().toISOString(),
    mode: "temporary-link",
    item,
    outputRef
  });

  return {
    item,
    outputRef,
    reportRef,
    acquisition: {
      mode: "temporary-link",
      platform: item.platform,
      provider: item.provider,
      sourceId: item.id,
      capturedAt: item.capturedAt
    }
  };
}
