import type { SourceConfig, SourceFetchMode } from "../types.js";

export type DetectionResult = {
  platform: string;
  platformId: string;
  displayName: string;
  inputUrl: string;
  source: SourceConfig;
};

function sourceFrom(input: {
  id: string;
  platform: string;
  name: string;
  fetchMode: SourceFetchMode;
  inputUrl: string;
  platformId: string;
  requiresLogin?: boolean;
  usesCookie?: boolean;
  usesBrowserSession?: boolean;
  publicOnly?: boolean;
}): DetectionResult {
  return {
    platform: input.platform,
    platformId: input.platformId,
    displayName: input.name,
    inputUrl: input.inputUrl,
    source: {
      id: input.id,
      kind: "subscription",
      platform: input.platform,
      name: input.name,
      enabled: false,
      intervalMinutes: 60,
      fetchMode: input.fetchMode,
      params: { inputUrl: input.inputUrl, platformId: input.platformId },
      policy: {
        requiresLogin: input.requiresLogin ?? false,
        usesCookie: input.usesCookie ?? false,
        usesBrowserSession: input.usesBrowserSession ?? false,
        publicOnly: input.publicOnly ?? true,
        enabledByDefault: false
      }
    }
  };
}

function pathSegment(pathname: string, prefix: string): string {
  return pathname.slice(prefix.length).split("/").filter(Boolean)[0] ?? "";
}

export function detectSource(inputUrl: string): DetectionResult {
  const url = new URL(inputUrl);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const pathname = url.pathname;

  if (host === "space.bilibili.com") {
    const uid = pathname.split("/").filter(Boolean)[0] ?? "";
    if (/^\d+$/.test(uid)) {
      return sourceFrom({
        id: `bilibili-user-${uid}`,
        platform: "bilibili",
        name: `Bilibili UID ${uid}`,
        fetchMode: "public-api",
        inputUrl,
        platformId: uid
      });
    }
  }

  if (host === "x.com" || host === "twitter.com") {
    const username = pathname.split("/").filter(Boolean)[0] ?? "";
    if (username) {
      return sourceFrom({
        id: `x-browser-${username.toLowerCase()}`,
        platform: "x",
        name: `X @${username}`,
        fetchMode: "browser-session",
        inputUrl,
        platformId: username,
        requiresLogin: true,
        usesBrowserSession: true,
        publicOnly: false
      });
    }
  }

  if (host === "weibo.com" || host === "weibo.cn") {
    const uid = pathname.match(/^\/u\/(\d+)/)?.[1] ?? pathname.match(/^\/(\d{6,})/)?.[1] ?? "";
    if (uid) {
      return sourceFrom({
        id: `weibo-user-${uid}`,
        platform: "weibo",
        name: `Weibo UID ${uid}`,
        fetchMode: "rsshub",
        inputUrl,
        platformId: uid,
        publicOnly: false
      });
    }
  }

  if (host === "zhihu.com" && pathname.startsWith("/people/")) {
    const id = pathSegment(pathname, "/people/");
    if (id) {
      return sourceFrom({
        id: `zhihu-people-${id}`,
        platform: "zhihu",
        name: `Zhihu ${id}`,
        fetchMode: "rsshub",
        inputUrl,
        platformId: id,
        publicOnly: false
      });
    }
  }

  if (host === "youtube.com" && pathname.startsWith("/channel/")) {
    const channelId = pathSegment(pathname, "/channel/");
    if (channelId) {
      return sourceFrom({
        id: `youtube-channel-${channelId}`,
        platform: "youtube",
        name: `YouTube ${channelId}`,
        fetchMode: "direct-rss",
        inputUrl,
        platformId: channelId
      });
    }
  }

  if (host === "mp.weixin.qq.com") {
    return sourceFrom({
      id: "wechat-url-review",
      platform: "wechat",
      name: "WeChat URL review required",
      fetchMode: "direct-rss",
      inputUrl,
      platformId: "",
      requiresLogin: true,
      publicOnly: false
    });
  }

  if (pathname.endsWith(".xml") || pathname.includes("rss") || pathname.includes("feed")) {
    return sourceFrom({
      id: `rss-${host.replace(/[^a-z0-9]+/g, "-")}`,
      platform: "rss",
      name: host,
      fetchMode: "direct-rss",
      inputUrl,
      platformId: ""
    });
  }

  return sourceFrom({
    id: `rss-${host.replace(/[^a-z0-9]+/g, "-")}`,
    platform: "rss",
    name: host,
    fetchMode: "direct-rss",
    inputUrl,
    platformId: ""
  });
}
