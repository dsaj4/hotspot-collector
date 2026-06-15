import type { HotspotItem } from "../../../types.js";
import { sha1 } from "../../../core/hash.js";

export function hotspotDedupeKey(sourceId: string, capturedAt: string, rank: number, title: string): string {
  return `${sourceId}:${capturedAt.slice(0, 10)}:${rank}:${sha1(title)}`;
}

export function normalizeTitle(input: unknown): string {
  return String(input ?? "").trim();
}

export function makeHotspotItem(input: {
  sourceId: string;
  platform: string;
  provider: string;
  rank: number;
  title: string;
  url: string;
  capturedAt: string;
  rawRef: string;
  heat?: number | string;
  label?: string;
  mobileUrl?: string;
}): HotspotItem {
  return {
    id: `${input.sourceId}-${input.capturedAt.slice(0, 10)}-${input.rank}-${sha1(input.title).slice(0, 10)}`,
    sourceId: input.sourceId,
    platform: input.platform,
    provider: input.provider,
    rank: input.rank,
    title: input.title,
    url: input.url,
    mobileUrl: input.mobileUrl,
    heat: input.heat,
    label: input.label,
    category: "hotspot",
    capturedAt: input.capturedAt,
    rawRef: input.rawRef,
    dedupeKey: hotspotDedupeKey(input.sourceId, input.capturedAt, input.rank, input.title)
  };
}
