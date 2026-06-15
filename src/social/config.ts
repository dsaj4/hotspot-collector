import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SocialFallbackAdapter, SocialStreamType } from "../types.js";

export type BrowserSourceConfig = {
  id: string;
  platform: "bilibili" | "weibo" | "xiaohongshu" | "wechat";
  enabled: boolean;
  streams: SocialStreamType[];
  searchKeywords?: string[];
  targetAccounts?: string[];
  itemLimit: number;
  fallbackByStream?: Partial<Record<SocialStreamType, SocialFallbackAdapter>>;
};

const defaultSources: BrowserSourceConfig[] = [
  {
    id: "bilibili-browser",
    platform: "bilibili",
    enabled: true,
    streams: ["subscription", "search", "favorite", "hotspot", "home-feed"],
    searchKeywords: ["AI"],
    itemLimit: 10,
    fallbackByStream: {
      hotspot: "bilibili-hotspots"
    }
  },
  {
    id: "weibo-browser",
    platform: "weibo",
    enabled: true,
    streams: ["subscription", "search", "favorite", "hotspot", "home-feed"],
    searchKeywords: ["AI"],
    itemLimit: 10,
    fallbackByStream: { hotspot: "weibo-hotspots" }
  },
  {
    id: "xiaohongshu-browser",
    platform: "xiaohongshu",
    enabled: true,
    streams: ["subscription", "search", "favorite", "hotspot", "home-feed"],
    searchKeywords: ["AI"],
    itemLimit: 10
  },
  {
    id: "wechat-browser-maintenance",
    platform: "wechat",
    enabled: true,
    streams: ["subscription"],
    itemLimit: 1
  }
];

export function loadBrowserSources(filePath = process.env.BROWSER_SOURCE_CONFIG_PATH || path.join(process.cwd(), "config", "browser-sources.json")): BrowserSourceConfig[] {
  if (!existsSync(filePath)) return defaultSources;
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { sources?: BrowserSourceConfig[] } | BrowserSourceConfig[];
  return Array.isArray(parsed) ? parsed : parsed.sources ?? defaultSources;
}

export function browserSource(sourceId: string): BrowserSourceConfig | undefined {
  return loadBrowserSources().find((source) => source.id === sourceId);
}
