import type { SourceConfig } from "../types.js";

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function sourceParam(source: SourceConfig, key: string): string {
  const value = source.params?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function buildRsshubUrl(source: SourceConfig, baseUrl: string): string {
  const base = cleanBaseUrl(baseUrl);
  const platformId = sourceParam(source, "platformId") || sourceParam(source, "uid") || sourceParam(source, "username");

  if (!base) throw new Error("RSSHUB_BASE_URL is required for rsshub sources.");
  if (!platformId) throw new Error(`RSSHub source ${source.id} is missing platformId.`);

  if (source.platform === "zhihu") return `${base}/zhihu/people/activities/${encodeURIComponent(platformId)}`;
  if (source.platform === "x") return `${base}/twitter/user/${encodeURIComponent(platformId)}`;
  if (source.platform === "weibo") return `${base}/weibo/user/${encodeURIComponent(platformId)}`;
  if (source.platform === "bilibili") return `${base}/bilibili/user/video/${encodeURIComponent(platformId)}`;

  throw new Error(`Unsupported RSSHub platform: ${source.platform}`);
}
