import type { SourceConfig } from "./types.js";
import { parseCsvEnv, parseIntegerEnv } from "./core/env.js";
import { readBiliSumLocalConfig } from "./video-intake/local-config.js";
import { dataPath, dataRoot, externalPath, externalRoot } from "./core/paths.js";

const bilisumLocalConfig = readBiliSumLocalConfig();

export const bilibiliUid = "289842886";
export const bilibiliCookie = process.env.BILIBILI_COOKIE ?? "";
export const bilibiliFollowingLimit = parseIntegerEnv(process.env.BILIBILI_FOLLOWING_LIMIT, 20, { min: 1, max: 200 });
export const wechatRssBaseUrl = process.env.WECHAT_RSS_BASE_URL ?? "http://127.0.0.1:4000";
export const wechatRssFeeds = parseCsvEnv(process.env.WECHAT_RSS_FEEDS, "all");
export const wechatRssLimit = parseIntegerEnv(process.env.WECHAT_RSS_LIMIT, 30, { min: 1, max: 200 });
export const rsshubBaseUrl = process.env.RSSHUB_BASE_URL ?? "";
export const genericRssLimit = parseIntegerEnv(process.env.GENERIC_RSS_LIMIT, 30, { min: 1, max: 200 });
export const hotspotDataRoot = dataRoot();
export const hotspotExternalRoot = externalRoot();
export const bilisumProjectRoot = process.env.BILISUM_PROJECT_ROOT ?? bilisumLocalConfig.projectRoot ?? externalPath("BiliSum");
export const bilisumAppDataRoot = process.env.BILISUM_APP_DATA_ROOT ?? bilisumLocalConfig.appDataRoot ?? dataPath("bilisum");
export const weweRssProjectRoot = process.env.WEWE_RSS_PROJECT_ROOT ?? externalPath("wewe-rss");
export const visionLibRoot = process.env.VISION_LIB_ROOT ?? "E:/Project/vision-lib";
export const contentSystemApiBase = process.env.CONTENT_SYSTEM_API_BASE ?? "http://127.0.0.1:8787";
export const contentSystemLoginAccount = process.env.CONTENT_SYSTEM_ACCOUNT ?? "thinking-lab";
export const deepseekApiKey = process.env.DEEPSEEK_API_KEY ?? "";
export const deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
export const deepseekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
export const materialHubImaKnowledgeBaseId = process.env.MATERIAL_HUB_IMA_KNOWLEDGE_BASE_ID ?? "";
export const imaOpenapiClientId = process.env.IMA_OPENAPI_CLIENTID ?? "";
export const imaOpenapiApiKey = process.env.IMA_OPENAPI_APIKEY ?? "";
export const bilisumBaseUrl = (process.env.BILISUM_BASE_URL ?? bilisumLocalConfig.baseUrl ?? "http://127.0.0.1:3838").replace(/\/+$/, "");
export const bilisumAccessToken = process.env.BILISUM_ACCESS_TOKEN ?? bilisumLocalConfig.accessToken ?? "";
export const bilisumTaskTimeoutMs = parseIntegerEnv(process.env.BILISUM_TASK_TIMEOUT_MS, 10 * 60 * 1000, { min: 10_000, max: 60 * 60 * 1000 });
export const bilisumPollIntervalMs = parseIntegerEnv(process.env.BILISUM_POLL_INTERVAL_MS, 2_000, { min: 500, max: 60_000 });
export const bilisumVisualNoteMode = process.env.BILISUM_VISUAL_NOTE_MODE ?? "frame_insert";

export const subscriptionSources: SourceConfig[] = [
  {
    id: "bilibili-user-dynamic",
    kind: "subscription",
    platform: "bilibili",
    name: "Bilibili user dynamic",
    enabled: true,
    intervalMinutes: 30,
    fetchMode: "public-api",
    params: { uid: bilibiliUid },
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "bilibili-user-video",
    kind: "subscription",
    platform: "bilibili",
    name: "Bilibili user video",
    enabled: true,
    intervalMinutes: 30,
    fetchMode: "public-api",
    params: { uid: bilibiliUid },
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "wechat-rss",
    kind: "subscription",
    platform: "wechat",
    name: "WeChat public account RSS via WeWe RSS",
    enabled: true,
    intervalMinutes: 60,
    fetchMode: "direct-rss",
    params: { baseUrl: wechatRssBaseUrl, feeds: wechatRssFeeds.join(",") },
    policy: { requiresLogin: true, usesCookie: false, usesBrowserSession: false, publicOnly: false, enabledByDefault: true }
  }
];

export const hotspotSources: SourceConfig[] = [
  {
    id: "bilibili-popular",
    kind: "hotspot",
    platform: "bilibili",
    name: "Bilibili popular ranking",
    enabled: true,
    intervalMinutes: 15,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "weibo-hot",
    kind: "hotspot",
    platform: "weibo",
    name: "Weibo hot search via NewsNow",
    enabled: true,
    intervalMinutes: 15,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "zhihu-hot",
    kind: "hotspot",
    platform: "zhihu",
    name: "Zhihu hot list",
    enabled: true,
    intervalMinutes: 15,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "douyin-hot",
    kind: "hotspot",
    platform: "douyin",
    name: "Douyin hot search",
    enabled: true,
    intervalMinutes: 15,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "baidu-hot",
    kind: "hotspot",
    platform: "baidu",
    name: "Baidu hot search",
    enabled: true,
    intervalMinutes: 15,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "github-trending",
    kind: "hotspot",
    platform: "github",
    name: "GitHub Trending daily",
    enabled: true,
    intervalMinutes: 60,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "hacker-news-frontpage",
    kind: "hotspot",
    platform: "hacker-news",
    name: "Hacker News front page",
    enabled: true,
    intervalMinutes: 60,
    fetchMode: "public-api",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  },
  {
    id: "google-news-ai",
    kind: "hotspot",
    platform: "google-news",
    name: "Google News AI RSS",
    enabled: true,
    intervalMinutes: 60,
    fetchMode: "direct-rss",
    policy: { requiresLogin: false, usesCookie: false, usesBrowserSession: false, publicOnly: true, enabledByDefault: true }
  }
];
