import type { HotspotItem, SourceHealth } from "../../../types.js";
import { nowIso } from "../../../core/time.js";
import { writeRawSnapshot } from "../../../core/storage.js";
import { makeHotspotItem, normalizeTitle } from "./common.js";

function decodeHtml(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export async function collectGithubTrending(): Promise<{ items: HotspotItem[]; rawRef: string; health: SourceHealth }> {
  const sourceId = "github-trending";
  const capturedAt = nowIso();
  try {
    const response = await fetch("https://github.com/trending?since=daily", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const html = await response.text();
    const rawRef = await writeRawSnapshot(sourceId, { provider: "html-public", html });
    const matches = [...html.matchAll(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const items = matches
      .map((match, index) => {
        const repo = decodeHtml(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        const title = normalizeTitle(repo);
        if (!title) return null;
        return makeHotspotItem({
          sourceId,
          platform: "github",
          provider: "html-public",
          rank: index + 1,
          title,
          url: `https://github.com${match[1]}`,
          capturedAt,
          rawRef
        });
      })
      .filter((item): item is HotspotItem => Boolean(item))
      .slice(0, 30);
    return { items, rawRef, health: { sourceId, status: items.length ? "ok" : "empty", checkedAt: capturedAt, provider: "html-public", itemCount: items.length } };
  } catch (error) {
    return { items: [], rawRef: "", health: { sourceId, status: "error", checkedAt: capturedAt, provider: "html-public", message: error instanceof Error ? error.message : String(error) } };
  }
}
